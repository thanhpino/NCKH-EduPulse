const express = require('express');
const router = express.Router();
const { targets, consecutiveFailuresMap, FAILURE_ALERT_THRESHOLD, startProbing, getCurrentInterval, runProbeCycle } = require('../services/prober');

// GET /api/targets — List all monitored targets with live health status
router.get('/targets', (req, res) => {
    const list = targets.map((t) => {
        const failures = consecutiveFailuresMap.get(t.id) || 0;
        return {
            ...t,
            consecutiveFailures: failures,
            status: failures >= FAILURE_ALERT_THRESHOLD ? 'CRITICAL' : 'UP',
        };
    });
    res.json({ targets: list, total: targets.length });
});

// POST /api/probe/targets — Register or update target dynamically
router.post('/probe/targets', (req, res) => {
    const { id, url, healthEndpoint = '/health' } = req.body;
    if (!id || !url) {
        return res.status(400).json({ error: 'Missing required fields: id, url' });
    }

    const idx = targets.findIndex((t) => t.id === id);
    if (idx >= 0) {
        targets[idx] = { id, url, healthEndpoint };
    } else {
        targets.push({ id, url, healthEndpoint });
    }

    console.log(`➕ Target updated dynamically: ${id} -> ${url}`);
    res.status(201).json({ message: 'Target added/updated', targets });
});

// DELETE /api/probe/targets/:id — Remove monitored target
router.delete('/probe/targets/:id', (req, res) => {
    const { id } = req.params;
    const index = targets.findIndex((t) => t.id === id);
    if (index !== -1) {
        targets.splice(index, 1);
        consecutiveFailuresMap.delete(id);
    }
    res.json({ message: `Target ${id} removed`, targets });
});

// PUT /api/probe/config — Update probing interval dynamically
router.put('/probe/config', (req, res) => {
    const { intervalMs } = req.body;
    if (intervalMs && typeof intervalMs === 'number' && intervalMs >= 500) {
        startProbing(intervalMs);
        return res.json({ message: 'Probing interval updated successfully', probeIntervalMs: getCurrentInterval() });
    }
    res.status(400).json({ error: 'Invalid intervalMs (must be a number >= 500)' });
});

// POST /api/probe/now — Trigger manual probe cycle out of band
router.post('/probe/now', async (req, res) => {
    const cycleData = await runProbeCycle();
    res.json({ message: 'Manual probe cycle executed', data: cycleData });
});

module.exports = router;
