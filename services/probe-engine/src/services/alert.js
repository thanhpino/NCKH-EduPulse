const axios = require('axios');
const http = require('http');
const https = require('https');
const { recordTriggerEvent } = require('../config/db');

const ALERT_SERVICE_URL = process.env.ALERT_SERVICE_URL || 'http://localhost:3005';

const alertHttpClient = axios.create({
    httpAgent: new http.Agent({ keepAlive: true }),
    httpsAgent: new https.Agent({ keepAlive: true }),
    timeout: 5000,
});

async function dispatchAlert({ target, triggerType = 'CONSECUTIVE_FAILURE', severity = 'CRITICAL', consecutiveFailures = 3, errorType = 'UNKNOWN', errorMsg = '' }) {
    const payload = {
        serviceId: target.id,
        targetUrl: target.url,
        triggerType,
        severity,
        consecutiveFailures,
        errorType,
        errorMsg,
        timestamp: new Date().toISOString(),
    };

    // 1. Persist trigger event in probe_triggers database table
    await recordTriggerEvent({
        target_id: target.id,
        target_url: target.url,
        trigger_type: triggerType,
        severity,
        consecutive_failures: consecutiveFailures,
        error_type: errorType,
        error_msg: errorMsg,
        payload,
    });

    // 2. Dispatch HTTP POST alert notification to Alert Service
    try {
        await alertHttpClient.post(`${ALERT_SERVICE_URL}/api/alerts`, payload);
        console.warn(`🚨 Alert dispatched to Alert Service for target ${target.id} (${consecutiveFailures} consecutive failures)`);
    } catch (err) {
        console.warn(`⚠️ Alert Service (${ALERT_SERVICE_URL}) unreachable or offline: ${err.message}`);
    }
}

module.exports = {
    dispatchAlert,
};
