const express = require('express');
const cors = require('cors');
const config = require('./config');
const db = require('./db');
const {
    runAdvisorLoop,
    startAdvisorScheduler,
    stopAdvisorScheduler,
    getAdvisorStatus,
} = require('./advisor');

const app = express();

app.use(cors());
app.use(express.json());

// ============================================
// REST API Endpoints
// ============================================

// 1. Health & Status
app.get('/health', (req, res) => {
    const dbStatus = db.getStatus();
    const advisorStatus = getAdvisorStatus();

    res.json({
        status: dbStatus.connected ? 'ok' : 'degraded',
        service: 'capacity-advisor',
        port: config.PORT,
        database: dbStatus,
        probeEngineUrl: config.PROBE_ENGINE_URL,
        gatewayUrl: config.GATEWAY_URL,
        advisor: advisorStatus,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

// 2. Retrieve Decision History
app.get('/api/advisor/decisions', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 50;
        const decisions = await db.getDecisions(limit);
        res.json(decisions);
    } catch (err) {
        console.error('❌ Error fetching decisions:', err.message);
        res.status(500).json({ error: 'Failed to retrieve advisor decisions', details: err.message });
    }
});

// 3. Trigger Immediate Manual Analysis Tick (Fetches from probe-engine and updates gateway)
app.post('/api/advisor/trigger', async (req, res) => {
    try {
        console.log('⚡ [ADVISOR] Manual trigger requested via /api/advisor/trigger');
        const result = await runAdvisorLoop();
        res.json({
            message: 'Manual advisor analysis triggered',
            ...result,
        });
    } catch (err) {
        console.error('❌ Error triggering advisor loop:', err.message);
        res.status(500).json({ error: 'Failed to trigger advisor loop', details: err.message });
    }
});

// 4. Ad-hoc Analysis with provided metrics payload
app.post('/api/advisor/analyze', async (req, res) => {
    try {
        const { metricsData } = req.body;
        const result = await runAdvisorLoop({ providedMetrics: metricsData });
        res.json(result);
    } catch (err) {
        console.error('❌ Error in /api/advisor/analyze:', err.message);
        res.status(500).json({ error: 'Failed to analyze metrics', details: err.message });
    }
});

// 5. Advisor Status and Config Details
app.get('/api/advisor/status', (req, res) => {
    res.json(getAdvisorStatus());
});

// ============================================
// Server Lifecycle & Startup
// ============================================
let server = null;

async function startServer() {
    try {
        // Attempt PostgreSQL initialization with retry loop
        try {
            await db.initDB();
        } catch (dbErr) {
            console.warn('⚠️ [STARTUP] Running server in degraded mode (DB disconnected).');
        }

        // Start listening
        server = app.listen(config.PORT, () => {
            console.log(`🧠 [STARTUP] Capacity Advisor running on port ${config.PORT}`);
            console.log(`   Config: Probe Engine = ${config.PROBE_ENGINE_URL}`);
            console.log(`   Config: Traffic Gateway = ${config.GATEWAY_URL}`);
            console.log(`   Config: Check Interval = ${config.ADVISOR_CHECK_INTERVAL_MS}ms`);
            console.log(`   Config: Window Size = ${config.ADVISOR_WINDOW_SIZE}`);
            console.log(`   Config: Batch Size Bounds = [${config.MIN_BATCH_SIZE}, ${config.MAX_BATCH_SIZE}]`);

            // Start autonomous feedback loop
            startAdvisorScheduler(config.ADVISOR_CHECK_INTERVAL_MS);
        });
    } catch (err) {
        console.error('❌ [STARTUP] Fatal error starting server:', err.message);
        process.exit(1);
    }
}

// Graceful shutdown
async function gracefulShutdown(signal) {
    console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
    stopAdvisorScheduler();

    if (server) {
        server.close(() => {
            console.log('HTTP server closed.');
        });
    }

    try {
        await db.close();
        console.log('Database connections closed.');
    } catch (e) {
        // ignore
    }

    process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (require.main === module) {
    startServer();
}

module.exports = { app, startServer };
