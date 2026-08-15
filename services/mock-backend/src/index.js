require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3010;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mock-registration';

// Middleware
app.use(cors());
app.use(express.json());

// ============================================
// Mock Course Registration Schema
// Intentionally simple — NO connection pooling,
// NO caching, NO rate limiting
// ============================================
const courseSchema = new mongoose.Schema({
  courseId: { type: String, required: true },
  courseName: { type: String, required: true },
  maxSlots: { type: Number, default: 40 },
  enrolled: { type: Number, default: 0 },
});

const registrationSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  courseId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const Course = mongoose.model('Course', courseSchema);
const Registration = mongoose.model('Registration', registrationSchema);

// ============================================
// Routes
// ============================================

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'mock-backend', timestamp: new Date().toISOString() });
});

// List courses
app.get('/api/courses', async (req, res) => {
  try {
    const courses = await Course.find();
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register for a course
// INTENTIONALLY SLOW — simulates unoptimized real-world system
app.post('/api/register', async (req, res) => {
  try {
    const { studentId, courseId } = req.body;

    // Intentional: no input validation, no duplicate check optimization
    // Intentional: artificial delay to simulate slow DB
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));

    const course = await Course.findOne({ courseId });
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (course.enrolled >= course.maxSlots) {
      return res.status(409).json({ error: 'Course is full' });
    }

    // Intentional race condition — no atomic update
    course.enrolled += 1;
    await course.save();

    const registration = new Registration({ studentId, courseId });
    await registration.save();

    res.status(201).json({
      message: 'Registration successful',
      studentId,
      courseId,
      position: course.enrolled,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Seed sample courses
app.post('/api/seed', async (req, res) => {
  try {
    await Course.deleteMany({});
    await Registration.deleteMany({});

    const sampleCourses = [
      { courseId: 'CS101', courseName: 'Nhập môn Lập trình', maxSlots: 40 },
      { courseId: 'CS201', courseName: 'Cấu trúc Dữ liệu', maxSlots: 35 },
      { courseId: 'CS301', courseName: 'Cơ sở Dữ liệu', maxSlots: 30 },
      { courseId: 'CS401', courseName: 'Mạng Máy tính', maxSlots: 25 },
      { courseId: 'CS501', courseName: 'Trí tuệ Nhân tạo', maxSlots: 20 },
    ];

    await Course.insertMany(sampleCourses);
    res.json({ message: 'Seeded successfully', count: sampleCourses.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// Start server
// ============================================
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('📦 Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`🎯 Mock Backend running on port ${PORT}`);
      console.log(`⚠️  This service is intentionally unoptimized for demo purposes`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
