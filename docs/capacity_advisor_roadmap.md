# 📋 Technical Specification & Development Roadmap for Capacity Advisor

**Project:** EduPulse Microservices Telemetry & Adaptive Traffic Shaping  
**Service:** `capacity-advisor` (Port 3004)  
**Branch:** `feature/capacity-advisor`  
**Target Branch:** `develop`  
**Author:** EduPulse Team Lead  

---

## 🎯 1. Architectural Principles & Microservices Boundary

To strictly follow the **Database-per-Service** architectural pattern and ensure zero merge conflicts:

- **Isolated Storage:** `capacity-advisor` owns its dedicated PostgreSQL database `edupulse_advisor` (port 5433 / internal 5432).
- **No Direct DB Access:** `capacity-advisor` **MUST NOT** access `probe-engine`'s TimescaleDB database directly. All metric telemetry must be fetched over HTTP REST API.
- **Single Responsibility:** `capacity-advisor` periodically consumes metrics from `probe-engine` (`GET /api/metrics/aggregate`), executes the **Dual-Layer Hybrid Algorithm**, updates `traffic-gateway` (`PUT /api/queue/config`), and logs decisions to its own database.

---

## ⚙️ 2. Environment Configuration

Define the following environment variables in `services/capacity-advisor/.env` or Docker environment:

```env
PORT=3004
DATABASE_URL=postgres://advisor:advisor_pass@postgres-advisor:5432/edupulse_advisor
PROBE_ENGINE_URL=http://probe-engine:3003
GATEWAY_URL=http://traffic-gateway:3002
ADVISOR_CHECK_INTERVAL_MS=15000
ADVISOR_WINDOW_SIZE=15
```

> **Note for Local Testing (outside Docker):**
> Use `DATABASE_URL=postgres://advisor:advisor_pass@localhost:5433/edupulse_advisor`, `PROBE_ENGINE_URL=http://localhost:3003`, `GATEWAY_URL=http://localhost:3002`.

---

## 🗄️ 3. Database Schema (`postgres-advisor`)

Initialize table `advisor_decisions` upon service startup with a **Retry Connection Backoff Loop** (up to 10 attempts):

```sql
CREATE TABLE IF NOT EXISTS advisor_decisions (
  id               SERIAL PRIMARY KEY,
  timestamp        TIMESTAMPTZ DEFAULT NOW(),
  avg_latency      DOUBLE PRECISION,
  error_rate       DOUBLE PRECISION,
  instant_gradient DOUBLE PRECISION,
  trend_slope      DOUBLE PRECISION,
  action           TEXT,
  old_batch_size   INTEGER,
  new_batch_size   INTEGER,
  reason           TEXT
);
```

---

## 🧠 4. Dual-Layer Hybrid Algorithm (Gradient + Linear Regression)

In `services/capacity-advisor/src/index.js`, implement the dual-layer decision engine combining **Instant Numerical Gradient** (for immediate spike handling) and **Linear Regression Slope** (for mid-term trend analysis):

```javascript
// Linear Regression Slope (Trend calculation over sliding window)
function calculateLinearSlope(values) {
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

// Dual-Layer Hybrid Decision Engine
function analyzeHybrid(metricsData) {
    if (!metricsData || metricsData.length < 2) {
        return { action: 'hold', reason: 'Insufficient metrics data points' };
    }

    const latest = metricsData[0]; // Latest metric point
    const prev = metricsData[1];   // Previous metric point

    const currentLatency = parseFloat(latest.avg_latency) || 0;
    const prevLatency = parseFloat(prev.avg_latency) || 0;
    const currentErrorRate = parseFloat(latest.error_rate) || 0;

    // Layer 1: Instant Numerical Gradient
    const instantGradient = currentLatency - prevLatency;

    // Layer 2: Linear Regression Trend Slope (recent 15 samples)
    const recentLatencies = metricsData.slice(0, 15).map(m => parseFloat(m.avg_latency) || 0).reverse();
    const trendSlope = calculateLinearSlope(recentLatencies);

    // ========================================================
    // DUAL-LAYER DECISION RULES
    // ========================================================

    // TIER 1: Emergency Brake (Instant Gradient / High Error Spike)
    if (instantGradient > 50 || currentErrorRate > 0.05) {
        return {
            currentLatency,
            currentErrorRate,
            instantGradient,
            trendSlope,
            action: 'decrease',
            multiplier: 0.7, // Reduce batchSize by 30%
            reason: `🚨 EMERGENCY: Instant Gradient Spike (${instantGradient.toFixed(1)}ms) or Error Rate (${(currentErrorRate * 100).toFixed(1)}%)`
        };
    }

    // TIER 2: Mid-term Trend Adjustment (Linear Regression)
    if (trendSlope > 0.1) {
        return {
            currentLatency,
            currentErrorRate,
            instantGradient,
            trendSlope,
            action: 'decrease',
            multiplier: 0.85, // Gently reduce batchSize by 15%
            reason: `⚠️ TREND: Latency slope rising steadily (${trendSlope.toFixed(3)})`
        };
    } else if (trendSlope < -0.1 && instantGradient <= 0 && currentLatency < 250) {
        return {
            currentLatency,
            currentErrorRate,
            instantGradient,
            trendSlope,
            action: 'increase',
            multiplier: 1.25, // Increase batchSize by 25%
            reason: `🚀 RECOVERY: Latency slope dropping & system healthy (${currentLatency.toFixed(0)}ms)`
        };
    }

    // TIER 3: Optimal Zone
    return {
        currentLatency,
        currentErrorRate,
        instantGradient,
        trendSlope,
        action: 'hold',
        multiplier: 1.0,
        reason: '✅ STABLE: System operating in optimal zone'
    };
}
```

---

## 🔄 5. Automated Feedback Loop & Gateway Contract

Automate the feedback loop with `setInterval` executing every 15 seconds:

```javascript
async function runAdvisorLoop() {
    try {
        // 1. Fetch metrics over HTTP REST API from Probe Engine
        const response = await axios.get(`${PROBE_ENGINE_URL}/api/metrics/aggregate?interval=1 minute&range=15 minutes`);
        const metricsData = response.data;

        if (!Array.isArray(metricsData) || metricsData.length < 2) {
            console.log('🧠 Advisor: Insufficient metrics data points from Probe Engine.');
            return;
        }

        // 2. Evaluate dual-layer algorithm
        const decision = analyzeHybrid(metricsData);

        if (decision.action !== 'hold') {
            // 3. Fetch current Gateway configuration
            const gwHealth = await axios.get(`${GATEWAY_URL}/health`);
            const currentBatchSize = gwHealth.data.batchSize || 50;

            // 4. Calculate new batchSize with safety bounds (Clamp: Min 5, Max 200)
            const newBatchSize = Math.max(5, Math.min(200, Math.round(currentBatchSize * decision.multiplier)));

            if (newBatchSize !== currentBatchSize) {
                // 5. Apply new batchSize to Gateway via HTTP PUT
                await axios.put(`${GATEWAY_URL}/api/queue/config`, { batchSize: newBatchSize });

                // 6. Persist decision in postgres-advisor DB
                await pool.query(
                    `INSERT INTO advisor_decisions 
                    (avg_latency, error_rate, instant_gradient, trend_slope, action, old_batch_size, new_batch_size, reason) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [
                        decision.currentLatency,
                        decision.currentErrorRate,
                        decision.instantGradient,
                        decision.trendSlope,
                        decision.action,
                        currentBatchSize,
                        newBatchSize,
                        decision.reason
                    ]
                );

                console.log(`🧠 [ADVISOR DECISION] ${decision.action.toUpperCase()}: ${currentBatchSize} -> ${newBatchSize} | Reason: ${decision.reason}`);
            }
        }
    } catch (err) {
        console.error('❌ Advisor Feedback Loop Error:', err.message);
    }
}
```

---

## 🌐 6. REST API Endpoints

Implement the following endpoints in `services/capacity-advisor/src/index.js`:

- `GET /health` — Service health & DB connection status.
- `GET /api/advisor/decisions` — Retrieve decision history (used by Admin Dashboard).
- `POST /api/advisor/trigger` — Trigger immediate manual analysis tick.

---

## ✅ 7. Pre-Merge Checklist for Teammate A

- [ ] DB connection loop handles PostgreSQL startup delay gracefully.
- [ ] No direct imports or queries targeting `TimescaleDB` (`edupulse_metrics`).
- [ ] Successfully calls `PUT http://localhost:3002/api/queue/config` and modifies `batchSize`.
- [ ] Terminal logs display clear decision reasons and color output.
