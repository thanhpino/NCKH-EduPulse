require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3003;
const TIMESCALE_URL = process.env.TIMESCALE_URL || 'postgres://probe:probe_pass@localhost:5432/edupulse_metrics';
const PROBE_INTERVAL = parseInt(process.env.PROBE_INTERVAL_MS) || 5000;

app.use(cors());
app.use(express.json());

const pool = new Pool({ connectionString: TIMESCALE_URL });

// ============================================
// Init TimescaleDB table
// ============================================
async function initDB() {
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

    // Create hypertable (TimescaleDB) — will fail gracefully on regular PostgreSQL
    try {
        await pool.query(`SELECT create_hypertable('metrics', 'time', if_not_exists => TRUE);`);
        console.log('📊 TimescaleDB hypertable created');
    } catch (err) {
        console.log('ℹ️  Hypertable already exists or not using TimescaleDB');
    }
}

// ============================================
// Probe function — measure target health
// ============================================
async function probeTarget(target) {
    const start = Date.now();
    try {
        const response = await axios.get(target.url + (target.healthEndpoint || '/health'), {
            timeout: 10000,
        });
        const latency = Date.now() - start;

        await pool.query(
            'INSERT INTO metrics (target_id, target_url, latency_ms, status_code, is_error) VALUES ($1, $2, $3, $4, $5)',
            [target.id, target.url, latency, response.status, false]
        );

        return { latency, statusCode: response.status, error: null };
    } catch (err) {
        const latency = Date.now() - start;
        await pool.query(
            'INSERT INTO metrics (target_id, target_url, latency_ms, status_code, is_error, error_msg) VALUES ($1, $2, $3, $4, $5, $6)',
            [target.id, target.url, latency, err.response?.status || 0, true, err.message]
        );

        return { latency, statusCode: err.response?.status || 0, error: err.message };
    }
}

// ============================================
// Probe loop — adaptive interval
// ============================================
let probeInterval = null;
let targets = [];

function startProbing() {
    if (probeInterval) clearInterval(probeInterval);

    probeInterval = setInterval(async () => {
        for (const target of targets) {
            const result = await probeTarget(target);
            console.log(`🔍 Probe ${target.url}: ${result.latency}ms | ${result.error ? '❌ ' + result.error : '✅ OK'}`);
        }
    }, PROBE_INTERVAL);
}

// ============================================
// Routes
// ============================================

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'probe-engine', activeTargets: targets.length });
});

// Register a target to probe
app.post('/api/probe/targets', (req, res) => {
    const { id, url, healthEndpoint } = req.body;
    targets.push({ id, url, healthEndpoint });
    console.log(`➕ Added probe target: ${url}`);
    res.status(201).json({ message: 'Target added', targets });
});

// Get recent metrics
app.get('/api/metrics', async (req, res) => {
    try {
        const { target_id, limit = 100 } = req.query;
        let query = 'SELECT * FROM metrics ORDER BY time DESC LIMIT $1';
        let params = [limit];

        if (target_id) {
            query = 'SELECT * FROM metrics WHERE target_id = $1 ORDER BY time DESC LIMIT $2';
            params = [target_id, limit];
        }

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get aggregated metrics (for dashboard charts)
app.get('/api/metrics/aggregate', async (req, res) => {
    try {
        const { target_id, interval = '1 minute', range = '1 hour' } = req.query;

        const result = await pool.query(`
      SELECT
        time_bucket($1::interval, time) AS bucket,
        target_id,
        AVG(latency_ms) AS avg_latency,
        MAX(latency_ms) AS max_latency,
        COUNT(*) FILTER (WHERE is_error) AS error_count,
        COUNT(*) AS total_probes,
        (COUNT(*) FILTER (WHERE is_error))::float / NULLIF(COUNT(*), 0) AS error_rate
      FROM metrics
      WHERE time > NOW() - $2::interval
        AND ($3::text IS NULL OR target_id = $3)
      GROUP BY bucket, target_id
      ORDER BY bucket DESC
    `, [interval, range, target_id || null]);

        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// Start
// ============================================
initDB()
    .then(() => {
        console.log('📊 Metrics DB initialized');
        startProbing();
        app.listen(PORT, () => {
            console.log(`🔍 Probe Engine running on port ${PORT}`);
            console.log(`   Probe interval: ${PROBE_INTERVAL}ms`);
        });
    })
    .catch((err) => {
        console.error('❌ DB init error:', err.message);
        process.exit(1);
    });
