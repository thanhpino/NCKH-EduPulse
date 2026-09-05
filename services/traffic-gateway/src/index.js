require('dotenv').config();
const express = require('express');
const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3002;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3010';
const MAX_ACTIVE_PER_COURSE = parseInt(process.env.MAX_ACTIVE_PER_COURSE) || 50;
const ADMISSION_RATE = parseInt(process.env.ADMISSION_RATE) || 50; // requests/second for ETA calc
const QUEUE_TTL = parseInt(process.env.QUEUE_TTL) || 300; // seconds

app.use(cors());
app.use(express.json());

const redis = new Redis(REDIS_URL);

// Helper: Promote next student in queue for a course when slot frees up
async function promoteNextInQueue(courseId) {
    try {
        const activeKey = `edupulse:active:${courseId}`;
        const queueKey = `edupulse:waiting-room:${courseId}`;

        const activeCount = await redis.scard(activeKey);
        if (activeCount < MAX_ACTIVE_PER_COURSE) {
            const popped = await redis.zpopmin(queueKey, 1);
            if (popped && popped.length > 0) {
                const ticketId = popped[0];
                await redis.set(
                    `ticket:${ticketId}`,
                    JSON.stringify({ status: 'PENDING_ENTRY', courseId, promotedAt: new Date().toISOString() }),
                    'EX',
                    QUEUE_TTL
                );
                console.log(`🟢 Promoted ticket ${ticketId} for course ${courseId}`);
            }
        }
    } catch (err) {
        console.error(`[promoteNextInQueue] Error for ${courseId}:`, err.message);
    }
}

// ============================================
// Virtual Waiting Room — Core API
// ============================================

// 1. Join queue for a course
app.post('/api/queue/join', async (req, res) => {
    try {
        const { studentId, courseId } = req.body;
        if (!courseId) {
            return res.status(400).json({ error: 'courseId is required' });
        }

        const ticketId = uuidv4();
        const score = Date.now();
        const activeKey = `edupulse:active:${courseId}`;
        const queueKey = `edupulse:waiting-room:${courseId}`;

        const activeCount = await redis.scard(activeKey);
        const waitingCount = await redis.zcard(queueKey);

        // Direct admission if slots available and nobody waiting
        if (activeCount < MAX_ACTIVE_PER_COURSE && waitingCount === 0) {
            await redis.set(
                `ticket:${ticketId}`,
                JSON.stringify({
                    studentId,
                    courseId,
                    createdAt: new Date().toISOString(),
                    status: 'PENDING_ENTRY',
                }),
                'EX',
                QUEUE_TTL
            );

            return res.status(201).json({
                ticketId,
                directAdmission: true,
                status: 'PENDING_ENTRY',
                position: 0,
                estimatedWaitSeconds: 0,
                message: 'Direct admission granted.',
            });
        }

        // Add to waiting queue
        await redis.zadd(queueKey, score, ticketId);
        await redis.set(
            `ticket:${ticketId}`,
            JSON.stringify({
                studentId,
                courseId,
                createdAt: new Date().toISOString(),
                status: 'waiting',
            }),
            'EX',
            QUEUE_TTL
        );

        const position = (await redis.zrank(queueKey, ticketId)) + 1;
        const eta = Math.ceil(position / ADMISSION_RATE);

        res.status(201).json({
            ticketId,
            directAdmission: false,
            status: 'waiting',
            position,
            totalInQueue: waitingCount + 1,
            estimatedWaitSeconds: eta,
            message: `You are #${position} in line. Estimated wait: ~${eta}s`,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Poll queue status for a ticket
app.get('/api/queue/status/:ticketId', async (req, res) => {
    try {
        const { ticketId } = req.params;
        const courseId = req.query.courseId;

        const ticketRaw = await redis.get(`ticket:${ticketId}`);
        if (!ticketRaw) {
            return res.status(404).json({ status: 'EXPIRED', message: 'Ticket expired or not found' });
        }

        const ticket = JSON.parse(ticketRaw);

        if (ticket.status === 'waiting' && courseId) {
            const queueKey = `edupulse:waiting-room:${courseId}`;
            const rank = await redis.zrank(queueKey, ticketId);
            if (rank !== null) {
                const position = rank + 1;
                const eta = Math.ceil(position / ADMISSION_RATE);
                return res.json({
                    ticketId,
                    status: 'waiting',
                    position,
                    estimatedWaitSeconds: eta,
                });
            }
        }

        res.json({
            ticketId,
            status: ticket.status,
            position: 0,
            estimatedWaitSeconds: 0,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Enter session (PENDING_ENTRY -> ACTIVE)
app.post('/api/session/enter', async (req, res) => {
    try {
        const { ticketId } = req.body;
        if (!ticketId) {
            return res.status(400).json({ error: 'ticketId is required' });
        }

        const ticketRaw = await redis.get(`ticket:${ticketId}`);
        if (!ticketRaw) {
            return res.status(404).json({ error: 'Ticket expired or invalid' });
        }

        const ticket = JSON.parse(ticketRaw);
        if (ticket.status !== 'PENDING_ENTRY' && ticket.status !== 'ACTIVE') {
            return res.status(400).json({ error: `Cannot enter session from status: ${ticket.status}` });
        }

        // Add ticket to active set for course
        if (ticket.courseId) {
            await redis.sadd(`edupulse:active:${ticket.courseId}`, ticketId);
        }

        ticket.status = 'ACTIVE';
        ticket.enteredAt = new Date().toISOString();
        await redis.set(`ticket:${ticketId}`, JSON.stringify(ticket), 'EX', QUEUE_TTL);

        res.json({ success: true, status: 'ACTIVE', ticketId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Register course (Proxies to mock-backend + revokes token)
app.post('/api/register', async (req, res) => {
    try {
        const { studentId, courseId, ticketId } = req.body;
        if (!studentId || !courseId) {
            return res.status(400).json({ error: 'studentId and courseId are required' });
        }

        // Proxy request to mock-backend
        const backendRes = await fetch(`${BACKEND_URL}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId, courseId }),
        });

        const data = await backendRes.json();

        if (backendRes.ok) {
            // REVOKE TOKEN & FREE ACTIVE SLOT
            if (ticketId && courseId) {
                await redis.srem(`edupulse:active:${courseId}`, ticketId);
                await redis.del(`ticket:${ticketId}`);
                console.log(`🔄 Token ${ticketId} revoked for course ${courseId}. Active slot freed.`);
                // Promote next student waiting in queue
                await promoteNextInQueue(courseId);
            }
            return res.status(backendRes.status).json(data);
        } else {
            return res.status(backendRes.status).json(data);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Admin: process queue manually
app.post('/api/queue/process', async (req, res) => {
    try {
        const { courseId, batchSize = 10 } = req.body;
        const queueKey = courseId ? `edupulse:waiting-room:${courseId}` : 'edupulse:waiting-room';
        const tickets = await redis.zrange(queueKey, 0, batchSize - 1);

        if (tickets.length === 0) {
            return res.json({ admitted: 0, message: 'Queue is empty' });
        }

        for (const ticketId of tickets) {
            await redis.set(
                `ticket:${ticketId}`,
                JSON.stringify({ status: 'PENDING_ENTRY', courseId }),
                'EX',
                QUEUE_TTL
            );
            await redis.zrem(queueKey, ticketId);
        }

        res.json({ admitted: tickets.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'traffic-gateway', maxActive: MAX_ACTIVE_PER_COURSE });
});

// Start server
redis.on('connect', () => {
    console.log('🔴 Traffic Gateway connected to Redis');
});

app.listen(PORT, () => {
    console.log(`🚦 Traffic Shaping Gateway running on port ${PORT}`);
    console.log(`   Backend target: ${BACKEND_URL}`);
    console.log(`   Max active per course: ${MAX_ACTIVE_PER_COURSE}`);
});
