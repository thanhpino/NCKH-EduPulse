const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
let redisClient = null;
let isRedisConnected = false;

try {
    redisClient = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 2,
        enableOfflineQueue: false,
        retryStrategy(times) {
            if (times > 5) {
                console.warn('⚠️ Redis max retries reached. Operating without Redis caching.');
                return null;
            }
            return Math.min(times * 1000, 3000);
        },
    });

    redisClient.on('connect', () => {
        isRedisConnected = true;
        console.log(`⚡ Connected to Redis Telemetry Cache (${REDIS_URL})`);
    });

    redisClient.on('error', (err) => {
        isRedisConnected = false;
        // Suppress noisy error logs on fallback
    });
} catch (err) {
    console.warn(`⚠️ Could not initialize Redis client: ${err.message}`);
}

async function getCache(key) {
    if (!isRedisConnected || !redisClient) return null;
    try {
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
    } catch (err) {
        return null;
    }
}

async function setCache(key, value, ttlSeconds = 5) {
    if (!isRedisConnected || !redisClient) return;
    try {
        await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
        // Ignore cache write errors
    }
}

module.exports = {
    getCache,
    setCache,
    isRedisConnected: () => isRedisConnected,
};
