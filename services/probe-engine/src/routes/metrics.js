const express = require('express');
const router = express.Router();
const { pool, isDbConnected, isHypertableSupported, getMetricsBuffer } = require('../config/db');
const { getCache, setCache, isRedisConnected } = require('../config/redis');
const { targets, consecutiveFailuresMap, highLatencyCountMap, FAILURE_ALERT_THRESHOLD, getCurrentInterval, LATENCY_SLA_THRESHOLD_MS } = require('../services/prober');
const { addSseClient, getActiveClientCount } = require('../services/stream');

// GET /health & GET /api/health — Service health check
router.get(['/health', '/api/health'], (req, res) => {
    res.json({
        status: 'ok',
        service: 'probe-engine',
        dbConnected: isDbConnected(),
        hypertable: isHypertableSupported(),
        redisConnected: isRedisConnected(),
        probeIntervalMs: getCurrentInterval(),
        latencySlaMs: LATENCY_SLA_THRESHOLD_MS,
        activeTargets: targets.length,
        bufferedMetrics: getMetricsBuffer().length,
        sseClients: getActiveClientCount(),
    });
});

// GET /api/metrics — Raw metric list
router.get('/metrics', async (req, res) => {
    const { target_id, limit = 100 } = req.query;
    if (isDbConnected()) {
        try {
            let query = 'SELECT * FROM metrics ORDER BY time DESC LIMIT $1';
            let params = [limit];
            if (target_id) {
                query = 'SELECT * FROM metrics WHERE target_id = $1 ORDER BY time DESC LIMIT $2';
                params = [target_id, limit];
            }
            const result = await pool.query(query, params);
            return res.json(result.rows);
        } catch (err) {
            console.error('Query error:', err.message);
        }
    }
    let filtered = [...getMetricsBuffer()].reverse();
    if (target_id) filtered = filtered.filter((m) => m.target_id === target_id);
    res.json(filtered.slice(0, limit));
});

// GET /api/metrics/aggregate — Aggregated Telemetry with P50, P90, P99 Percentiles & Redis Caching
router.get('/metrics/aggregate', async (req, res) => {
    const { target_id, interval = '1 minute', range = '1 hour' } = req.query;
    const cacheKey = `probe_aggregate:${target_id || 'all'}:${interval}:${range}`;

    // 1. Check Redis Cache (5-second TTL)
    const cached = await getCache(cacheKey);
    if (cached) {
        return res.json(cached);
    }

    if (isDbConnected()) {
        try {
            let query = '';
            if (isHypertableSupported()) {
                query = `
                    SELECT
                        time_bucket($1::interval, time) AS bucket,
                        target_id,
                        AVG(latency_ms) AS avg_latency,
                        MAX(latency_ms) AS max_latency,
                        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY latency_ms) AS p50_latency,
                        PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY latency_ms) AS p90_latency,
                        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) AS p99_latency,
                        COUNT(*) FILTER (WHERE is_error) AS error_count,
                        COUNT(*) AS total_probes,
                        COALESCE((COUNT(*) FILTER (WHERE is_error))::float / NULLIF(COUNT(*), 0), 0) AS error_rate
                    FROM metrics
                    WHERE time > NOW() - $2::interval
                        AND ($3::text IS NULL OR target_id = $3)
                    GROUP BY bucket, target_id
                    ORDER BY bucket DESC
                `;
            } else {
                query = `
                    SELECT
                        date_trunc('minute', time) AS bucket,
                        target_id,
                        AVG(latency_ms) AS avg_latency,
                        MAX(latency_ms) AS max_latency,
                        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY latency_ms) AS p50_latency,
                        PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY latency_ms) AS p90_latency,
                        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) AS p99_latency,
                        COUNT(*) FILTER (WHERE is_error) AS error_count,
                        COUNT(*) AS total_probes,
                        COALESCE((COUNT(*) FILTER (WHERE is_error))::float / NULLIF(COUNT(*), 0), 0) AS error_rate
                    FROM metrics
                    WHERE time > NOW() - $2::interval
                        AND ($3::text IS NULL OR target_id = $3)
                    GROUP BY bucket, target_id
                    ORDER BY bucket DESC
                `;
            }

            const result = await pool.query(query, [interval, range, target_id || null]);

            // Cache result in Redis for 5 seconds
            await setCache(cacheKey, result.rows, 5);
            return res.json(result.rows);
        } catch (err) {
            console.error('Aggregate query error:', err.message);
        }
    }

    res.json([]);
});

// GET /api/metrics/summary — Real-time Health Summary with P50/P90/P99 & SLA Status
router.get('/metrics/summary', async (req, res) => {
    const cacheKey = 'probe_summary:5m';
    const cached = await getCache(cacheKey);
    if (cached) {
        return res.json(cached);
    }

    if (isDbConnected()) {
        try {
            const query = `
                SELECT
                    target_id,
                    AVG(latency_ms) AS avg_latency,
                    MAX(latency_ms) AS max_latency,
                    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY latency_ms) AS p50_latency,
                    PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY latency_ms) AS p90_latency,
                    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) AS p99_latency,
                    COUNT(*) FILTER (WHERE is_error) AS error_count,
                    COUNT(*) AS total_probes,
                    COALESCE((COUNT(*) FILTER (WHERE is_error))::float / NULLIF(COUNT(*), 0), 0) AS error_rate
                FROM metrics
                WHERE time > NOW() - INTERVAL '5 minutes'
                GROUP BY target_id
            `;
            const result = await pool.query(query);
            const summary = result.rows.map((row) => {
                const failures = consecutiveFailuresMap.get(row.target_id) || 0;
                const highLatencyCount = highLatencyCountMap.get(row.target_id) || 0;

                let status = 'HEALTHY';
                if (failures >= FAILURE_ALERT_THRESHOLD || row.error_rate > 0.2 || row.avg_latency > 2000) {
                    status = 'CRITICAL';
                } else if (highLatencyCount >= 2 || row.error_rate > 0.05 || row.avg_latency > 500) {
                    status = 'WARNING';
                }
                return {
                    ...row,
                    consecutiveFailures: failures,
                    highLatencyCount,
                    status,
                };
            });

            await setCache(cacheKey, summary, 5);
            return res.json(summary);
        } catch (err) {
            console.error('Summary query error:', err.message);
        }
    }
    res.json([]);
});

// GET /api/metrics/triggers — Query Trigger History from DB table probe_triggers
router.get('/metrics/triggers', async (req, res) => {
    const { limit = 50 } = req.query;
    if (isDbConnected()) {
        try {
            const result = await pool.query('SELECT * FROM probe_triggers ORDER BY timestamp DESC LIMIT $1', [limit]);
            return res.json(result.rows);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }
    res.json([]);
});

// GET /api/metrics/stream — Server-Sent Events (SSE) Live Stream Endpoint
router.get('/metrics/stream', (req, res) => {
    addSseClient(req, res);
});

module.exports = router;
