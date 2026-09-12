// Server-Sent Events (SSE) Live Stream Manager for Admin Dashboard
let sseClients = [];

function addSseClient(req, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    const clientId = Date.now();
    const newClient = { id: clientId, res };
    sseClients.push(newClient);

    console.log(`📡 SSE Stream Client connected (ID: ${clientId}). Total clients: ${sseClients.length}`);

    // Send initial handshake message
    res.write(`data: ${JSON.stringify({ type: 'INIT', message: 'Connected to EduPulse Telemetry SSE Stream', clientId })}\n\n`);

    req.on('close', () => {
        sseClients = sseClients.filter((c) => c.id !== clientId);
        console.log(`🔌 SSE Stream Client disconnected (ID: ${clientId}). Remaining clients: ${sseClients.length}`);
    });
}

function broadcastMetricsUpdate(cycleResults) {
    if (sseClients.length === 0) return;

    const data = JSON.stringify({
        type: 'METRICS_TICK',
        timestamp: new Date().toISOString(),
        results: cycleResults,
    });

    sseClients.forEach((client) => {
        client.res.write(`data: ${data}\n\n`);
    });
}

module.exports = {
    addSseClient,
    broadcastMetricsUpdate,
    getActiveClientCount: () => sseClients.length,
};
