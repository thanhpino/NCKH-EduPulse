const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { app } = require('../src/index');

test('Express API Endpoints', async (t) => {
    let server;
    let baseUrl;

    await t.test('setup test server', () => {
        return new Promise((resolve) => {
            server = http.createServer(app);
            server.listen(0, () => {
                const port = server.address().port;
                baseUrl = `http://127.0.0.1:${port}`;
                resolve();
            });
        });
    });

    await t.test('GET /health returns service status and degraded DB when not connected', async () => {
        const res = await fetch(`${baseUrl}/health`);
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.service, 'capacity-advisor');
        assert.ok(data.database);
        assert.ok(data.advisor);
    });

    await t.test('GET /api/advisor/status returns advisor configuration and state', async () => {
        const res = await fetch(`${baseUrl}/api/advisor/status`);
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.ok('checkIntervalMs' in data);
        assert.ok('windowSize' in data);
        assert.ok('bounds' in data);
        assert.equal(data.bounds.min, 5);
        assert.equal(data.bounds.max, 200);
    });

    await t.test('POST /api/advisor/analyze performs dry-run analysis on provided metrics', async () => {
        const metrics = [
            { avg_latency: 200, error_rate: 0.08 },
            { avg_latency: 100, error_rate: 0.01 },
            { avg_latency: 90, error_rate: 0.01 },
        ];

        const res = await fetch(`${baseUrl}/api/advisor/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ metricsData: metrics }),
        });

        assert.equal(res.status, 200);
        const data = await res.json();
        assert.ok(data.decision);
        assert.equal(data.decision.action, 'decrease');
    });

    await t.test('teardown test server', () => {
        return new Promise((resolve) => {
            server.close(resolve);
        });
    });
});
