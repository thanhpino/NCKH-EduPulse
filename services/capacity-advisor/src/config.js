require('dotenv').config();

module.exports = {
    PORT: parseInt(process.env.PORT, 10) || 3004,
    DATABASE_URL: process.env.DATABASE_URL || 'postgres://advisor:advisor_pass@postgres-advisor:5432/edupulse_advisor',
    PROBE_ENGINE_URL: process.env.PROBE_ENGINE_URL || 'http://probe-engine:3003',
    GATEWAY_URL: process.env.GATEWAY_URL || 'http://traffic-gateway:3002',
    ADVISOR_CHECK_INTERVAL_MS: parseInt(process.env.ADVISOR_CHECK_INTERVAL_MS, 10) || 15000,
    ADVISOR_WINDOW_SIZE: parseInt(process.env.ADVISOR_WINDOW_SIZE, 10) || 15,
    MIN_BATCH_SIZE: parseInt(process.env.MIN_BATCH_SIZE, 10) || 5,
    MAX_BATCH_SIZE: parseInt(process.env.MAX_BATCH_SIZE, 10) || 200,
    DB_MAX_RETRIES: parseInt(process.env.DB_MAX_RETRIES, 10) || 10,
    DB_RETRY_DELAY_MS: parseInt(process.env.DB_RETRY_DELAY_MS, 10) || 2000,
};
