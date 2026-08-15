require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/edupulse-registry';

app.use(cors());
app.use(express.json());

// ============================================
// Target Schema — monitoring targets
// ============================================
const targetSchema = new mongoose.Schema({
    name: { type: String, required: true },
    url: { type: String, required: true },
    healthEndpoint: { type: String, default: '/health' },
    thresholds: {
        maxLatencyMs: { type: Number, default: 2000 },
        maxErrorRate: { type: Number, default: 0.1 },
        maxConcurrent: { type: Number, default: 500 },
    },
    registrationWindow: {
        startTime: { type: String },  // e.g. "07:00"
        endTime: { type: String },    // e.g. "09:00"
        days: [{ type: String }],     // e.g. ["Monday", "Tuesday"]
    },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

const Target = mongoose.model('Target', targetSchema);

// ============================================
// Routes
// ============================================

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'registry-service' });
});

// CRUD for targets
app.get('/api/targets', async (req, res) => {
    try {
        const targets = await Target.find();
        res.json(targets);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/targets/:id', async (req, res) => {
    try {
        const target = await Target.findById(req.params.id);
        if (!target) return res.status(404).json({ error: 'Target not found' });
        res.json(target);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/targets', async (req, res) => {
    try {
        const target = new Target(req.body);
        await target.save();
        res.status(201).json(target);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.put('/api/targets/:id', async (req, res) => {
    try {
        const target = await Target.findByIdAndUpdate(
            req.params.id,
            { ...req.body, updatedAt: new Date() },
            { new: true }
        );
        if (!target) return res.status(404).json({ error: 'Target not found' });
        res.json(target);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/api/targets/:id', async (req, res) => {
    try {
        const target = await Target.findByIdAndDelete(req.params.id);
        if (!target) return res.status(404).json({ error: 'Target not found' });
        res.json({ message: 'Target deleted' });
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
        console.log('📦 Registry Service connected to MongoDB');
        app.listen(PORT, () => {
            console.log(`📋 Registry Service running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error('❌ MongoDB connection error:', err.message);
        process.exit(1);
    });
