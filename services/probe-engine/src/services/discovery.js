const axios = require('axios');
const http = require('http');

const REGISTRY_SERVICE_URL = process.env.REGISTRY_SERVICE_URL || 'http://localhost:3001';

const discoveryClient = axios.create({
    httpAgent: new http.Agent({ keepAlive: true }),
    timeout: 5000,
});

async function discoverTargets(targetsList) {
    try {
        const res = await discoveryClient.get(`${REGISTRY_SERVICE_URL}/api/services`);
        if (Array.isArray(res.data) && res.data.length > 0) {
            const discovered = res.data.map((s) => ({
                id: s.serviceName || s.id,
                url: s.url || `http://${s.host}:${s.port}`,
                healthEndpoint: s.healthEndpoint || '/health',
            }));

            discovered.forEach((d) => {
                if (!targetsList.some((t) => t.id === d.id)) {
                    targetsList.push(d);
                    console.log(`🔍 Discovered new service target from Registry: ${d.id} (${d.url})`);
                }
            });
        }
    } catch (err) {
        // Registry Service offline or unreachable — keep current target list
    }
}

let discoveryTimer = null;
function startDiscoveryLoop(targetsList, intervalMs = 30000) {
    if (discoveryTimer) clearInterval(discoveryTimer);
    discoverTargets(targetsList);
    discoveryTimer = setInterval(() => discoverTargets(targetsList), intervalMs);
    console.log(`📡 Service Discovery Loop active (every ${intervalMs / 1000}s)`);
}

function stopDiscoveryLoop() {
    if (discoveryTimer) clearInterval(discoveryTimer);
}

module.exports = {
    discoverTargets,
    startDiscoveryLoop,
    stopDiscoveryLoop,
};
