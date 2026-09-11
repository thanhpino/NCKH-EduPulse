// Traffic Shaping Gateway — Main Entry Point
// EduPulse Microservice Gateway (Batch + 2-Phase Token + Fallback)

const express = require('express');
const Redis = require('ioredis');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const config = require('./config');
const proxyModule = require('./proxy');
const fallbackModule = require('./fallback');
const admissionModule = require('./admission');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Redis client — fail-fast mode with offline queue disabled
const redis = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 100, 2000),
    enableOfflineQueue: false, // Fail immediately when Redis is down, allowing fallback middleware to handle cleanly
});

const logger = console;

// Initialize proxy & fallback
const proxy = proxyModule(logger);
const fallback = fallbackModule(redis, proxy, logger);

// Dynamically load queue & token modules
let queue = null;
let token = null;
let admission = null;

try {
    const queueModule = require('./queue');
    const tokenModule = require('./token');
    queue = queueModule(redis, config);
    token = tokenModule(redis, config);
    admission = admissionModule(redis, queue, token, logger);

    // Start background admission loop
    admission.startAdmissionLoop();
    logger.info('Admission loop initialized');
} catch (err) {
    logger.warn('queue.js or token.js failed to load (running in standby mode):', err.message);
    if (err.stack && !err.message.includes('Cannot find module')) {
        logger.warn(err.stack); // Full stack trace if it's a code bug inside queue.js/token.js
    }
}

// Start Redis health check loop
fallback.startHealthCheckLoop();

// ROUTES

// 0. Get Courses List (Proxy to Mock Backend for Student UI)
app.get('/api/courses', async (req, res) => {
    try {
        const url = `${config.MOCK_BACKEND_URL}/api/courses`;
        const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (err) {
        logger.error('Error fetching courses from mock backend:', err.message);
        res.status(502).json({ error: 'Failed to fetch course catalog' });
    }
});

// 0.5. Get Student Registrations List (Proxy to Mock Backend)
app.get('/api/registrations', async (req, res) => {
    try {
        const studentId = req.query.studentId;
        const url = studentId
            ? `${config.MOCK_BACKEND_URL}/api/registrations?studentId=${studentId}`
            : `${config.MOCK_BACKEND_URL}/api/registrations`;
        const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (err) {
        logger.error('Error fetching registrations from mock backend:', err.message);
        res.status(502).json({ error: 'Failed to fetch registrations' });
    }
});

// 0.6. Unregister / Drop Courses Proxy
app.delete('/api/unregister', async (req, res) => {
    try {
        const response = await fetch(`${config.MOCK_BACKEND_URL}/api/unregister`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body),
        });
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (err) {
        logger.error('Error in /api/unregister proxy:', err.message);
        res.status(502).json({ error: 'Failed to unregister courses' });
    }
});

// 0.7. Student Login (Proxy to Mock Backend)
app.post('/api/login', async (req, res) => {
    try {
        const url = `${config.MOCK_BACKEND_URL}/api/login`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body),
            signal: AbortSignal.timeout(5000),
        });
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (err) {
        logger.error('Error proxying login to mock backend:', err.message);
        res.status(502).json({ error: 'Failed to connect to authentication service' });
    }
});

// 1. Join Queue — Enqueue student for a course
app.post('/api/queue/join', fallback.requireRedis, async (req, res) => {
    if (!queue) {
        return res.status(503).json({ error: 'Queue service module not ready yet' });
    }

    try {
        const { studentId, courseId } = req.body;
        if (!studentId || !courseId) {
            return res.status(400).json({ error: 'studentId and courseId are required' });
        }

        // [COURSE FULL CHECK] — Reject immediately if course is already full
        const isFull = await redis.get(`course:${courseId}:full`);
        if (isFull) {
            return res.status(409).json({
                status: 'course_full',
                courseId,
                message: 'Môn học đã đủ sĩ số. Vui lòng chọn nhóm khác còn trống slot hoặc chờ kỳ sau đăng ký.',
            });
        }

        const ticketId = uuidv4();
        const batchSize = admission ? admission.getBatchSize() : config.BATCH_SIZE;
        const result = await queue.enqueue(ticketId, courseId, { studentId }, batchSize);

        if (result && result.directAdmission) {
            return res.status(201).json({
                ticketId,
                studentId,
                courseId,
                directAdmission: true,
                status: config.TOKEN_STATUS.ACTIVE,
                message: 'Capacity available. Direct ACTIVE token granted.',
            });
        }

        const position = await queue.getPosition(ticketId, courseId);
        const totalInQueue = await queue.getQueueLength(courseId);

        // Wave-based ETA calculation (Waves needed * ACTIVE_TTL)
        const wavesNeeded = Math.ceil(position / batchSize);
        const estimatedWaitSeconds = wavesNeeded * config.ACTIVE_TTL;

        res.status(201).json({
            ticketId,
            studentId,
            courseId,
            position,
            totalInQueue,
            estimatedWaitSeconds,
            status: 'waiting',
            message: `You are #${position} in line for ${courseId}. Estimated wait: ~${estimatedWaitSeconds}s`,
        });
    } catch (err) {
        logger.error('Error in /api/queue/join:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// 2. Check Queue / Token Status
app.get('/api/queue/status/:ticketId', fallback.requireRedis, async (req, res) => {
    if (!queue || !token) {
        return res.status(503).json({ error: 'Queue/Token service module not ready yet' });
    }

    try {
        const { ticketId } = req.params;
        const courseId = req.query.courseId;

        // [COURSE FULL CHECK] — Check if course is already full before anything else
        if (courseId) {
            const isFull = await redis.get(`course:${courseId}:full`);
            if (isFull) {
                return res.json({
                    ticketId,
                    courseId,
                    status: 'course_full',
                    message: 'Môn học đã đủ sĩ số. Vui lòng chọn nhóm khác còn trống slot hoặc chờ kỳ sau đăng ký.',
                });
            }
        }

        // Check token first (if already admitted)
        const tokenData = await token.verifyToken ? await token.verifyToken(ticketId) : await token.verify(ticketId);
        if (tokenData) {
            return res.json({
                ticketId,
                status: tokenData.status, // PENDING_ENTRY or ACTIVE
                courseId: tokenData.courseId,
                message: tokenData.status === config.TOKEN_STATUS.PENDING_ENTRY
                    ? 'You have been admitted! Click "Enter Session" to start.'
                    : 'Your session is active. You can register.',
            });
        }

        // If not in token store, check queue position
        if (courseId) {
            const position = await queue.getPosition(ticketId, courseId);
            if (position !== null) {
                const totalInQueue = await queue.getQueueLength(courseId);
                const batchSize = admission ? admission.getBatchSize() : config.BATCH_SIZE;
                const wavesNeeded = Math.ceil(position / batchSize);
                const estimatedWaitSeconds = wavesNeeded * config.ACTIVE_TTL;

                return res.json({
                    ticketId,
                    courseId,
                    status: 'waiting',
                    position,
                    totalInQueue,
                    estimatedWaitSeconds,
                });
            }
        }

        // Neither in active/pending token nor in queue → expired or invalid
        res.status(404).json({
            ticketId,
            status: 'expired',
            error: 'Ticket not found or expired',
        });
    } catch (err) {
        logger.error('Error in /api/queue/status:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// 3. Enter Session — Transition from PENDING_ENTRY → ACTIVE
app.post('/api/session/enter', fallback.requireRedis, async (req, res) => {
    if (!admission) {
        return res.status(503).json({ error: 'Admission module not ready yet' });
    }

    try {
        const { ticketId } = req.body;
        if (!ticketId) {
            return res.status(400).json({ error: 'ticketId is required' });
        }

        const result = await admission.enterSession(ticketId);
        if (!result) {
            return res.status(403).json({
                error: 'Cannot enter session: Token expired or not in PENDING_ENTRY status',
            });
        }

        res.json({
            success: true,
            ticketId,
            status: config.TOKEN_STATUS.ACTIVE,
            ttl: config.ACTIVE_TTL,
            message: 'Session activated! You have 3 minutes to complete registration.',
        });
    } catch (err) {
        logger.error('Error in /api/session/enter:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// 4. Session Heartbeat — Keep active session alive
app.post('/api/session/heartbeat', fallback.requireRedis, async (req, res) => {
    if (!admission) {
        return res.status(503).json({ error: 'Admission module not ready yet' });
    }

    try {
        const { ticketId } = req.body;
        if (!ticketId) {
            return res.status(400).json({ error: 'ticketId is required' });
        }

        const result = await admission.heartbeat(ticketId);
        if (!result.ok) {
            return res.status(403).json(result);
        }

        res.json({ ok: true, ticketId, extendedTTL: config.ACTIVE_TTL });
    } catch (err) {
        logger.error('Error in /api/session/heartbeat:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// 5. Course Registration — Final Registration Endpoint
app.post('/api/register', async (req, res) => {
    try {
        const { studentId, courseId, ticketId } = req.body;
        if (!studentId || !courseId) {
            return res.status(400).json({ error: 'studentId and courseId are required' });
        }

        // Fallback mode check: If Redis is down, pass through directly
        if (!fallback.getStatus()) {
            const fallbackResult = await fallback.passThroughRegister(studentId, courseId);
            return res.status(fallbackResult.status).json(fallbackResult.data || { error: fallbackResult.error });
        }

        // Normal mode: Token verification required
        if (!token) {
            return res.status(503).json({ error: 'Token module not ready yet' });
        }

        if (!ticketId) {
            return res.status(400).json({ error: 'ticketId is required for registration' });
        }

        const tokenData = await token.verifyToken ? await token.verifyToken(ticketId) : await token.verify(ticketId);
        if (!tokenData || tokenData.status !== config.TOKEN_STATUS.ACTIVE) {
            return res.status(403).json({
                error: 'Access denied: Valid ACTIVE session token required',
            });
        }

        // Forward to Mock Backend
        const result = await proxy.forwardRegistration(studentId, courseId, ticketId);

        if (result.success) {
            // Revoke token upon successful registration
            const revokeFn = token.revokeToken ? token.revokeToken.bind(token) : token.revoke.bind(token);
            await revokeFn(ticketId, courseId);

            // [COURSE FULL CHECK] — After successful registration, check if course is now full
            try {
                const courseRes = await fetch(`${config.MOCK_BACKEND_URL}/api/courses`);
                const allCourses = await courseRes.json();
                const thisCourse = allCourses.find(c => c.courseId === courseId);
                if (thisCourse && thisCourse.enrolled >= thisCourse.maxSlots) {
                    // Mark course as full in Redis (TTL 2 hours)
                    await redis.set(`course:${courseId}:full`, '1', 'EX', 7200);
                    // Clear the entire waiting queue — no point keeping students waiting
                    if (queue) await queue.clearQueue(courseId);
                    logger.info(`📛 Course ${courseId} is now FULL (${thisCourse.enrolled}/${thisCourse.maxSlots}). Queue cleared.`);
                }
            } catch (e) {
                logger.warn(`Could not check course full status for ${courseId}:`, e.message);
            }

            // Trigger admission loop right away so remaining slots get filled fast
            if (admission) {
                admission.admitBatch(courseId).catch(e => logger.error('Error admitting next batch', e));
            }
            return res.status(result.status).json(result.data);
        } else {
            return res.status(result.status).json({ error: result.error });
        }
    } catch (err) {
        logger.error('Error in /api/register:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// 6. Direct Pass-Through Register Endpoint (for fallback testing or emergency)
app.post('/api/register/direct', async (req, res) => {
    try {
        const { studentId, courseId } = req.body;
        if (!studentId || !courseId) {
            return res.status(400).json({ error: 'studentId and courseId are required' });
        }
        const result = await fallback.passThroughRegister(studentId, courseId);
        res.status(result.status).json(result.data || { error: result.error });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. Config Update Endpoint (called by Capacity Advisor)
app.put('/api/config/admission-rate', (req, res) => {
    try {
        const { rate, batchSize } = req.body;
        const newSize = batchSize || rate;
        if (!newSize || newSize < 1) {
            return res.status(400).json({ error: 'batchSize / rate must be >= 1' });
        }

        if (admission) {
            const oldSize = admission.getBatchSize();
            admission.setBatchSize(newSize);
            return res.json({ oldBatchSize: oldSize, newBatchSize: newSize });
        } else {
            return res.status(503).json({ error: 'Admission module not ready' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reset Queue Endpoint (for dev/testing cleanup)
app.post('/api/queue/reset', async (req, res) => {
    try {
        const keys = await redis.keys('edupulse:*');
        if (keys.length > 0) {
            await redis.del(...keys);
        }
        const ticketKeys = await redis.keys('ticket:*');
        if (ticketKeys.length > 0) {
            await redis.del(...ticketKeys);
        }

        // Also trigger seed on Mock Backend to reset MongoDB course slots and registrations
        let dbSeeded = false;
        try {
            await fetch(`${config.MOCK_BACKEND_URL}/api/seed`, { method: 'POST' });
            dbSeeded = true;
        } catch (e) {
            logger.warn('Failed to call mock backend seed during reset:', e.message);
        }

        logger.info('🧹 Queue, active tokens, and course slots reset successfully');
        res.json({
            message: 'System reset successfully: Redis queues cleared & MongoDB course slots reset to 0.',
            clearedKeys: keys.length + ticketKeys.length,
            dbSeeded,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 8. Queue Stats (for Dashboard monitoring)
app.get('/api/queue/stats', async (req, res) => {
    try {
        const batchSize = admission ? admission.getBatchSize() : config.BATCH_SIZE;
        const redisAlive = fallback.getStatus();

        res.json({
            service: 'traffic-gateway',
            redisAlive,
            batchSize,
            admissionIntervalMs: config.ADMISSION_INTERVAL,
            pendingEntryTTL: config.PENDING_ENTRY_TTL,
            activeTTL: config.ACTIVE_TTL,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 9. Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'traffic-gateway',
        redisAlive: fallback.getStatus(),
        batchSize: admission ? admission.getBatchSize() : config.BATCH_SIZE,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

// Server Start
redis.on('connect', () => {
    logger.info('🔴 Connected to Redis');
});

redis.on('error', (err) => {
    logger.error('❌ Redis Connection Error:', err.message);
});

app.listen(config.PORT, () => {
    logger.info(`🚦 Traffic Shaping Gateway running on port ${config.PORT}`);
    logger.info(`   Batch Size: ${config.BATCH_SIZE}, Interval: ${config.ADMISSION_INTERVAL}ms`);
});
