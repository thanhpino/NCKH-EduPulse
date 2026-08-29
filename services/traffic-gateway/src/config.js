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

    // 2-Phase Token TTL (seconds)
    PENDING_ENTRY_TTL: parseInt(process.env.PENDING_ENTRY_TTL) || 180, // 3p (180s) — chờ SV kích hoạt session sau khi admit
    ACTIVE_TTL: parseInt(process.env.ACTIVE_TTL) || 180,               // 3p (180s) — thời gian phiên làm việc active
    HEARTBEAT_INTERVAL: parseInt(process.env.HEARTBEAT_INTERVAL) || 20, // 20s — khoảng thời gian gửi heartbeat

    // Token Status Constants
    TOKEN_STATUS: {
        PENDING_ENTRY: 'PENDING_ENTRY',
        ACTIVE: 'ACTIVE',
    },

    // Redis Key Prefixes & Sets
    QUEUE_PREFIX: 'edupulse:queue:',            // edupulse:queue:{courseId}        → Sorted Set (no TTL)
    TOKEN_PREFIX: 'edupulse:token:',            // edupulse:token:{ticketId}        → String (JSON)
    ACTIVE_SET_PREFIX: 'edupulse:active:',      // edupulse:active:{courseId}       → Set
    COURSES_SET_KEY: 'edupulse:courses:active', // Set contains courseId

    // Redis Fallback
    REDIS_PING_TIMEOUT: 2000, // ms
};