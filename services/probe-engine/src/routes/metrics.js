const express = require('express');
const router = express.Router();
const { pool, isDbConnected, isHypertableSupported, getMetricsBuffer } = require('../config/db');
const { targets, consecutiveFailuresMap, FAILURE_ALERT_THRESHOLD, getCurrentInterval } = require('../services/prober');
const { addSseClient, getActiveClientCount } = require('../services/stream');

// GET /health — Service health check
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'probe-engine',
        dbConnected: isDbConnected(),
        hypertable: isHypertableSupported(),
        probeIntervalMs: getCurrentInterval(),
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

// GET /api/metrics/aggregate — Primary telemetry API consumed by Capacity Advisor
router.get('/metrics/aggregate', async (req, res) => {
    const { target_id, interval = '1 minute', range = '1 hour' } = req.query;

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
            return res.json(result.rows);
        } catch (err) {
            console.error('Aggregate query error:', err.message);
        }
    }

    res.json([]);
});

// GET /api/metrics/summary — Real-time Health Status Summary per target
router.get('/metrics/summary', async (req, res) => {
    if (isDbConnected()) {
        try {
            const query = `
                SELECT
                    target_id,
                    AVG(latency_ms) AS avg_latency,
                    MAX(latency_ms) AS max_latency,
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
                let status = 'HEALTHY';
                if (failures >= FAILURE_ALERT_THRESHOLD || row.error_rate > 0.2 || row.avg_latency > 2000) {
                    status = 'CRITICAL';
                } else if (row.error_rate > 0.05 || row.avg_latency > 500) {
                    status = 'WARNING';
                }
                return { ...row, consecutiveFailures: failures, status };
            });
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

// GET /api/metrics/stream — Server-Sent Events (SSE) Live Stream Endpoint for Admin Dashboard
router.get('/metrics/stream', (req, res) => {
    addSseClient(req, res);
});

module.exports = router;
