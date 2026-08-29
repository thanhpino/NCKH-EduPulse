// services/traffic-gateway/src/fallback.js
// Redis Fallback logic

const config = require('./config');

module.exports = (redis, proxy, logger) => {

    let redisAlive = true; // assume alive at startup, healthcheck will update

    /**
     * Ping Redis to check if it's alive
     * Used for: /health endpoint, and middleware to block requests needing Redis
     */
    async function isRedisAlive() {
        try {
            const result = await Promise.race([
                redis.ping(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('ping timeout')), config.REDIS_PING_TIMEOUT)
                ),
            ]);
            const alive = result === 'PONG';
            updateStatus(alive);
            return alive;
        } catch (err) {
            updateStatus(false);
            return false;
        }
    }

    function updateStatus(alive) {
        if (alive !== redisAlive) {
            // Only log when state CHANGES, avoid spam log every healthcheck
            if (!alive) {
                logger.error(' Redis unavailable — switching to PASS-THROUGH mode (queue/token features disabled)');
            } else {
                logger.info(' Redis recovered — resuming normal queue/token mode');
            }
        }
        redisAlive = alive;
    }

    function getStatus() {
        return redisAlive;
    }

    /**
     * Pass-through: bỏ qua toàn bộ queue/token logic, forward thẳng đến Mock Backend
     * QUAN TRỌNG: đây là chế độ "hạ cấp có kiểm soát" (graceful degradation), KHÔNG phải trạng thái lý tưởng —
     * mất hoàn toàn khả năng điều tiết tải khi ở chế độ này, cần nêu rõ giới hạn này trong báo cáo.
     */
    async function passThroughRegister(studentId, courseId) {
        logger.warn(`[fallback] Pass-through register: ${studentId}/${courseId} (Redis down, no queue/token control)`);
        // Không có ticketId thật trong chế độ này → dùng studentId+courseId+timestamp làm idempotency key tạm
        const fallbackKey = `fallback-${studentId}-${courseId}-${Date.now()}`;
        return await proxy.forwardRegistration(studentId, courseId, fallbackKey);
    }

    /**
     * Middleware — chặn trước các route cần Redis (enqueue, status, enter, heartbeat)
     * Nếu Redis chết, route đó trả lỗi rõ ràng thay vì crash mập mờ
     */
    function requireRedis(req, res, next) {
        if (!redisAlive) {
            return res.status(503).json({
                error: 'Queue system temporarily unavailable',
                mode: 'pass-through',
                hint: 'Try POST /api/register/direct instead',
            });
        }
        next();
    }

    // Tự ping định kỳ để cập nhật trạng thái, không chỉ dựa vào lúc gọi /health
    function startHealthCheckLoop() {
        setInterval(() => {
            isRedisAlive().catch(() => { }); // isRedisAlive tự log, không cần xử lý gì thêm ở đây
        }, config.REDIS_PING_TIMEOUT * 2); // ví dụ ping mỗi 4s nếu timeout là 2s
    }

    return {
        isRedisAlive,
        getStatus,
        passThroughRegister,
        requireRedis,
        startHealthCheckLoop,
    };
};