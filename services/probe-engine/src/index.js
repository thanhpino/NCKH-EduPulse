require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { initDB, pool, isDbConnected } = require('./config/db');
const { targets, startProbing, stopProbing } = require('./services/prober');
const { startDiscoveryLoop, stopDiscoveryLoop } = require('./services/discovery');

const metricsRouter = require('./routes/metrics');
const targetsRouter = require('./routes/targets');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

// Wire modular routes under /api and root /health
app.use('/api', metricsRouter);
app.use('/api', targetsRouter);
app.get('/health', (req, res) => res.redirect('/api/health'));

// ============================================
// Graceful Shutdown Handler
// ============================================
async function gracefulShutdown(signal) {
    console.log(`\n🛑 Received ${signal}. Initiating Graceful Shutdown of Probe Engine...`);

    // 1. Stop probing & discovery timers
    stopProbing();
    stopDiscoveryLoop();

    // 2. Drain PostgreSQL pool connection
    if (isDbConnected()) {
        try {
            console.log('🔌 Closing PostgreSQL pool connections...');
            await pool.end();
            console.log('✅ PostgreSQL pool connections closed safely.');
        } catch (err) {
            console.error('Error closing Postgres pool:', err.message);
        }
    }

    console.log('👋 Probe Engine shut down gracefully.');
    process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// ============================================
// Start Microservice
// ============================================
initDB()
    .then(() => {
        startDiscoveryLoop(targets);
        startProbing();
        app.listen(PORT, () => {
            console.log(`🔍 Probe Engine (Modular Edition) running on port ${PORT}`);
            console.log(`   TimescaleDB: ${process.env.TIMESCALE_URL || 'postgres://probe:probe_pass@localhost:5432/edupulse_metrics'}`);
            console.log(`   Health Check: http://localhost:${PORT}/health`);
            console.log(`   Live SSE Stream: http://localhost:${PORT}/api/metrics/stream`);
        });
    })
    .catch((err) => {
        console.error('❌ Critical startup error:', err.message);
        process.exit(1);
    });
