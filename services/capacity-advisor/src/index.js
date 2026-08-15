require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3004;
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://advisor:advisor_pass@localhost:5433/edupulse_advisor';
const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3002';

// Algorithm config
const WINDOW_SIZE = parseInt(process.env.ADVISOR_WINDOW_SIZE) || 30; // data points
const SLOPE_THRESHOLD = parseFloat(process.env.ADVISOR_SLOPE_THRESHOLD) || 0.15;

app.use(cors());
app.use(express.json());

const pool = new Pool({ connectionString: DATABASE_URL });

// ============================================
// Init DB — store advisor decisions
// ============================================
async function initDB() {
    await pool.query(`
    CREATE TABLE IF NOT EXISTS advisor_decisions (
      id          SERIAL PRIMARY KEY,
      timestamp   TIMESTAMPTZ DEFAULT NOW(),
      avg_latency DOUBLE PRECISION,
      error_rate  DOUBLE PRECISION,
      slope       DOUBLE PRECISION,
      action      TEXT,
      old_rate    INTEGER,
      new_rate    INTEGER
    );
  `);
}

// ============================================
// Moving Average + Slope calculation
// ============================================
function calculateSlope(values) {
    if (values.length < 2) return 0;
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += values[i];
        sumXY += i * values[i];
        sumX2 += i * i;
    }
    return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
}

function movingAverage(values, windowSize) {
    if (values.length <= windowSize) return values.reduce((a, b) => a + b, 0) / values.length;
    const window = values.slice(-windowSize);
    return window.reduce((a, b) => a + b, 0) / window.length;
}

// ============================================
// Analyze & Decide — core advisor logic
// ============================================
async function analyzeAndDecide(metricsData) {
    const latencies = metricsData.map(m => m.avg_latency);
    const errorRates = metricsData.map(m => m.error_rate);

    const avgLatency = movingAverage(latencies, WINDOW_SIZE);
    const avgErrorRate = movingAverage(errorRates, WINDOW_SIZE);
    const latencySlope = calculateSlope(latencies.slice(-WINDOW_SIZE));

    let action = 'hold';
    let rateMultiplier = 1;

    if (latencySlope > SLOPE_THRESHOLD || avgErrorRate > 0.1) {
        // Trend: latency rising fast OR high error rate → slow down
        action = 'decrease';
        rateMultiplier = 0.7;
    } else if (latencySlope < -SLOPE_THRESHOLD && avgErrorRate < 0.02) {
        // Trend: latency dropping AND low error rate → speed up
        action = 'increase';
        rateMultiplier = 1.3;
    }

    return { avgLatency, avgErrorRate, latencySlope, action, rateMultiplier };
}

// ============================================
// Routes
// ============================================

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'capacity-advisor' });
});

// Trigger analysis (called by cron or manually)
app.post('/api/advisor/analyze', async (req, res) => {
    try {
        const { metricsData } = req.body;

        if (!metricsData || metricsData.length < 3) {
            return res.json({ action: 'hold', reason: 'Insufficient data points' });
        }

        const decision = await analyzeAndDecide(metricsData);

        if (decision.action !== 'hold') {
            // Get current rate from gateway
            const gatewayHealth = await axios.get(`${GATEWAY_URL}/health`);
            const currentRate = gatewayHealth.data.admissionRate;
            const newRate = Math.max(5, Math.round(currentRate * decision.rateMultiplier));

            // Apply new rate to gateway
            await axios.put(`${GATEWAY_URL}/api/config/admission-rate`, { rate: newRate });

            // Log decision
            await pool.query(
                'INSERT INTO advisor_decisions (avg_latency, error_rate, slope, action, old_rate, new_rate) VALUES ($1, $2, $3, $4, $5, $6)',
                [decision.avgLatency, decision.avgErrorRate, decision.latencySlope, decision.action, currentRate, newRate]
            );

            console.log(`🧠 Advisor: ${decision.action} admission rate ${currentRate} → ${newRate} (slope: ${decision.latencySlope.toFixed(4)})`);

            return res.json({
                ...decision,
                oldRate: currentRate,
                newRate,
                applied: true,
            });
        }

        res.json({ ...decision, applied: false });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get decision history
app.get('/api/advisor/decisions', async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        const result = await pool.query('SELECT * FROM advisor_decisions ORDER BY timestamp DESC LIMIT $1', [limit]);
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
        console.log('📊 Advisor DB initialized');
        app.listen(PORT, () => {
            console.log(`🧠 Capacity Advisor running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error('❌ DB init error:', err.message);
        process.exit(1);
    });
