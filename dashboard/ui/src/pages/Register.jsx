import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import CourseRow from '../components/CourseRow';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3010';
const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:3002';

/**
 * Register Page — Trang đăng ký môn học
 * - Fetch danh sách môn từ mock-backend (MongoDB)
 * - Multi-select checkbox
 * - Bấm "Đăng ký" → N POST /api/queue/join độc lập
 * - Mỗi dòng hiển thị StatusBadge riêng (polling độc lập)
 */
export default function Register() {
    const [searchParams] = useSearchParams();
    const mssv = searchParams.get('mssv') || 'B2012345';

    const [courses, setCourses] = useState([]);
    const [selected, setSelected] = useState(new Set());
    const [cart, setCart] = useState({}); // courseId → { ticketId, status }
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Fetch danh sách môn học từ mock-backend (MongoDB)
    useEffect(() => {
        fetch(`${BACKEND_URL}/api/courses`)
            .then((r) => r.json())
            .then(setCourses)
            .catch(() => setError('Không thể tải danh sách môn học.'));
    }, []);

    function toggleSelect(courseId) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(courseId)) next.delete(courseId);
            else next.add(courseId);
            return next;
        });
    }

    // Bấm "Đăng ký" — gọi N POST request độc lập
    async function handleRegister() {
        if (selected.size === 0) return;
        setLoading(true);

        const toRegister = [...selected].filter((id) => !cart[id]);

        await Promise.all(
            toRegister.map(async (courseId) => {
                try {
                    const res = await fetch(`${GATEWAY_URL}/api/queue/join`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ studentId: mssv, courseId }),
                    });
                    const data = await res.json();

                    setCart((prev) => ({
                        ...prev,
                        [courseId]: {
                            ticketId: data.ticketId,
                            status: data.directAdmission ? 'ACTIVE' : 'waiting',
                        },
                    }));
                } catch (err) {
                    console.error(`[Register] join failed for ${courseId}:`, err.message);
                }
            })
        );

        setLoading(false);
        setSelected(new Set()); // clear selection sau khi đăng ký
    }

    const selectedCount = selected.size;
    const registeredCount = Object.values(cart).filter((e) => e.status === 'DONE').length;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Top Nav */}
            <nav className="bg-[#E0001A] text-white px-6 py-2 flex gap-6 text-sm font-semibold">
                <span className="opacity-70 cursor-pointer hover:opacity-100">🏠 Trang chủ</span>
                <span className="underline underline-offset-4 cursor-pointer">📋 Đăng ký môn học</span>
                <span className="opacity-70 cursor-pointer hover:opacity-100">📅 Kế hoạch học tập</span>
                <span className="opacity-70 cursor-pointer hover:opacity-100">ℹ️ Thông tin</span>
                <span className="ml-auto opacity-80">MSSV: {mssv}</span>
            </nav>

            {/* Announcement bar */}
            <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-2 text-sm text-yellow-800 text-center">
                Sinh viên có thể đăng ký và chỉnh sửa thông tin đăng ký học phần đến{' '}
                <strong>17 giờ - ngày 30/12/2025</strong>
            </div>

            <div className="max-w-6xl mx-auto px-4 py-4">
                {/* Action buttons */}
                <div className="flex items-center gap-3 mb-4">
                    <button
                        onClick={handleRegister}
                        disabled={loading || selectedCount === 0}
                        className="bg-[#E0001A] hover:bg-[#B8001A] disabled:opacity-50 text-white font-bold px-6 py-2 rounded text-sm transition-colors"
                    >
                        {loading ? 'Đang xử lý...' : `Đăng ký (${selectedCount})`}
                    </button>
                    <button
                        onClick={() => setSelected(new Set())}
                        className="border border-gray-300 text-gray-600 px-4 py-2 rounded text-sm hover:bg-gray-100 transition-colors"
                    >
                        Bỏ chọn tất cả
                    </button>
                    <span className="ml-auto text-sm text-gray-500">
                        Đã đăng ký thành công: <strong className="text-green-600">{registeredCount}</strong> môn
                    </span>
                </div>

                {/* Error */}
                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                        {error}
                    </div>
                )}

                {/* Course table */}
                <div className="bg-white border border-gray-200 rounded shadow-sm overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-100 border-b border-gray-200">
                            <tr className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                <th className="px-3 py-3 text-center w-10">Chọn</th>
                                <th className="px-3 py-3">Mã MH</th>
                                <th className="px-3 py-3">Môn học</th>
                                <th className="px-3 py-3 text-center">Số TC</th>
                                <th className="px-3 py-3 text-center">Sĩ số</th>
                                <th className="px-3 py-3">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody>
                            {courses.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-gray-400">
                                        Đang tải danh sách môn học...
                                    </td>
                                </tr>
                            ) : (
                                courses.map((course) => (
                                    <CourseRow
                                        key={course.courseId}
                                        course={course}
                                        isSelected={selected.has(course.courseId)}
                                        onToggle={() => toggleSelect(course.courseId)}
                                        cartEntry={cart[course.courseId]}
                                        studentId={mssv}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer summary */}
                <p className="mt-3 text-sm text-gray-500 text-right">
                    Tổng:{' '}
                    <strong>{registeredCount}</strong> môn đã đăng ký
                </p>
            </div>
        </div>
    );
}
