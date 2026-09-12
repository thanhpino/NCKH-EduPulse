const axios = require('axios');
const http = require('http');
const https = require('https');
const { recordMetric } = require('../config/db');
const { dispatchAlert } = require('./alert');
const { broadcastMetricsUpdate } = require('./stream');

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });
const probeClient = axios.create({
    httpAgent,
    httpsAgent,
    timeout: 8000,
});

let targets = [
    {
        id: 'traffic-gateway',
        url: process.env.GATEWAY_URL || 'http://traffic-gateway:3002',
        healthEndpoint: '/health',
    },
    {
        id: 'mock-backend',
        url: process.env.MOCK_BACKEND_URL || 'http://mock-backend:3010',
        healthEndpoint: '/health',
    },
    {
        id: 'registry-service',
        url: process.env.REGISTRY_SERVICE_URL || 'http://registry-service:3001',
        healthEndpoint: '/health',
    },
];

const consecutiveFailuresMap = new Map();
const highLatencyCountMap = new Map();
const FAILURE_ALERT_THRESHOLD = 3;
const LATENCY_SLA_THRESHOLD_MS = parseInt(process.env.LATENCY_SLA_MS) || 1500;
const HIGH_LATENCY_ALERT_THRESHOLD = 2;

let probeIntervalTimer = null;
let currentIntervalMs = parseInt(process.env.PROBE_INTERVAL_MS) || 5000;

function classifyError(err) {
    if (!err) return null;
    const code = err.code;
    const status = err.response?.status;

    if (code === 'ECONNREFUSED') return 'CONNECTION_REFUSED';
    if (code === 'ETIMEDOUT' || code === 'ECONNABORTED') return 'TIMEOUT';
    if (code === 'ENOTFOUND') return 'DNS_LOOKUP_FAILED';
    if (status >= 500) return `HTTP_${status}_SERVER_ERROR`;
    if (status >= 400) return `HTTP_${status}_CLIENT_ERROR`;
    return 'UNKNOWN_ERROR';
}

async function probeTarget(target) {
    const start = Date.now();
    const probeUrl = target.url.endsWith('/')
        ? `${target.url}${target.healthEndpoint.replace(/^\//, '')}`
        : `${target.url}${target.healthEndpoint}`;

    try {
        const response = await probeClient.get(probeUrl);
        const latency = Date.now() - start;

        // Reset consecutive failure counter on success
        consecutiveFailuresMap.set(target.id, 0);

        // Check Latency SLA Spike
        if (latency > LATENCY_SLA_THRESHOLD_MS) {
            const highCount = (highLatencyCountMap.get(target.id) || 0) + 1;
            highLatencyCountMap.set(target.id, highCount);

            if (highCount >= HIGH_LATENCY_ALERT_THRESHOLD) {
                dispatchAlert({
                    target,
                    triggerType: 'LATENCY_SPIKE',
                    severity: 'WARNING',
                    consecutiveFailures: 0,
                    errorType: 'HIGH_LATENCY_SLA_EXCEEDED',
                    errorMsg: `Latency (${latency}ms) breached SLA threshold (${LATENCY_SLA_THRESHOLD_MS}ms) for ${highCount} consecutive probes`,
                });
            }
        } else {
            highLatencyCountMap.set(target.id, 0);
        }

        await recordMetric({
            target_id: target.id,
            target_url: target.url,
            latency_ms: latency,
            status_code: response.status,
            is_error: false,
            error_type: null,
            error_msg: null,
        });

        return { id: target.id, url: target.url, latency, statusCode: response.status, isError: false, error: null };
    } catch (err) {
        const latency = Date.now() - start;
        const statusCode = err.response?.status || 0;
        const errorType = classifyError(err);
        const errorMsg = err.message || 'Connection refused or timeout';

        const currentFailures = (consecutiveFailuresMap.get(target.id) || 0) + 1;
        consecutiveFailuresMap.set(target.id, currentFailures);

        await recordMetric({
            target_id: target.id,
            target_url: target.url,
            latency_ms: latency,
            status_code: statusCode,
            is_error: true,
            error_type: errorType,
            error_msg: errorMsg,
        });

        if (currentFailures >= FAILURE_ALERT_THRESHOLD) {
            dispatchAlert({
                target,
                triggerType: 'CONSECUTIVE_FAILURE',
                severity: 'CRITICAL',
                consecutiveFailures: currentFailures,
                errorType,
                errorMsg,
            });
        }

        return { id: target.id, url: target.url, latency, statusCode, isError: true, errorType, error: errorMsg, consecutiveFailures: currentFailures };
    }
}

async function runProbeCycle() {
    const results = await Promise.allSettled(targets.map(probeTarget));
    const cycleData = results.map((r) => r.status === 'fulfilled' ? r.value : { isError: true, error: 'Probe task failed' });

    const summary = cycleData.map((val) => `${val.id}: ${val.latency}ms [${val.isError ? '❌ ' + val.errorType : '✅ OK'}]`);
    console.log(`🔍 Probe Cycle (${new Date().toLocaleTimeString()}): ${summary.join(' | ')}`);

    broadcastMetricsUpdate(cycleData);
    return cycleData;
}

function startProbing(intervalMs = currentIntervalMs) {
    if (probeIntervalTimer) clearInterval(probeIntervalTimer);
    currentIntervalMs = intervalMs;
    console.log(`⚙️ Probing loop running every ${currentIntervalMs}ms (Latency SLA: ${LATENCY_SLA_THRESHOLD_MS}ms)`);

    runProbeCycle();
    probeIntervalTimer = setInterval(runProbeCycle, currentIntervalMs);
}

function stopProbing() {
    if (probeIntervalTimer) clearInterval(probeIntervalTimer);
}

module.exports = {
    targets,
    consecutiveFailuresMap,
    highLatencyCountMap,
    FAILURE_ALERT_THRESHOLD,
    LATENCY_SLA_THRESHOLD_MS,
    runProbeCycle,
    startProbing,
    stopProbing,
    getCurrentInterval: () => currentIntervalMs,
};
