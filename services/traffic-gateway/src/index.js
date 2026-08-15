require('dotenv').config();
const express = require('express');
const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3002;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Admission control config — will be adjusted by Capacity Advisor
let admissionRate = parseInt(process.env.ADMISSION_RATE) || 50; // requests/second
const QUEUE_TTL = parseInt(process.env.QUEUE_TTL) || 300; // seconds

app.use(cors());
app.use(express.json());

const redis = new Redis(REDIS_URL);
const QUEUE_KEY = 'edupulse:waiting-room';

// ============================================
// Virtual Waiting Room — Core Logic
// ============================================

// Request a ticket to enter the queue
app.post('/api/queue/join', async (req, res) => {
    try {
        const ticketId = uuidv4();
        const score = Date.now();

        // ZADD — add to sorted set (fair FIFO ordering by timestamp)
        await redis.zadd(QUEUE_KEY, score, ticketId);

        // Set TTL for this ticket
        await redis.set(`ticket:${ticketId}`, JSON.stringify({
            createdAt: new Date().toISOString(),
            status: 'waiting',
        }), 'EX', QUEUE_TTL);

        // Get position in queue
        const position = await redis.zrank(QUEUE_KEY, ticketId);
        const totalInQueue = await redis.zcard(QUEUE_KEY);
        const eta = Math.ceil((position + 1) / admissionRate);

        res.status(201).json({
            ticketId,
            position: position + 1,
            totalInQueue,
            estimatedWaitSeconds: eta,
            message: `You are #${position + 1} in line. Estimated wait: ~${eta}s`,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Check position in queue
app.get('/api/queue/status/:ticketId', async (req, res) => {
    try {
        const { ticketId } = req.params;
        const position = await redis.zrank(QUEUE_KEY, ticketId);

        if (position === null) {
            // Ticket not in queue — either admitted or expired
            const ticketData = await redis.get(`ticket:${ticketId}`);
            if (ticketData) {
                const parsed = JSON.parse(ticketData);
                if (parsed.status === 'admitted') {
                    return res.json({ status: 'admitted', message: 'You have been admitted! Proceed.' });
                }
            }
            return res.status(404).json({ status: 'expired', message: 'Ticket not found or expired' });
        }

        const totalInQueue = await redis.zcard(QUEUE_KEY);
        const eta = Math.ceil((position + 1) / admissionRate);

        res.json({
            ticketId,
            status: 'waiting',
            position: position + 1,
            totalInQueue,
            estimatedWaitSeconds: eta,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: process queue — admit next batch
app.post('/api/queue/process', async (req, res) => {
    try {
        const batchSize = req.body.batchSize || admissionRate;

        // Get and remove the first N tickets from sorted set
        const tickets = await redis.zrange(QUEUE_KEY, 0, batchSize - 1);
        if (tickets.length === 0) {
            return res.json({ admitted: 0, message: 'Queue is empty' });
        }

        // Mark as admitted and remove from queue
        const pipeline = redis.pipeline();
        for (const ticketId of tickets) {
            pipeline.set(`ticket:${ticketId}`, JSON.stringify({ status: 'admitted', admittedAt: new Date().toISOString() }), 'EX', 60);
            pipeline.zrem(QUEUE_KEY, ticketId);
        }
        await pipeline.exec();

        const remaining = await redis.zcard(QUEUE_KEY);
        res.json({
            admitted: tickets.length,
            remaining,
            admissionRate,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin: adjust admission rate (called by Capacity Advisor)
app.put('/api/config/admission-rate', (req, res) => {
    const { rate } = req.body;
    if (!rate || rate < 1) {
        return res.status(400).json({ error: 'Rate must be >= 1' });
    }
    const oldRate = admissionRate;
    admissionRate = rate;
    console.log(`⚙️ Admission rate changed: ${oldRate} → ${rate} req/s`);
    res.json({ oldRate, newRate: admissionRate });
});

// Queue stats (for dashboard)
app.get('/api/queue/stats', async (req, res) => {
    try {
        const totalInQueue = await redis.zcard(QUEUE_KEY);
        res.json({
            totalInQueue,
            admissionRate,
            estimatedClearTime: totalInQueue > 0 ? Math.ceil(totalInQueue / admissionRate) : 0,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'traffic-gateway', admissionRate });
});

// ============================================
// Start
// ============================================
redis.on('connect', () => {
    console.log('🔴 Connected to Redis');
});

app.listen(PORT, () => {
    console.log(`🚦 Traffic Shaping Gateway running on port ${PORT}`);
    console.log(`   Admission rate: ${admissionRate} req/s`);
});
