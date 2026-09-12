/**
 * Dual-Layer Hybrid Algorithm (Gradient + Linear Regression)
 * Implements architectural specifications from capacity_advisor_roadmap.md
 */

/**
 * Calculates Ordinary Least Squares Linear Regression Slope over a series of values.
 * X is the index [0, 1, 2, ..., n-1], Y is values[i].
 *
 * @param {number[]} values - Array of values ordered chronologically (oldest to newest)
 * @returns {number} Slope of the regression line
 */
function calculateLinearSlope(values) {
    if (!Array.isArray(values) || values.length < 2) return 0;
    const n = values.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += values[i];
        sumXY += i * values[i];
        sumX2 += i * i;
    }

    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) return 0;

    return (n * sumXY - sumX * sumY) / denominator;
}

/**
 * Dual-Layer Hybrid Decision Engine
 *
 * @param {Array<{ avg_latency?: number|string, error_rate?: number|string }>} metricsData -
 *        Array of aggregate metric points ordered newest-first (as returned by probe-engine)
 * @param {number} [windowSize=15] - Maximum number of recent samples to analyze for trend slope
 * @returns {object} Decision object with action, multiplier, reasons, and calculated signals
 */
function analyzeHybrid(metricsData, windowSize = 15) {
    if (!Array.isArray(metricsData) || metricsData.length < 2) {
        return {
            action: 'hold',
            multiplier: 1.0,
            reason: 'Insufficient metrics data points',
            currentLatency: 0,
            currentErrorRate: 0,
            instantGradient: 0,
            trendSlope: 0,
        };
    }

    const latest = metricsData[0]; // Latest metric point
    const prev = metricsData[1]; // Previous metric point

    const currentLatency = parseFloat(latest.avg_latency) || 0;
    const prevLatency = parseFloat(prev.avg_latency) || 0;
    const currentErrorRate = parseFloat(latest.error_rate) || 0;

    // Layer 1: Instant Numerical Gradient
    const instantGradient = currentLatency - prevLatency;

    // Layer 2: Linear Regression Trend Slope (recent samples)
    // We reverse the sliced array so chronological order is oldest to newest
    const recentLatencies = metricsData
        .slice(0, windowSize)
        .map((m) => (m && m.avg_latency != null ? parseFloat(m.avg_latency) || 0 : 0))
        .reverse();

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
            reason: `🚨 EMERGENCY: Instant Gradient Spike (${instantGradient.toFixed(1)}ms) or Error Rate (${(currentErrorRate * 100).toFixed(1)}%)`,
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
            reason: `⚠️ TREND: Latency slope rising steadily (${trendSlope.toFixed(3)})`,
        };
    } else if (trendSlope < -0.1 && instantGradient <= 0 && currentLatency < 250) {
        return {
            currentLatency,
            currentErrorRate,
            instantGradient,
            trendSlope,
            action: 'increase',
            multiplier: 1.25, // Increase batchSize by 25%
            reason: `🚀 RECOVERY: Latency slope dropping & system healthy (${currentLatency.toFixed(0)}ms)`,
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
        reason: '✅ STABLE: System operating in optimal zone',
    };
}

module.exports = {
    calculateLinearSlope,
    analyzeHybrid,
};
