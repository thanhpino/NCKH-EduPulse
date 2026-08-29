// Traffic Gateway - Redis Queue Module
// Manages FIFO Fair Queue using Redis Sorted Sets per course, with atomic ACTIVE token admission for the first 50 students when queue is empty.

const defaultConfig = require('./config');
const tokenFactory = require('./token');



/**
 * Creates and returns the Queue Manager instance.
 * @param {import('ioredis').Redis} redis - Redis client instance
 * @param {object} [customConfig] - Optional configuration overrides
 * @param {object} [customTokenManager] - Optional token manager instance
 */
module.exports = (redis, customConfig = {}, customTokenManager = null) => {
    const config = { ...defaultConfig, ...customConfig };
    const tokenManager = customTokenManager || tokenFactory(redis, config);

    return {
        /**
         * Enqueue or Directly Admit Student
         *
         * ATOMIC RULE: If active concurrency for a course is below BATCH_SIZE,
         * Lua script atomically issues an ACTIVE token and adds student to active set.
         * If active capacity is full, student is enqueued into Redis Sorted Set (FIFO by timestamp).
         *
         * @param {string} ticketId - Unique ticket identifier
         * @param {string} courseId - Course ID
         * @param {object} [metadata={}] - Optional student/request metadata
         * @returns {Promise<object>} Admission or queue position result
         */
        async enqueue(ticketId, courseId, metadata = {}) {
            const queueKey = `${config.QUEUE_PREFIX}${courseId}`;

            // Atomic Direct Admission via tokenManager's Lua Script
            const admitResult = await tokenManager.atomicAdmit(
                ticketId,
                courseId,
                config.TOKEN_STATUS.ACTIVE,
                metadata
            );

            if (admitResult.admitted) {
                return {
                    admitted: true,
                    directAdmission: true,
                    status: config.TOKEN_STATUS.ACTIVE,
                    ticketId,
                    courseId,
                    token: admitResult.token,
                    activeCount: admitResult.activeCount,
                    message: 'Capacity available. Direct ACTIVE token granted.',
                };
            }

            // Capacity full (>= BATCH_SIZE): add student to Redis Sorted Set (FIFO by timestamp)
            const score = Date.now();
            const pipeline = redis.pipeline();
            pipeline.zadd(queueKey, score, ticketId);
            pipeline.sadd(config.COURSES_SET_KEY, courseId);
            await pipeline.exec();

            const position = await this.getPosition(ticketId, courseId);
            const totalInQueue = await this.getQueueLength(courseId);

            // Wave-based ETA calculation
            const wavesNeeded = Math.ceil(position / config.BATCH_SIZE);
            const etaSeconds = wavesNeeded * config.ACTIVE_TTL;

            return {
                admitted: false,
                directAdmission: false,
                status: 'waiting',
                ticketId,
                courseId,
                position,
                totalInQueue,
                estimatedWaitSeconds: etaSeconds,
                message: `You are #${position} in line for course ${courseId}. Estimated wait: ~${etaSeconds}s`,
            };
        },

        /**
         * Get 1-based position in queue
         *
         * @param {string} ticketId - Unique ticket identifier
         * @param {string} courseId - Course ID
         * @returns {Promise<number|null>} 1-based rank or null if not in queue
         */
        async getPosition(ticketId, courseId) {
            const queueKey = `${config.QUEUE_PREFIX}${courseId}`;
            const rank = await redis.zrank(queueKey, ticketId);
            return rank !== null ? rank + 1 : null;
        },

        /**
         * Remove ticket from queue (when admitted or expired/cancelled)
         *
         * @param {string} ticketId - Unique ticket identifier
         * @param {string} courseId - Course ID
         * @returns {Promise<number>} Number of removed elements
         */
        async dequeue(ticketId, courseId) {
            const queueKey = `${config.QUEUE_PREFIX}${courseId}`;
            const removed = await redis.zrem(queueKey, ticketId);

            // If queue is now empty, remove from active courses set
            const remaining = await redis.zcard(queueKey);
            if (remaining === 0) {
                await redis.srem(config.COURSES_SET_KEY, courseId);
            }

            return removed;
        },

        /**
         * Get first N tickets for batch admission
         *
         * @param {string} courseId - Course ID
         * @param {number} count - Maximum batch size to retrieve
         * @returns {Promise<string[]>} Array of ticket IDs
         */
        async getNextBatch(courseId, count) {
            if (count <= 0) return [];
            const queueKey = `${config.QUEUE_PREFIX}${courseId}`;
            return await redis.zrange(queueKey, 0, count - 1);
        },

        /**
         * Dequeue a batch of tickets
         *
         * @param {string} courseId - Course ID
         * @param {string[]} ticketIds - Ticket IDs to remove
         * @returns {Promise<number>} Number of tickets removed
         */
        async dequeueBatch(courseId, ticketIds) {
            if (!ticketIds || ticketIds.length === 0) return 0;
            const queueKey = `${config.QUEUE_PREFIX}${courseId}`;

            const pipeline = redis.pipeline();
            for (const ticketId of ticketIds) {
                pipeline.zrem(queueKey, ticketId);
            }
            const results = await pipeline.exec();
            const removedCount = results.reduce((acc, [, res]) => acc + (res || 0), 0);

            const remaining = await redis.zcard(queueKey);
            if (remaining === 0) {
                await redis.srem(config.COURSES_SET_KEY, courseId);
            }

            return removedCount;
        },

        /**
         * Total number of students currently waiting in queue for a course
         *
         * @param {string} courseId - Course ID
         * @returns {Promise<number>} Number of waiting students
         */
        async getQueueLength(courseId) {
            const queueKey = `${config.QUEUE_PREFIX}${courseId}`;
            return await redis.zcard(queueKey);
        },

        /**
         * Get all course IDs that currently have active waiting queues
         * Uses COURSES_SET_KEY for O(1) retrieval with redis.keys fallback
         *
         * @returns {Promise<string[]>} Array of course IDs
         */
        async getActiveCourseIds() {
            const courseIds = await redis.smembers(config.COURSES_SET_KEY);
            if (courseIds && courseIds.length > 0) {
                const activeCourses = [];
                for (const courseId of courseIds) {
                    const count = await this.getQueueLength(courseId);
                    if (count > 0) {
                        activeCourses.push(courseId);
                    } else {
                        await redis.srem(config.COURSES_SET_KEY, courseId);
                    }
                }
                return activeCourses;
            }

            try {
                const keys = await redis.keys(`${config.QUEUE_PREFIX}*`);
                return keys.map((k) => k.replace(config.QUEUE_PREFIX, ''));
            } catch (e) {
                return [];
            }
        },

        /**
         * Get queue statistics for a course or all active courses
         *
         * @param {string} [courseId] - Optional course ID
         * @returns {Promise<object>} Queue statistics
         */
        async getQueueStats(courseId) {
            if (courseId) {
                const [queueLength, activeCount] = await Promise.all([
                    this.getQueueLength(courseId),
                    tokenManager.getActiveCount(courseId),
                ]);
                const wavesNeeded = Math.ceil(queueLength / config.BATCH_SIZE);
                return {
                    courseId,
                    queueLength,
                    activeCount,
                    batchSize: config.BATCH_SIZE,
                    admissionIntervalMs: config.ADMISSION_INTERVAL,
                    estimatedClearSeconds: wavesNeeded * config.ACTIVE_TTL,
                };
            }

            const activeCourseIds = await this.getActiveCourseIds();
            const statsByCourse = {};
            let totalQueued = 0;
            let totalActive = 0;

            for (const cId of activeCourseIds) {
                const stats = await this.getQueueStats(cId);
                statsByCourse[cId] = stats;
                totalQueued += stats.queueLength;
                totalActive += stats.activeCount;
            }

            return {
                activeCoursesCount: activeCourseIds.length,
                totalQueued,
                totalActive,
                batchSize: config.BATCH_SIZE,
                admissionIntervalMs: config.ADMISSION_INTERVAL,
                courses: statsByCourse,
            };
        },

        /**
         * Clear entire queue for a course
         *
         * @param {string} courseId - Course ID
         * @returns {Promise<boolean>}
         */
        async clearQueue(courseId) {
            const queueKey = `${config.QUEUE_PREFIX}${courseId}`;
            const pipeline = redis.pipeline();
            pipeline.del(queueKey);
            pipeline.srem(config.COURSES_SET_KEY, courseId);
            await pipeline.exec();
            return true;
        },
    };
};
