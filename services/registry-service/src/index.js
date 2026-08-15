const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// --- Database Connection ---
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/edupulse-registry';

mongoose.connect(MONGO_URI)
    .then(() => console.log('📦 Connected to MAIN Registry MongoDB'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// --- Database Schemas & Models ---
// 1. Khóa học (Courses)
const courseSchema = new mongoose.Schema({
    courseId: { type: String, required: true, unique: true },
    courseName: { type: String, required: true },
    maxSlots: { type: Number, required: true },
    currentEnrolled: { type: Number, default: 0 },
    status: { type: String, enum: ['OPEN', 'FULL', 'CLOSED'], default: 'OPEN' }
}, { timestamps: true });

const Course = mongoose.model('Course', courseSchema);

// 2. Đăng ký thành công (Registrations)
const registrationSchema = new mongoose.Schema({
    studentId: { type: String, required: true },
    courseId: { type: String, required: true },
    status: { type: String, enum: ['SUCCESS', 'CANCELLED'], default: 'SUCCESS' }
}, { timestamps: true });

// Đánh Index kép để chốt slot cực nhanh, tránh Race Condition
registrationSchema.index({ studentId: 1, courseId: 1 }, { unique: true });

const Registration = mongoose.model('Registration', registrationSchema);

// --- APIs ---

// 1. Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'registry-service', timestamp: new Date() });
});

// 2. Lấy danh sách khóa học (Dành cho Dashboard/Gateway)
app.get('/api/courses', async (req, res) => {
    try {
        const courses = await Course.find();
        res.json(courses);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. API Đăng Ký XỊN (Chỉ Frontend Xếp Hàng xong hoặc Gateway Gọi Tới)
app.post('/api/enroll', async (req, res) => {
    const { studentId, courseId } = req.body;
    if (!studentId || !courseId) return res.status(400).json({ error: 'Missing Data' });

    // Sử dụng transaction/session nếu cần, ở đây viết logic cơ bản
    try {
        const course = await Course.findOne({ courseId });
        if (!course) return res.status(404).json({ error: 'Course not found' });

        if (course.currentEnrolled >= course.maxSlots) {
            // Khác với mock backend, API này trả về 400 (Bad request) nếu full, 
            // vì Gateway đáng lẽ ko nên thả lố người vào
            return res.status(400).json({ error: 'Course is strictly FULL' });
        }

        // Tăng slot bằng Atomic Update (Tránh xung đột)
        const updatedCourse = await Course.findOneAndUpdate(
            { courseId, currentEnrolled: { $lt: course.maxSlots } },
            { $inc: { currentEnrolled: 1 } },
            { new: true }
        );

        if (!updatedCourse) {
            return res.status(409).json({ error: 'Conflict: Slot just got taken' });
        }

        // Insert người dùng vào ds
        const reg = new Registration({ studentId, courseId });
        await reg.save();

        res.status(201).json({ message: 'Enrolled successfully!', data: reg });
    } catch (err) {
        // Lỗi trùng lặp dữ liệu (Đã đăng ký rồi) do index unique
        if (err.code === 11000) {
            return res.status(409).json({ error: 'Student already enrolled' });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

// 4. API Seed Data ban đầu (Giống mock backend)
app.post('/api/seed', async (req, res) => {
    await Course.deleteMany({});
    await Registration.deleteMany({});

    const sampleCourses = [
        { courseId: 'CS101', courseName: 'Nhập môn Lập trình', maxSlots: 40 },
        { courseId: 'CS201', courseName: 'Cấu trúc Dữ liệu', maxSlots: 35 },
    ];

    await Course.insertMany(sampleCourses);
    res.json({ message: "Seeded Registry Main DB!" });
});


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Core Registry Service running on port ${PORT}`));
