// Traffic Gateway - 2-Phase Token Management Module
// Manages the complete lifecycle of registration tokens (Pending Entry -> Active -> Revoke/Expire)

const defaultConfig = require('./config');

/**
 * Creates and returns the Token Manager instance.
 * @param {import('ioredis').Redis} redis - Redis client instance
 * @param {object} [customConfig] - Optional config override
 */
module.exports = (redis, customConfig = {}) => {
    const config = { ...defaultConfig, ...customConfig };

    return {
        /**
         * Phase 1 Token Generation: PENDING_ENTRY
         * Created when a student is admitted from the waiting queue.
         * Gives the student a time window (PENDING_ENTRY_TTL) to enter the registration session.
         *
         * @param {string} ticketId - Unique ticket / admission identifier
         * @param {string} courseId - Course ID
         * @param {object} [metadata={}] - Optional metadata (e.g. studentId, ip, etc.)
         * @returns {Promise<object>} Token payload
         */
        async createPendingEntryToken(ticketId, courseId, metadata = {}) {
            const key = `${config.TOKEN_PREFIX}${ticketId}`;
            const now = new Date();
            const expiresAt = new Date(now.getTime() + config.PENDING_ENTRY_TTL * 1000);

            const tokenData = {
                ticketId,
                courseId,
                status: config.TOKEN_STATUS.PENDING_ENTRY,
                admittedAt: now.toISOString(),
                expiresAt: expiresAt.toISOString(),
                ttlSeconds: config.PENDING_ENTRY_TTL,
                ...metadata,
            };

            await redis.set(key, JSON.stringify(tokenData), 'EX', config.PENDING_ENTRY_TTL);
            return tokenData;
        },

        /**
         * Phase 2 Token Generation: ACTIVE
         * Activates the session when a student starts the registration process (when the student confirms the registration after being notified
         * before the PENDING_ENTRY token expires).
         * Transitions token status to ACTIVE, sets ACTIVE_TTL, and adds the student to the active set for course concurrency tracking.
         *
         * @param {string} ticketId - Unique ticket identifier
         * @param {object} [metadata={}] - Optional metadata to update
         * @returns {Promise<object|null>} Updated token payload or null if not found/expired
         */
        async activateToken(ticketId, metadata = {}) {
            const key = `${config.TOKEN_PREFIX}${ticketId}`;
            const rawData = await redis.get(key);
            if (!rawData) {
                return null;
            }

            const tokenData = JSON.parse(rawData);
            const now = new Date();
            const expiresAt = new Date(now.getTime() + config.ACTIVE_TTL * 1000);

            const updatedData = {
                ...tokenData,
                status: config.TOKEN_STATUS.ACTIVE,
                activatedAt: now.toISOString(),
                lastHeartbeat: now.toISOString(),
                expiresAt: expiresAt.toISOString(),
                ttlSeconds: config.ACTIVE_TTL,
                ...metadata,
            };

            const activeSetKey = `${config.ACTIVE_SET_PREFIX}${tokenData.courseId}`;

            // Atomic pipeline: update token data with ACTIVE_TTL and track in active set
            const pipeline = redis.pipeline();
            pipeline.set(key, JSON.stringify(updatedData), 'EX', config.ACTIVE_TTL);
            pipeline.sadd(activeSetKey, ticketId);
            await pipeline.exec();

            return updatedData;
        },

        /**
         * Direct Phase 2 Active Token Creation
         * Useful when admitting a student directly into an active session.
         *
         * @param {string} ticketId - Unique ticket identifier
         * @param {string} courseId - Course ID
         * @param {object} [metadata={}] - Optional metadata
         * @returns {Promise<object>} Created active token payload
         */
        async createActiveToken(ticketId, courseId, metadata = {}) {
            const key = `${config.TOKEN_PREFIX}${ticketId}`;
            const activeSetKey = `${config.ACTIVE_SET_PREFIX}${courseId}`;
            const now = new Date();
            const expiresAt = new Date(now.getTime() + config.ACTIVE_TTL * 1000);

            const tokenData = {
                ticketId,
                courseId,
                status: config.TOKEN_STATUS.ACTIVE,
                admittedAt: now.toISOString(),
                activatedAt: now.toISOString(),
                lastHeartbeat: now.toISOString(),
                expiresAt: expiresAt.toISOString(),
                ttlSeconds: config.ACTIVE_TTL,
                ...metadata,
            };

            const pipeline = redis.pipeline();
            pipeline.set(key, JSON.stringify(tokenData), 'EX', config.ACTIVE_TTL);
            pipeline.sadd(activeSetKey, ticketId);
            await pipeline.exec();

            return tokenData;
        },

        /**
         * Generic create token helper (defaults to Phase 1: PENDING_ENTRY)
         *
         * @param {string} ticketId - Unique ticket identifier
         * @param {string} courseId - Course ID
         * @param {object} [options={}] - Options including initial status or metadata
         * @returns {Promise<object>} Token payload
         */
        async create(ticketId, courseId, options = {}) {
            const status = options.status || config.TOKEN_STATUS.PENDING_ENTRY;
            if (status === config.TOKEN_STATUS.ACTIVE) {
                return this.createActiveToken(ticketId, courseId, options);
            }
            return this.createPendingEntryToken(ticketId, courseId, options);
        },

        /**
         * Heartbeat / Keep-Alive
         * Extends the TTL for an active session while the student is filling the registration form.
         *
         * @param {string} ticketId - Unique ticket identifier
         * @returns {Promise<object|null>} Updated token payload or null if token is not found or not ACTIVE
         */
        async heartbeat(ticketId) {
            const key = `${config.TOKEN_PREFIX}${ticketId}`;
            const rawData = await redis.get(key);
            if (!rawData) {
                return null;
            }

            const tokenData = JSON.parse(rawData);
            if (tokenData.status !== config.TOKEN_STATUS.ACTIVE) {
                return null;
            }

            const now = new Date();
            const expiresAt = new Date(now.getTime() + config.ACTIVE_TTL * 1000);

            tokenData.lastHeartbeat = now.toISOString();
            tokenData.expiresAt = expiresAt.toISOString();

            await redis.set(key, JSON.stringify(tokenData), 'EX', config.ACTIVE_TTL);
            return tokenData;
        },

        /**
         * Verify / Read Token
         * Checks if the token is valid, not expired, and optionally returns remaining TTL.
         *
         * @param {string} ticketId - Unique ticket identifier
         * @returns {Promise<object|null>} Parsed token object with remaining TTL or null if expired/non-existent
         */
        async verify(ticketId) {
            const key = `${config.TOKEN_PREFIX}${ticketId}`;
            const [rawData, ttl] = await Promise.all([
                redis.get(key),
                redis.ttl(key),
            ]);

            if (!rawData || ttl <= 0) {
                return null;
            }

            const parsed = JSON.parse(rawData);
            return {
                ...parsed,
                remainingTTL: ttl,
            };
        },

        /**
         * Revoke Token
         * Deletes token and cleans up from active set upon successful registration or cancellation.
         *
         * @param {string} ticketId - Unique ticket identifier
         * @param {string} [courseId] - Course ID (optional, will be inferred from token if omitted)
         * @returns {Promise<boolean>} True if revoked successfully
         */
        async revoke(ticketId, courseId) {
            const key = `${config.TOKEN_PREFIX}${ticketId}`;

            let resolvedCourseId = courseId;
            if (!resolvedCourseId) {
                const rawData = await redis.get(key);
                if (rawData) {
                    try {
                        const parsed = JSON.parse(rawData);
                        resolvedCourseId = parsed.courseId;
                    } catch (e) {
                        // ignore parse error
                    }
                }
            }

            const pipeline = redis.pipeline();
            pipeline.del(key);
            if (resolvedCourseId) {
                pipeline.srem(`${config.ACTIVE_SET_PREFIX}${resolvedCourseId}`, ticketId);
            }
            await pipeline.exec();
            return true;
        },

        /**
         * Get Active Token Count
         * Returns the number of currently active registration sessions for a course.
         *
         * @param {string} courseId - Course ID
         * @returns {Promise<number>} Number of active sessions
         */
        async getActiveCount(courseId) {
            const activeKey = `${config.ACTIVE_SET_PREFIX}${courseId}`;
            return await redis.scard(activeKey);
        },

        /**
         * Get all active ticket IDs for a course
         *
         * @param {string} courseId - Course ID
         * @returns {Promise<string[]>} Array of ticket IDs
         */
        async getActiveTokens(courseId) {
            const activeKey = `${config.ACTIVE_SET_PREFIX}${courseId}`;
            return await redis.smembers(activeKey);
        },

        /**
         * Cleanup Expired Tokens from Active Set
         * Removes ticket IDs from the active set whose Redis token keys have expired.
         *
         * @param {string} courseId - Course ID
         * @returns {Promise<number>} Number of cleaned up expired tokens
         */
        async cleanupExpired(courseId) {
            const activeKey = `${config.ACTIVE_SET_PREFIX}${courseId}`;
            const members = await redis.smembers(activeKey);
            if (!members || members.length === 0) {
                return 0;
            }

            let cleanedCount = 0;
            const pipeline = redis.pipeline();

            for (const ticketId of members) {
                const exists = await redis.exists(`${config.TOKEN_PREFIX}${ticketId}`);
                if (!exists) {
                    pipeline.srem(activeKey, ticketId);
                    cleanedCount++;
                }
            }

            if (cleanedCount > 0) {
                await pipeline.exec();
            }

            return cleanedCount;
        },
    };
};
