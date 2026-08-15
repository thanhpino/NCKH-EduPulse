require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3005;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27018/edupulse-alerts';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

app.use(cors());
app.use(express.json());

// ============================================
// Alert Schema
// ============================================
const alertSchema = new mongoose.Schema({
    level: { type: String, enum: ['info', 'warning', 'critical'], required: true },
    source: { type: String, required: true },
    message: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed },
    acknowledged: { type: Boolean, default: false },
    sentViaTelegram: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
});

const Alert = mongoose.model('Alert', alertSchema);

// ============================================
// Telegram integration
// ============================================
async function sendTelegram(text) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.log('⚠️  Telegram not configured, skipping notification');
        return false;
    }

    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text,
            parse_mode: 'HTML',
        });
        return true;
    } catch (err) {
        console.error('❌ Telegram send failed:', err.message);
        return false;
    }
}

function formatAlertMessage(alert) {
    const icons = { info: 'ℹ️', warning: '⚠️', critical: '🚨' };
    return `${icons[alert.level]} <b>EduPulse Alert [${alert.level.toUpperCase()}]</b>\n\n` +
        `<b>Source:</b> ${alert.source}\n` +
        `<b>Message:</b> ${alert.message}\n` +
        `<b>Time:</b> ${new Date().toLocaleString('vi-VN')}`;
}

// ============================================
// Routes
// ============================================

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'alert-service' });
});

// Create an alert
app.post('/api/alerts', async (req, res) => {
    try {
        const { level, source, message, metadata } = req.body;
        const alert = new Alert({ level, source, message, metadata });

        // Send Telegram for warning and critical only
        if (level === 'warning' || level === 'critical') {
            const sent = await sendTelegram(formatAlertMessage(alert));
            alert.sentViaTelegram = sent;
        }

        await alert.save();
        res.status(201).json(alert);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// List alerts
app.get('/api/alerts', async (req, res) => {
    try {
        const { level, limit = 50, acknowledged } = req.query;
        const filter = {};
        if (level) filter.level = level;
        if (acknowledged !== undefined) filter.acknowledged = acknowledged === 'true';

        const alerts = await Alert.find(filter).sort({ createdAt: -1 }).limit(parseInt(limit));
        res.json(alerts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Acknowledge an alert
app.patch('/api/alerts/:id/acknowledge', async (req, res) => {
    try {
        const alert = await Alert.findByIdAndUpdate(req.params.id, { acknowledged: true }, { new: true });
        if (!alert) return res.status(404).json({ error: 'Alert not found' });
        res.json(alert);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// Start
// ============================================
mongoose
    .connect(MONGO_URI)
    .then(() => {
        console.log('📦 Alert Service connected to MongoDB');
        app.listen(PORT, () => {
            console.log(`🔔 Alert Service running on port ${PORT}`);
            console.log(`   Telegram: ${TELEGRAM_BOT_TOKEN ? '✅ configured' : '⚠️  not configured'}`);
        });
    })
    .catch((err) => {
        console.error('❌ MongoDB connection error:', err.message);
        process.exit(1);
    });
