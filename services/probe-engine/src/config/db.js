const { Pool } = require('pg');

const TIMESCALE_URL = process.env.TIMESCALE_URL || 'postgres://probe:probe_pass@localhost:5432/edupulse_metrics';

const pool = new Pool({
    connectionString: TIMESCALE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

const metricsBuffer = [];
const MAX_BUFFER_SIZE = 500;
let dbConnected = false;
let hypertableSupported = true;

async function initDB(retries = 10, delay = 2000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`🔌 Connecting to TimescaleDB (attempt ${attempt}/${retries})...`);
            await pool.query('SELECT 1');

            // Verify hypertable support status
            try {
                const res = await pool.query("SELECT * FROM pg_extension WHERE extname = 'timescaledb'");
                hypertableSupported = res.rows.length > 0;
            } catch (e) {
                hypertableSupported = false;
            }

            dbConnected = true;
            console.log(`✅ Connected to TimescaleDB successfully! (Hypertable: ${hypertableSupported ? 'Active' : 'Standby/Standard'})`);

            await flushMetricsBuffer();
            return;
        } catch (err) {
            console.error(`❌ DB connection attempt ${attempt} failed: ${err.message}`);
            if (attempt === retries) {
                console.warn('⚠️ Could not connect to TimescaleDB. Operating in in-memory buffer fallback mode.');
                dbConnected = false;
            } else {
                await new Promise((res) => setTimeout(res, delay));
            }
        }
    }
}

async function flushMetricsBuffer() {
    if (!dbConnected || metricsBuffer.length === 0) return;

    console.log(`🔄 Flushing ${metricsBuffer.length} buffered metrics to TimescaleDB...`);
    const items = metricsBuffer.splice(0, metricsBuffer.length);

    for (const item of items) {
        try {
            await pool.query(
                'INSERT INTO metrics (time, target_id, target_url, latency_ms, status_code, is_error, error_type, error_msg) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                [item.time, item.target_id, item.target_url, item.latency_ms, item.status_code, item.is_error, item.error_type, item.error_msg]
            );
        } catch (e) {
            console.error('Failed to flush buffered metric to DB:', e.message);
        }
    }
}

async function recordMetric({ target_id, target_url, latency_ms, status_code, is_error, error_type = null, error_msg = null }) {
    const time = new Date();
    if (dbConnected) {
        try {
            await pool.query(
                'INSERT INTO metrics (time, target_id, target_url, latency_ms, status_code, is_error, error_type, error_msg) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                [time, target_id, target_url, latency_ms, status_code, is_error, error_type, error_msg]
            );
            return;
        } catch (err) {
            console.error(`❌ DB write error: ${err.message}. Saving to in-memory buffer.`);
            dbConnected = false;
        }
    }

    if (metricsBuffer.length >= MAX_BUFFER_SIZE) {
        metricsBuffer.shift();
    }
    metricsBuffer.push({ time, target_id, target_url, latency_ms, status_code, is_error, error_type, error_msg });
}

async function recordTriggerEvent({ target_id, target_url, trigger_type, severity, consecutive_failures, error_type, error_msg, payload = {} }) {
    if (dbConnected) {
        try {
            await pool.query(
                `INSERT INTO probe_triggers 
                (target_id, target_url, trigger_type, severity, consecutive_failures, error_type, error_msg, payload) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [target_id, target_url, trigger_type, severity, consecutive_failures, error_type, error_msg, JSON.stringify(payload)]
            );
            console.log(`💾 Trigger event persisted to DB table [probe_triggers]: ${target_id} (${trigger_type})`);
        } catch (err) {
            console.error('Failed to persist trigger event to DB table [probe_triggers]:', err.message);
        }
    }
}

module.exports = {
    pool,
    initDB,
    recordMetric,
    recordTriggerEvent,
    flushMetricsBuffer,
    getMetricsBuffer: () => metricsBuffer,
    isDbConnected: () => dbConnected,
    isHypertableSupported: () => hypertableSupported,
};
