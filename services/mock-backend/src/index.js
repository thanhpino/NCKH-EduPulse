require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3010;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mock-registration';

// Middleware
app.use(cors());
app.use(express.json());

// Mock Course Registration Schema
// Intentionally simple — NO connection pooling,
// NO caching, NO rate limiting

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

const testStudentSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  passwordHash: { type: String, required: true},
});
// Compound unique index — đảm bảo 1 SV chỉ đăng ký 1 môn duy nhất 1 lần ở tầng DB (chống race condition)
registrationSchema.index({ studentId: 1, courseId: 1 }, { unique: true });

const Course = mongoose.model('Course', courseSchema);
const Registration = mongoose.model('Registration', registrationSchema);
const TestStudent = mongoose.model('TestStudent', testStudentSchema);

// Routes

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

    // Validate studentId
    if (!studentId || studentId.trim() === '') {
      return res.status(400).json({ error: 'Registration student ID is missing or blank' });
    }
    if (!courseId || courseId.trim() === '') {
      return res.status(400).json({ error: 'Registration course ID is missing or blank' });
    }

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
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Student already registered for this course' });
    }
    res.status(500).json({ error: err.message });
  }
});

// List registrations — dùng để verify flow end-to-end
// Optional filter: ?studentId=B2012345
app.get('/api/registrations', async (req, res) => {
  try {
    const filter = req.query.studentId ? { studentId: req.query.studentId } : {};
    const registrations = await Registration.find(filter).sort({ timestamp: -1 });
    res.json({ count: registrations.length, registrations });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Student already registered for this course' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Seed sample courses 
const sampleCourses = [
  { courseId: 'CS101', courseName: 'Nhập môn Lập trình', maxSlots: 120 },
  { courseId: 'CS201', courseName: 'Cấu trúc Dữ liệu', maxSlots: 80 },
  { courseId: 'CS301', courseName: 'Cơ sở Dữ liệu', maxSlots: 60 },
  { courseId: 'CS401', courseName: 'Mạng Máy tính', maxSlots: 50 },
  { courseId: 'CS501', courseName: 'Trí tuệ Nhân tạo', maxSlots: 40 },
];

app.post('/api/seed', async (req, res) => {
  try {
    await Course.deleteMany({});
    await Registration.deleteMany({});
    await Course.insertMany(sampleCourses);
    res.json({ message: 'Seeded successfully', count: sampleCourses.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Populate testStudentSchema table with 4 test accounts
// Passwords hashed directly inside the method
const seedStudentsHandler = async (req, res) => {
  try {
    await TestStudent.deleteMany({});

    const testAccounts = [
      { studentId: '52000001', password: 'Password123@' },
      { studentId: '52000002', password: 'Password123@' },
      { studentId: '52000003', password: 'Password123@' },
      { studentId: '52000004', password: 'Password123@' },
    ];

    // Hash passwords directly inside the method using crypto SHA-256
    const hashedAccounts = testAccounts.map((account) => {
      const passwordHash = crypto
        .createHash('sha256')
        .update(account.password)
        .digest('hex');

      return {
        studentId: account.studentId,
        passwordHash,
      };
    });

    await TestStudent.insertMany(hashedAccounts);

    res.status(201).json({
      message: 'Populated testStudentSchema table with 4 test accounts successfully',
      count: hashedAccounts.length,
      accounts: testAccounts.map((acc, index) => ({
        studentId: acc.studentId,
        plainPassword: acc.password,
        passwordHash: hashedAccounts[index].passwordHash,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

app.post('/api/seed-students', seedStudentsHandler);
app.post('/api/students/seed', seedStudentsHandler);

// Get all test students
app.get('/api/test-students', async (req, res) => {
  try {
    const students = await TestStudent.find({}, { __v: 0 });
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tests registration and outputs responses sequentially
app.post('/api/test-register', async (req, res) => {
  try {
    await Registration.deleteMany({}); // Clear previous test data

    const sampleRegs = [
      { studentId: 'SV20210001', courseId: 'CS101' },
      { studentId: 'SV20220055', courseId: 'CS201' },
      { studentId: 'SV20230199', courseId: 'CS501' },
      { studentId: '', courseId: 'CS101' },
      { studentId: null, courseId: 'CS201' },
      { studentId: '   ', courseId: 'CS301' },
      { courseId: 'CS401' },
      { studentId: 'SV20210002', courseId: '' },
      { studentId: 'SV20210002', courseId: null },
      { studentId: 'SV20210002', courseId: '   ' },
      { studentId: 'SV20200888' },
      { studentId: '', courseId: '' },
      { studentId: 'SV20210001', courseId: 'INVALID999' }
    ];

    // Set headers for streaming chunked data
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Transfer-Encoding', 'chunked');

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    // Iterate through the array and send actual HTTP POST requests
    for (const regData of sampleRegs) {
      let resultChunk;
      try {
        const response = await fetch(`${baseUrl}/api/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(regData)
        });

        const responseData = await response.json();

        resultChunk = {
          payload: regData,
          status: response.status,
          success: response.ok,
          response: responseData
        };
      } catch (fetchErr) {
        resultChunk = {
          payload: regData,
          success: false,
          error: fetchErr.message
        };
      }

      // Log to the server console
      console.log(`[TEST-REGISTER] Processed: ${JSON.stringify(resultChunk)}`);

      // Write immediately to the client connection
      res.write(JSON.stringify(resultChunk) + '\n');
    }

    // Close the connection when the loop is done
    res.end();

  } catch (err) {
    // If the headers were already sent, we can't use res.status()
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.end(JSON.stringify({ error: err.message }) + '\n');
    }
  }
});

// ============================================
// Start server
mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log('📦 Connected to MongoDB');
    await Registration.syncIndexes();
    for (const c of sampleCourses) {
      await Course.updateOne(
        { courseId: c.courseId },
        { $set: { maxSlots: c.maxSlots, courseName: c.courseName } },
        { upsert: true }
      );
    }
    app.listen(PORT, () => {
      console.log(`🎯 Mock Backend running on port ${PORT}`);
      console.log(`⚠️  This service is intentionally unoptimized for demo purposes`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
