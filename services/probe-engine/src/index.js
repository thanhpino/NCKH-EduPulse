require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const axios = require('axios');
const cors = require('cors');
const http = require('http');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3003;
const TIMESCALE_URL = process.env.TIMESCALE_URL || 'postgres://probe:probe_pass@localhost:5432/edupulse_metrics';
const REGISTRY_SERVICE_URL = process.env.REGISTRY_SERVICE_URL || 'http://localhost:3001';

app.use(cors());
app.use(express.json());

// Optimized HTTP Agent for high-frequency probing (avoids socket exhaustion)
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });
const axiosClient = axios.create({
    httpAgent,
    httpsAgent,
    timeout: 8000,
});

const pool = new Pool({
    connectionString: TIMESCALE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

// In-Memory Ring Buffer for metrics when TimescaleDB is temporarily down
const metricsBuffer = [];
const MAX_BUFFER_SIZE = 500;
let isDbConnected = false;
let isHypertableSupported = true;

// ============================================
// Init TimescaleDB with Retry & Fallback
// ============================================
async function initDB(retries = 10, delay = 2000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`🔌 Connecting to TimescaleDB (attempt ${attempt}/${retries})...`);
            await pool.query('SELECT 1');

            await pool.query(`
                CREATE TABLE IF NOT EXISTS metrics (
                    time        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    target_id   TEXT NOT NULL,
                    target_url  TEXT NOT NULL,
                    latency_ms  DOUBLE PRECISION,
                    status_code INTEGER,
                    is_error    BOOLEAN DEFAULT FALSE,
                    error_msg   TEXT
                );
            `);

            // Create hypertable (TimescaleDB)
            try {
                await pool.query(`SELECT create_hypertable('metrics', 'time', if_not_exists => TRUE);`);
                console.log('📊 TimescaleDB hypertable verified/created');
                isHypertableSupported = true;
            } catch (err) {
                console.log('ℹ️ TimescaleDB hypertable not available, falling back to standard Postgres indexing');
                isHypertableSupported = false;
                await pool.query(`CREATE INDEX IF NOT EXISTS idx_metrics_target_time ON metrics (target_id, time DESC);`);
            }

            isDbConnected = true;
            console.log('✅ Connected to TimescaleDB successfully!');

            // Flush any buffered metrics
            flushMetricsBuffer();
            return;
        } catch (err) {
            console.error(`❌ DB init attempt ${attempt} failed: ${err.message}`);
            if (attempt === retries) {
                console.warn('⚠️ Could not connect to TimescaleDB. Running in memory-buffer fallback mode.');
                isDbConnected = false;
            } else {
                await new Promise((res) => setTimeout(res, delay));
            }
        }
    }
}

// Flush buffered metrics into DB when connection restores
async function flushMetricsBuffer() {
    if (!isDbConnected || metricsBuffer.length === 0) return;

    console.log(`🔄 Flushing ${metricsBuffer.length} buffered metrics to TimescaleDB...`);
    const items = metricsBuffer.splice(0, metricsBuffer.length);

    for (const item of items) {
        try {
            await pool.query(
                'INSERT INTO metrics (time, target_id, target_url, latency_ms, status_code, is_error, error_msg) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [item.time, item.target_id, item.target_url, item.latency_ms, item.status_code, item.is_error, item.error_msg]
            );
        } catch (e) {
            console.error('Failed to flush item to DB:', e.message);
        }
    }
}

// Save metric to DB or Buffer
async function recordMetric({ target_id, target_url, latency_ms, status_code, is_error, error_msg = null }) {
    const time = new Date();
    if (isDbConnected) {
        try {
            await pool.query(
                'INSERT INTO metrics (time, target_id, target_url, latency_ms, status_code, is_error, error_msg) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [time, target_id, target_url, latency_ms, status_code, is_error, error_msg]
            );
            return;
        } catch (err) {
            console.error(`❌ DB write error: ${err.message}. Saving to buffer.`);
            isDbConnected = false;
        }
    }

    // Buffer fallback
    if (metricsBuffer.length >= MAX_BUFFER_SIZE) {
        metricsBuffer.shift(); // Drop oldest
    }
    metricsBuffer.push({ time, target_id, target_url, latency_ms, status_code, is_error, error_msg });
}

// ============================================
// Targets Management & Default Seeding
// ============================================
let targets = [
    {
        id: 'traffic-gateway',
        url: process.env.GATEWAY_URL || 'http://localhost:3002',
        healthEndpoint: '/health',
    },
    {
        id: 'mock-backend',
        url: process.env.MOCK_BACKEND_URL || 'http://localhost:3010',
        healthEndpoint: '/health',
    },
    {
        id: 'registry-service',
        url: REGISTRY_SERVICE_URL,
        healthEndpoint: '/health',
    },
];

async function discoverTargets() {
    try {
        const res = await axiosClient.get(`${REGISTRY_SERVICE_URL}/api/services`);
        if (Array.isArray(res.data) && res.data.length > 0) {
            const discovered = res.data.map((s) => ({
                id: s.serviceName || s.id,
                url: s.url || `http://${s.host}:${s.port}`,
                healthEndpoint: s.healthEndpoint || '/health',
            }));

            // Merge with existing target list
            discovered.forEach((d) => {
                if (!targets.some((t) => t.id === d.id)) {
                    targets.push(d);
                    console.log(`🔍 Discovered target from Registry: ${d.id} (${d.url})`);
                }
            });
        }
    } catch (err) {
        // Registry Service down or not available — keep default targets
    }
}

// ============================================
// Probe Function (Fault Tolerant & Concurrency)
// ============================================
async function probeTarget(target) {
    const start = Date.now();
    const probeUrl = target.url.endsWith('/')
        ? `${target.url}${target.healthEndpoint.replace(/^\//, '')}`
        : `${target.url}${target.healthEndpoint}`;

    try {
        const response = await axiosClient.get(probeUrl);
        const latency = Date.now() - start;

        await recordMetric({
            target_id: target.id,
            target_url: target.url,
            latency_ms: latency,
            status_code: response.status,
            is_error: false,
        });

        return { id: target.id, latency, statusCode: response.status, error: null };
    } catch (err) {
        const latency = Date.now() - start;
        const statusCode = err.response?.status || 0;
        const errorMsg = err.message || 'Connection refused or timeout';

        await recordMetric({
            target_id: target.id,
            target_url: target.url,
            latency_ms: latency,
            status_code: statusCode,
            is_error: true,
            error_msg: errorMsg,
        });

        return { id: target.id, latency, statusCode, error: errorMsg };
    }
}

// Single probe tick — runs all targets in parallel
async function runProbeCycle() {
    const results = await Promise.allSettled(targets.map(probeTarget));
    const summary = results.map((r) => {
        if (r.status === 'fulfilled') {
            const val = r.value;
            return `${val.id}: ${val.latency}ms [${val.error ? '❌ ' + val.error : '✅ OK'}]`;
        }
        return `Target failed`;
    });
    console.log(`🔍 Probe Cycle (${new Date().toLocaleTimeString()}): ${summary.join(' | ')}`);
}

// ============================================
// Adaptive Probe Loop
// ============================================
let probeIntervalTimer = null;
let currentIntervalMs = parseInt(process.env.PROBE_INTERVAL_MS) || 5000;

function startProbing(intervalMs = currentIntervalMs) {
    if (probeIntervalTimer) clearInterval(probeIntervalTimer);

    currentIntervalMs = intervalMs;
    console.log(`⚙️ Probing loop running every ${currentIntervalMs}ms`);

    // Initial probe cycle right away
    runProbeCycle();

    probeIntervalTimer = setInterval(() => {
        runProbeCycle();
    }, currentIntervalMs);
}

// ============================================
// REST API Endpoints
// ============================================

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'probe-engine',
        dbConnected: isDbConnected,
        hypertable: isHypertableSupported,
        probeIntervalMs: currentIntervalMs,
        activeTargets: targets.length,
        bufferedMetrics: metricsBuffer.length,
    });
});

// List monitored targets
app.get('/api/targets', (req, res) => {
    res.json({ targets, total: targets.length });
});

// Add a new probe target
app.post('/api/probe/targets', (req, res) => {
    const { id, url, healthEndpoint = '/health' } = req.body;
    if (!id || !url) {
        return res.status(400).json({ error: 'Missing required fields: id, url' });
    }

    // Replace or add
    const idx = targets.findIndex((t) => t.id === id);
    if (idx >= 0) {
        targets[idx] = { id, url, healthEndpoint };
    } else {
        targets.push({ id, url, healthEndpoint });
    }

    console.log(`➕ Monitored target updated: ${id} -> ${url}`);
    res.status(201).json({ message: 'Target added/updated', targets });
});

// Remove a target
app.delete('/api/probe/targets/:id', (req, res) => {
    const { id } = req.params;
    targets = targets.filter((t) => t.id !== id);
    res.json({ message: `Target ${id} removed`, targets });
});

// Update probing configuration dynamically (Adaptive interval)
app.put('/api/probe/config', (req, res) => {
    const { intervalMs } = req.body;
    if (intervalMs && typeof intervalMs === 'number' && intervalMs >= 500) {
        startProbing(intervalMs);
        return res.json({ message: 'Probing interval updated', probeIntervalMs: currentIntervalMs });
    }
    res.status(400).json({ error: 'Invalid intervalMs (must be number >= 500)' });
});

// Get recent raw metrics
app.get('/api/metrics', async (req, res) => {
    const { target_id, limit = 100 } = req.query;
    if (isDbConnected) {
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
    // Fallback to in-memory buffer
    let filtered = [...metricsBuffer].reverse();
    if (target_id) filtered = filtered.filter((m) => m.target_id === target_id);
    res.json(filtered.slice(0, limit));
});

// Get aggregated metrics (Primary API consumed by Capacity Advisor & Admin Dashboard)
app.get('/api/metrics/aggregate', async (req, res) => {
    const { target_id, interval = '1 minute', range = '1 hour' } = req.query;

    if (isDbConnected) {
        try {
            let query = '';
            if (isHypertableSupported) {
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

    // In-memory aggregate fallback
    res.json([]);
});

// Get real-time summary status per target (Green/Yellow/Red indicators)
app.get('/api/metrics/summary', async (req, res) => {
    if (isDbConnected) {
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
                let status = 'HEALTHY';
                if (row.error_rate > 0.2 || row.avg_latency > 2000) status = 'CRITICAL';
                else if (row.error_rate > 0.05 || row.avg_latency > 500) status = 'WARNING';
                return { ...row, status };
            });
            return res.json(summary);
        } catch (err) {
            console.error('Summary query error:', err.message);
        }
    }
    res.json([]);
});

// Trigger an immediate manual probe cycle
app.post('/api/probe/now', async (req, res) => {
    await runProbeCycle();
    res.json({ message: 'Manual probe cycle triggered' });
});

// ============================================
// Start Server
// ============================================
initDB()
    .then(() => {
        discoverTargets();
        startProbing();
        app.listen(PORT, () => {
            console.log(`🔍 Probe Engine running on port ${PORT}`);
            console.log(`   TimescaleDB: ${TIMESCALE_URL}`);
            console.log(`   Probing interval: ${currentIntervalMs}ms`);
        });
    })
    .catch((err) => {
        console.error('❌ Critical startup error:', err.message);
        process.exit(1);
    });
