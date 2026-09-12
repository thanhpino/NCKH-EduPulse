const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const config = require('./config');

const SCHEMA_PATH = path.join(__dirname, '../sql/schema.sql');

const pool = new Pool({
    connectionString: config.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

let isConnected = false;

/**
 * Initialize PostgreSQL connection with retry backoff loop
 * @param {number} retries - Number of connection attempts (default from config)
 * @param {number} delayMs - Delay between attempts in ms
 */
async function initDB(retries = config.DB_MAX_RETRIES, delayMs = config.DB_RETRY_DELAY_MS) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`🔌 [DB] Connecting to postgres-advisor (attempt ${attempt}/${retries})...`);
            await pool.query('SELECT 1');

            if (fs.existsSync(SCHEMA_PATH)) {
                const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
                await pool.query(schemaSql);
            } else {
                console.warn(`⚠️ [DB] Schema file not found at ${SCHEMA_PATH}. Skipping schema execution.`);
            }

            isConnected = true;
            console.log('✅ [DB] Connected to PostgreSQL (postgres-advisor) & verified schema from schema.sql.');
            return pool;
        } catch (err) {
            console.error(`❌ [DB] Connection attempt ${attempt} failed: ${err.message}`);
            if (attempt === retries) {
                console.warn('⚠️ [DB] Unable to connect to PostgreSQL after max retries. Running in degraded state.');
                isConnected = false;
                throw err;
            }
            await new Promise((res) => setTimeout(res, delayMs));
        }
    }
}

/**
 * Persist an advisor decision to the database
 */
async function recordDecision({
    avgLatency,
    errorRate,
    instantGradient,
    trendSlope,
    action,
    oldBatchSize,
    newBatchSize,
    reason,
}) {
    if (!isConnected) {
        console.warn('⚠️ [DB] Cannot record decision: DB is not connected');
        return null;
    }

    const query = `
        INSERT INTO advisor_decisions 
        (avg_latency, error_rate, instant_gradient, trend_slope, action, old_batch_size, new_batch_size, reason) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *;
    `;

    const values = [
        avgLatency ?? null,
        errorRate ?? null,
        instantGradient ?? null,
        trendSlope ?? null,
        action,
        oldBatchSize,
        newBatchSize,
        reason,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
}

/**
 * Retrieve recent decisions
 */
async function getDecisions(limit = 50) {
    if (!isConnected) {
        return [];
    }

    const query = 'SELECT * FROM advisor_decisions ORDER BY timestamp DESC LIMIT $1';
    const result = await pool.query(query, [limit]);
    return result.rows;
}

/**
 * Get latest decision
 */
async function getLatestDecision() {
    if (!isConnected) {
        return null;
    }

    const query = 'SELECT * FROM advisor_decisions ORDER BY timestamp DESC LIMIT 1';
    const result = await pool.query(query);
    return result.rows[0] || null;
}

function getStatus() {
    return {
        connected: isConnected,
        databaseUrl: config.DATABASE_URL.replace(/:[^:@]+@/, ':***@'),
    };
}

async function close() {
    await pool.end();
    isConnected = false;
}

module.exports = {
    pool,
    initDB,
    recordDecision,
    getDecisions,
    getLatestDecision,
    getStatus,
    close,
};
