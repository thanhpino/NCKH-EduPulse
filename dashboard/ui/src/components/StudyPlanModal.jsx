import React from 'react';
import { translateCourseName } from '../utils/i18n';

/**
 * StudyPlanModal — Modal xem & chốt Kế hoạch học tập dự kiến
 * Supports English/Vietnamese localization.
 */
export default function StudyPlanModal({ isOpen, onClose, studentId, courses, onProceedToRegister, lang }) {
    const currentLang = lang || (typeof window !== 'undefined' ? localStorage.getItem('appLang') || 'vi' : 'vi');

    if (!isOpen) return null;

    // Filter recommended 6 core courses for the study plan
    const planCourses = courses.slice(0, 6);
    const totalCredits = planCourses.reduce((sum, c) => sum + (c.credits || 3), 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-white rounded-lg shadow-2xl border border-gray-200 max-w-2xl w-full overflow-hidden text-gray-800">
                {/* Header */}
                <div className="bg-[#8C0000] text-white px-5 py-3 flex items-center justify-between font-bold">
                    <div className="flex items-center space-x-2 text-sm">
                        <span className="bg-amber-300 text-red-950 text-[10px] px-1.5 py-0.5 rounded font-black">KHHT</span>
                        <span>
                            {currentLang === 'en'
                                ? 'PROPOSED STUDY PLAN - SEMESTER 2 (2026-2027)'
                                : 'KẾ HOẠCH HỌC TẬP DỰ KIẾN - HỌC KỲ 2 (2026-2027)'}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-amber-200 hover:text-white text-lg font-bold cursor-pointer transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-5 space-y-4 text-xs">
                    {/* Student Info Card */}
                    <div className="bg-amber-50/70 border border-amber-200 p-3 rounded flex flex-wrap justify-between items-center text-amber-900 font-mono text-[11px] gap-2">
                        <div>
                            <span className="text-gray-600">{currentLang === 'en' ? 'Student ID: ' : 'Mã sinh viên: '}</span>
                            <span className="font-bold text-[#8C0000] text-xs">{studentId}</span>
                        </div>
                        <div>
                            <span className="text-gray-600">{currentLang === 'en' ? 'Major: ' : 'Ngành học: '}</span>
                            <span className="font-semibold text-gray-800">
                                {currentLang === 'en' ? 'Computer Science' : 'Khoa học Máy tính'}
                            </span>
                        </div>
                        <div>
                            <span className="text-gray-600">{currentLang === 'en' ? 'Cohort: ' : 'Khóa: '}</span>
                            <span className="font-semibold text-gray-800">K27 (2023 - 2027)</span>
                        </div>
                        <div>
                            <span className="text-gray-600">{currentLang === 'en' ? 'Total Planned Credits: ' : 'Tổng TC dự kiến: '}</span>
                            <span className="font-bold text-blue-800">{totalCredits} {currentLang === 'en' ? 'Credits' : 'TC'}</span>
                        </div>
                    </div>

                    {/* Notice */}
                    <div className="text-gray-600 bg-gray-50 border-l-4 border-amber-500 p-2.5 rounded text-[11px]">
                        💡 <strong>{currentLang === 'en' ? 'Notice:' : 'Lưu ý:'}</strong>{' '}
                        {currentLang === 'en'
                            ? 'This is the recommended course list based on the standard curriculum plan. Students must confirm the Study Plan before registering for official class sections.'
                            : 'Đây là danh sách môn học khuyến nghị theo lộ trình chuẩn. Sinh viên cần xác nhận chốt Kế hoạch học tập trước khi bắt đầu tiến hành đăng ký lớp môn học chính thức.'}
                    </div>

                    {/* Course Table */}
                    <div className="border border-gray-200 rounded overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-100 text-gray-700 font-bold text-[11px] border-b border-gray-200">
                                <tr>
                                    <th className="p-2 border-r border-gray-200 w-12 text-center">#</th>
                                    <th className="p-2 border-r border-gray-200 w-24">
                                        {currentLang === 'en' ? 'COURSE ID' : 'MÃ MH'}
                                    </th>
                                    <th className="p-2 border-r border-gray-200">
                                        {currentLang === 'en' ? 'RECOMMENDED COURSE TITLE' : 'TÊN MÔN HỌC KHUYẾN NGHỊ'}
                                    </th>
                                    <th className="p-2 text-center border-r border-gray-200 w-16">
                                        {currentLang === 'en' ? 'CREDITS' : 'SỐ TC'}
                                    </th>
                                    <th className="p-2 text-center w-28">
                                        {currentLang === 'en' ? 'STATUS' : 'TRẠNG THÁI'}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {planCourses.map((c, idx) => (
                                    <tr key={c.courseId} className="border-b border-gray-100 text-xs hover:bg-amber-50/40">
                                        <td className="p-2 text-center font-mono text-gray-500 border-r border-gray-100">{idx + 1}</td>
                                        <td className="p-2 font-mono font-bold text-gray-800 border-r border-gray-100">{c.courseId}</td>
                                        <td className="p-2 font-medium text-gray-900 border-r border-gray-100">
                                            {translateCourseName(c.courseId, c.courseName, currentLang)}
                                        </td>
                                        <td className="p-2 text-center font-mono font-semibold text-blue-700 border-r border-gray-100">{c.credits || 3}</td>
                                        <td className="p-2 text-center">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                {currentLang === 'en' ? '✓ Approved Plan' : '✓ Đã duyệt KHHT'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-100 px-5 py-3 flex items-center justify-between border-t border-gray-200">
                    <span className="text-[11px] text-gray-500 font-mono">
                        {currentLang === 'en' ? 'Status: ' : 'Trạng thái: '}
                        <span className="font-bold text-emerald-700">
                            {currentLang === 'en' ? 'Study Plan Confirmed' : 'Đã chốt kế hoạch học tập'}
                        </span>
                    </span>

                    <div className="flex space-x-2">
                        <button
                            onClick={onClose}
                            className="px-3.5 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold text-xs rounded transition-all cursor-pointer"
                        >
                            {currentLang === 'en' ? 'Close' : 'Đóng'}
                        </button>

                        <button
                            onClick={() => {
                                onClose();
                                onProceedToRegister();
                            }}
                            className="px-4 py-1.5 bg-linear-to-r from-[#005B7F] to-[#00425C] hover:from-[#00425C] hover:to-[#003348] text-white font-bold text-xs rounded shadow transition-all cursor-pointer flex items-center space-x-1"
                        >
                            <span>
                                {currentLang === 'en' ? 'Confirm Plan & Proceed to Register' : 'Chốt KHHT & Qua Đăng ký ngay'}
                            </span>
                            <span>→</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
