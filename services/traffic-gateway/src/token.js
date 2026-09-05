// Traffic Gateway - 2-Phase Token Management Module
// Manages the complete lifecycle of registration tokens (Pending Entry -> Active -> Revoke/Expire)

const defaultConfig = require('./config');

const ATOMIC_ADMIT_LUA = `
local activeSetKey = KEYS[1]
local tokenKey = KEYS[2]
local ticketId = ARGV[1]
local courseId = ARGV[2]
local batchSize = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])
local tokenDataJson = ARGV[5]

local activeCount = redis.call('SCARD', activeSetKey)
if activeCount < batchSize then
    redis.call('SET', tokenKey, tokenDataJson, 'EX', ttl)
    redis.call('SADD', activeSetKey, ticketId)
    return activeCount + 1
else
    return -1
end
`;

/**
 * Creates and returns the Token Manager instance.
 * @param {import('ioredis').Redis} redis - Redis client instance
 * @param {object} [customConfig] - Optional config override
 */
module.exports = (redis, customConfig = {}) => {
    const config = { ...defaultConfig, ...customConfig };

    return {
        /**
         * Atomic Direct Admission or Queue Batch Admission via Redis Lua script
         * Atomically checks active slot count (SCARD) against BATCH_SIZE and creates token + SADD to active set.
         *
         * @param {string} ticketId - Ticket ID
         * @param {string} courseId - Course ID
         * @param {'ACTIVE'|'PENDING_ENTRY'} status - Target token status
         * @param {object} [metadata={}] - Optional metadata
         * @returns {Promise<{ admitted: boolean, token?: object, activeCount?: number }>}
         */
        async atomicAdmit(ticketId, courseId, status = config.TOKEN_STATUS.ACTIVE, metadata = {}, targetBatchSize = null) {
            const activeSetKey = `${config.ACTIVE_SET_PREFIX}${courseId}`;
            const tokenKey = `${config.TOKEN_PREFIX}${ticketId}`;

            const batchSizeToUse = targetBatchSize || config.BATCH_SIZE;
            const ttl = status === config.TOKEN_STATUS.ACTIVE ? config.ACTIVE_TTL : config.PENDING_ENTRY_TTL;
            const now = new Date();
            const expiresAt = new Date(now.getTime() + ttl * 1000);

            const tokenPayload = {
                ticketId,
                courseId,
                status,
                admittedAt: now.toISOString(),
                ...(status === config.TOKEN_STATUS.ACTIVE ? { activatedAt: now.toISOString(), lastHeartbeat: now.toISOString() } : {}),
                expiresAt: expiresAt.toISOString(),
                ttlSeconds: ttl,
                ...metadata,
            };

            const newActiveCount = await redis.eval(
                ATOMIC_ADMIT_LUA,
                2,
                activeSetKey,
                tokenKey,
                ticketId,
                courseId,
                batchSizeToUse,
                ttl,
                JSON.stringify(tokenPayload)
            );

            if (newActiveCount > 0) {
                return {
                    admitted: true,
                    token: tokenPayload,
                    activeCount: newActiveCount,
                };
            }

            return { admitted: false };
        },

        /**
         * Phase 1 Token Generation: PENDING_ENTRY
         * Created when a student is admitted from the waiting queue.
         * Gives the student a time window (PENDING_ENTRY_TTL) to enter the registration session.
         * MUST add ticketId to active set so occupied slots are counted against BATCH_SIZE.
         *
         * @param {string} ticketId - Unique ticket / admission identifier
         * @param {string} courseId - Course ID
         * @param {object} [metadata={}] - Optional metadata
         * @returns {Promise<object>} Token payload
         */
        async createPendingEntryToken(ticketId, courseId, metadata = {}) {
            const key = `${config.TOKEN_PREFIX}${ticketId}`;
            const activeSetKey = `${config.ACTIVE_SET_PREFIX}${courseId}`;
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

            const pipeline = redis.pipeline();
            pipeline.set(key, JSON.stringify(tokenData), 'EX', config.PENDING_ENTRY_TTL);
            pipeline.sadd(activeSetKey, ticketId);
            await pipeline.exec();

            return tokenData;
        },

        /**
         * Phase 2 Token Generation: ACTIVE
         * Activates the session when a student starts the registration process.
         * Transitions token status from PENDING_ENTRY to ACTIVE, sets ACTIVE_TTL.
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
         * Generic create token helper
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
         */
        async getActiveCount(courseId) {
            const activeKey = `${config.ACTIVE_SET_PREFIX}${courseId}`;
            return await redis.scard(activeKey);
        },

        /**
         * Get all active ticket IDs for a course
         */
        async getActiveTokens(courseId) {
            const activeKey = `${config.ACTIVE_SET_PREFIX}${courseId}`;
            return await redis.smembers(activeKey);
        },

        /**
         * Cleanup Expired Tokens from Active Set
         * Uses Redis pipeline for high performance under high concurrency.
         */
        async cleanupExpired(courseId) {
            const activeKey = `${config.ACTIVE_SET_PREFIX}${courseId}`;
            const members = await redis.smembers(activeKey);
            if (!members || members.length === 0) {
                return 0;
            }

            // Pipeline 1: Check existence of all token keys in parallel
            const checkPipeline = redis.pipeline();
            for (const ticketId of members) {
                checkPipeline.exists(`${config.TOKEN_PREFIX}${ticketId}`);
            }
            const results = await checkPipeline.exec();

            // Pipeline 2: Remove expired ticket IDs from active set
            const cleanupPipeline = redis.pipeline();
            let cleanedCount = 0;

            members.forEach((ticketId, idx) => {
                const exists = results[idx] && results[idx][1] === 1;
                if (!exists) {
                    cleanupPipeline.srem(activeKey, ticketId);
                    cleanedCount++;
                }
            });

            if (cleanedCount > 0) {
                await cleanupPipeline.exec();
            }

            return cleanedCount;
        },
    };
};
