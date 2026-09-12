const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateLinearSlope, analyzeHybrid } = require('../src/algorithm');

test('Linear Regression Slope', async (t) => {
    await t.test('returns 0 for empty or single-element inputs', () => {
        assert.equal(calculateLinearSlope([]), 0);
        assert.equal(calculateLinearSlope([42]), 0);
        assert.equal(calculateLinearSlope(null), 0);
    });

    await t.test('calculates correct positive slope', () => {
        // Points: (0, 10), (1, 20), (2, 30) => Slope = 10
        const slope = calculateLinearSlope([10, 20, 30]);
        assert.equal(Math.round(slope), 10);
    });

    await t.test('calculates correct negative slope', () => {
        // Points: (0, 30), (1, 20), (2, 10) => Slope = -10
        const slope = calculateLinearSlope([30, 20, 10]);
        assert.equal(Math.round(slope), -10);
    });

    await t.test('calculates 0 slope for flat horizontal line', () => {
        const slope = calculateLinearSlope([50, 50, 50, 50]);
        assert.equal(slope, 0);
    });
});

test('Dual-Layer Hybrid Decision Engine', async (t) => {
    await t.test('returns hold for insufficient data points', () => {
        assert.equal(analyzeHybrid(null).action, 'hold');
        assert.equal(analyzeHybrid([]).action, 'hold');
        assert.equal(analyzeHybrid([{ avg_latency: 50 }]).action, 'hold');
    });

    await t.test('TIER 1 Emergency Brake: Triggers on instant latency spike (> 50ms)', () => {
        // Order is newest-first: index 0 is newest, index 1 is previous
        const metrics = [
            { avg_latency: 180, error_rate: 0.01 }, // Newest
            { avg_latency: 100, error_rate: 0.01 }, // Previous (+80ms spike)
            { avg_latency: 98, error_rate: 0.00 },
        ];

        const decision = analyzeHybrid(metrics);
        assert.equal(decision.action, 'decrease');
        assert.equal(decision.multiplier, 0.7);
        assert.ok(decision.instantGradient > 50);
        assert.match(decision.reason, /EMERGENCY/);
    });

    await t.test('TIER 1 Emergency Brake: Triggers on high error rate (> 5%)', () => {
        const metrics = [
            { avg_latency: 60, error_rate: 0.08 }, // 8% error rate
            { avg_latency: 55, error_rate: 0.01 },
            { avg_latency: 50, error_rate: 0.00 },
        ];

        const decision = analyzeHybrid(metrics);
        assert.equal(decision.action, 'decrease');
        assert.equal(decision.multiplier, 0.7);
        assert.match(decision.reason, /EMERGENCY/);
    });

    await t.test('TIER 2 Mid-Term Trend Adjustment: Triggers gentle decrease on rising slope (> 0.1)', () => {
        // Latency rising steadily with no single spike > 50ms
        // Note metrics are sorted newest-first:
        // Reverse order (oldest to newest) will be [50, 55, 60, 65, 70, 75, 80]
        const metrics = [
            { avg_latency: 80, error_rate: 0.01 },
            { avg_latency: 75, error_rate: 0.01 },
            { avg_latency: 70, error_rate: 0.01 },
            { avg_latency: 65, error_rate: 0.01 },
            { avg_latency: 60, error_rate: 0.01 },
            { avg_latency: 55, error_rate: 0.01 },
            { avg_latency: 50, error_rate: 0.01 },
        ];

        const decision = analyzeHybrid(metrics);
        assert.equal(decision.action, 'decrease');
        assert.equal(decision.multiplier, 0.85);
        assert.ok(decision.trendSlope > 0.1);
        assert.match(decision.reason, /TREND/);
    });

    await t.test('TIER 2 Recovery: Triggers increase on dropping slope (< -0.1, instantGradient <= 0, latency < 250ms)', () => {
        // Latency dropping steadily from 120 down to 70
        const metrics = [
            { avg_latency: 70, error_rate: 0.00 }, // Newest
            { avg_latency: 75, error_rate: 0.00 },
            { avg_latency: 85, error_rate: 0.00 },
            { avg_latency: 95, error_rate: 0.00 },
            { avg_latency: 105, error_rate: 0.00 },
            { avg_latency: 115, error_rate: 0.00 },
            { avg_latency: 120, error_rate: 0.00 },
        ];

        const decision = analyzeHybrid(metrics);
        assert.equal(decision.action, 'increase');
        assert.equal(decision.multiplier, 1.25);
        assert.ok(decision.trendSlope < -0.1);
        assert.ok(decision.instantGradient <= 0);
        assert.ok(decision.currentLatency < 250);
        assert.match(decision.reason, /RECOVERY/);
    });

    await t.test('TIER 3 Optimal Zone: Holds batch size when operating stably', () => {
        const metrics = [
            { avg_latency: 80, error_rate: 0.01 },
            { avg_latency: 80, error_rate: 0.01 },
            { avg_latency: 81, error_rate: 0.01 },
            { avg_latency: 79, error_rate: 0.01 },
            { avg_latency: 80, error_rate: 0.01 },
        ];

        const decision = analyzeHybrid(metrics);
        assert.equal(decision.action, 'hold');
        assert.equal(decision.multiplier, 1.0);
        assert.match(decision.reason, /STABLE/);
    });
});
