// Traffic Gateway - Centralized Configuration

require('dotenv').config();

module.exports = {
    // Server
    PORT: parseInt(process.env.PORT) || 3002,
    NODE_ENV: process.env.NODE_ENV || 'development',

    // Redis
    REDIS_URL: process.env.REDIS_URL || 'redis://redis-gateway:6379',

    // Mock Backend
    MOCK_BACKEND_URL: process.env.MOCK_BACKEND_URL || 'http://mock-backend:3010',

    // Batch Admission Control
    BATCH_SIZE: parseInt(process.env.BATCH_SIZE) || 50,
    ADMISSION_INTERVAL: parseInt(process.env.ADMISSION_INTERVAL) || 2000,

    // Token TTL
    TOKEN_TTL: parseInt(process.env.TOKEN_TTL) || 180,

    // Redis Key Prefixes
    QUEUE_PREFIX: 'edupulse:queue:',
    TOKEN_PREFIX: 'edupulse:token:',
    ACTIVE_SET_PREFIX: 'edupulse:active:',
};