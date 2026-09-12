const axios = require('axios');
const config = require('./config');
const db = require('./db');
const { analyzeHybrid } = require('./algorithm');

// In-memory status tracking for health/stats endpoints
let loopTimer = null;
let lastExecution = {
    timestamp: null,
    status: 'idle',
    decision: null,
    oldBatchSize: null,
    newBatchSize: null,
    applied: false,
    error: null,
};

/**
 * Execute one cycle of the feedback loop:
 * 1. Consumes metrics from probe-engine (GET /api/metrics/aggregate)
 * 2. Runs Dual-Layer Hybrid Algorithm
 * 3. Updates traffic-gateway batchSize (PUT /api/queue/config)
 * 4. Logs decision to postgres-advisor
 *
 * @param {object} [options]
 * @param {Array} [options.providedMetrics] - Optional metrics data to analyze instead of fetching
 * @returns {Promise<object>}
 */
async function runAdvisorLoop(options = {}) {
    const startTime = new Date();
    lastExecution.timestamp = startTime.toISOString();
    lastExecution.status = 'running';
    lastExecution.error = null;

    try {
        let metricsData = options.providedMetrics;

        // 1. Fetch metrics over HTTP REST API from Probe Engine if not provided
        if (!metricsData) {
            const probeUrl = `${config.PROBE_ENGINE_URL}/api/metrics/aggregate?interval=1 minute&range=15 minutes`;
            try {
                const response = await axios.get(probeUrl, { timeout: 5000 });
                metricsData = response.data;
            } catch (fetchErr) {
                const errMsg = `Failed to fetch metrics from probe-engine (${config.PROBE_ENGINE_URL}): ${fetchErr.message}`;
                console.warn(`⚠️ [ADVISOR] ${errMsg}`);
                lastExecution.status = 'error';
                lastExecution.error = errMsg;
                return {
                    timestamp: startTime.toISOString(),
                    applied: false,
                    error: errMsg,
                };
            }
        }

        if (!Array.isArray(metricsData) || metricsData.length < 2) {
            console.log('🧠 Advisor: Insufficient metrics data points from Probe Engine.');
            const decision = {
                action: 'hold',
                multiplier: 1.0,
                reason: 'Insufficient metrics data points from Probe Engine.',
            };
            lastExecution.status = 'completed';
            lastExecution.decision = decision;
            lastExecution.applied = false;
            return {
                timestamp: startTime.toISOString(),
                decision,
                applied: false,
            };
        }

        // 2. Evaluate dual-layer algorithm
        const decision = analyzeHybrid(metricsData, config.ADVISOR_WINDOW_SIZE);
        lastExecution.decision = decision;

        if (decision.action === 'hold') {
            lastExecution.status = 'completed';
            lastExecution.applied = false;
            return {
                timestamp: startTime.toISOString(),
                decision,
                applied: false,
                reason: decision.reason,
            };
        }

        // 3. Fetch current Gateway configuration
        let currentBatchSize = 50;
        try {
            const gwHealth = await axios.get(`${config.GATEWAY_URL}/health`, { timeout: 3000 });
            currentBatchSize = gwHealth.data?.batchSize || 50;
        } catch (gwErr) {
            console.warn(`⚠️ [ADVISOR] Could not read current batchSize from Gateway: ${gwErr.message}. Defaulting to 50.`);
        }

        // 4. Calculate new batchSize with safety bounds (Clamp: Min 5, Max 200)
        const minBound = config.MIN_BATCH_SIZE;
        const maxBound = config.MAX_BATCH_SIZE;
        const calculated = Math.round(currentBatchSize * decision.multiplier);
        const newBatchSize = Math.max(minBound, Math.min(maxBound, calculated));

        let applied = false;
        if (newBatchSize !== currentBatchSize) {
            // 5. Apply new batchSize to Gateway via HTTP PUT
            try {
                // Try primary route specified in roadmap: PUT /api/queue/config
                await axios.put(
                    `${config.GATEWAY_URL}/api/queue/config`,
                    { batchSize: newBatchSize },
                    { timeout: 5000 }
                );
                applied = true;
            } catch (putErr) {
                // Fallback route: PUT /api/config/admission-rate
                try {
                    await axios.put(
                        `${config.GATEWAY_URL}/api/config/admission-rate`,
                        { batchSize: newBatchSize },
                        { timeout: 5000 }
                    );
                    applied = true;
                } catch (fallbackErr) {
                    console.error(`❌ [ADVISOR] Failed to update batchSize on Gateway: ${putErr.message}`);
                }
            }

            // 6. Persist decision in postgres-advisor DB
            try {
                await db.recordDecision({
                    avgLatency: decision.currentLatency,
                    errorRate: decision.currentErrorRate,
                    instantGradient: decision.instantGradient,
                    trendSlope: decision.trendSlope,
                    action: decision.action,
                    oldBatchSize: currentBatchSize,
                    newBatchSize,
                    reason: decision.reason,
                });
            } catch (dbErr) {
                console.error(`❌ [ADVISOR] Failed to record decision to DB: ${dbErr.message}`);
            }

            console.log(
                `🧠 [ADVISOR DECISION] ${decision.action.toUpperCase()}: ${currentBatchSize} -> ${newBatchSize} | Reason: ${decision.reason}`
            );
        } else {
            console.log(`🧠 [ADVISOR] Batch size already at bound (${currentBatchSize}). No update sent.`);
        }

        lastExecution.status = 'completed';
        lastExecution.oldBatchSize = currentBatchSize;
        lastExecution.newBatchSize = newBatchSize;
        lastExecution.applied = applied;

        return {
            timestamp: startTime.toISOString(),
            decision,
            oldBatchSize: currentBatchSize,
            newBatchSize,
            applied,
        };
    } catch (err) {
        console.error('❌ Advisor Feedback Loop Error:', err.message);
        lastExecution.status = 'error';
        lastExecution.error = err.message;
        return {
            timestamp: startTime.toISOString(),
            error: err.message,
            applied: false,
        };
    }
}

/**
 * Start the autonomous feedback loop timer
 */
function startAdvisorScheduler(intervalMs = config.ADVISOR_CHECK_INTERVAL_MS) {
    if (loopTimer) {
        clearInterval(loopTimer);
    }

    console.log(`⏱️ [ADVISOR] Automated loop started (running every ${intervalMs}ms)`);
    loopTimer = setInterval(() => {
        runAdvisorLoop();
    }, intervalMs);

    // Run first check after a brief startup delay (3s) to let peer services initialize
    setTimeout(() => {
        runAdvisorLoop();
    }, 3000);
}

/**
 * Stop the feedback loop timer
 */
function stopAdvisorScheduler() {
    if (loopTimer) {
        clearInterval(loopTimer);
        loopTimer = null;
        console.log('🛑 [ADVISOR] Automated loop stopped');
    }
}

function getAdvisorStatus() {
    return {
        loopActive: !!loopTimer,
        checkIntervalMs: config.ADVISOR_CHECK_INTERVAL_MS,
        windowSize: config.ADVISOR_WINDOW_SIZE,
        bounds: {
            min: config.MIN_BATCH_SIZE,
            max: config.MAX_BATCH_SIZE,
        },
        lastExecution,
    };
}

module.exports = {
    runAdvisorLoop,
    startAdvisorScheduler,
    stopAdvisorScheduler,
    getAdvisorStatus,
};
