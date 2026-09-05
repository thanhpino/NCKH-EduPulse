import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import CourseRow from '../components/CourseRow';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:3002';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3010';

// Mock additional metadata for TDTU course schedule & details
const MOCK_METADATA = {
    CS101: { credits: 3, group: '01', schedule: '---012---, Thứ 2, Phòng C101', instructor: 'TS. Nguyễn Văn A' },
    CS201: { credits: 4, group: '02', schedule: '---345---, Thứ 3, Phòng C202', instructor: 'PGS. TS. Trần Thị B' },
    CS301: { credits: 3, group: '01', schedule: '---678---, Thứ 4, Phòng B105', instructor: 'ThS. Lê Hoàng C' },
    CS401: { credits: 3, group: '03', schedule: '---012---, Thứ 5, Phòng A301', instructor: 'TS. Phạm Minh D' },
    CS501: { credits: 3, group: '01', schedule: '---345---, Thứ 6, Phòng C304', instructor: 'TS. Đỗ Thanh E' },
};

export default function Register() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const mssv = searchParams.get('mssv') || 'B2012345';

    const [courses, setCourses] = useState([]);
    const [registrations, setRegistrations] = useState([]);
    const [selected, setSelected] = useState(new Set());
    const [cart, setCart] = useState({}); // courseId → { ticketId, status }
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [clickCount, setClickCount] = useState(0);
    const [resetMsg, setResetMsg] = useState('');
    const isDebugMode = searchParams.get('debug') === 'true' || clickCount >= 3;

    // Fetch course catalog
    const fetchCourses = useCallback(() => {
        fetch(`${GATEWAY_URL}/api/courses`)
            .then((r) => r.json())
            .then((data) => {
                const enriched = data.map((c) => ({
                    ...c,
                    credits: MOCK_METADATA[c.courseId]?.credits || 3,
                    group: MOCK_METADATA[c.courseId]?.group || '01',
                    schedule: MOCK_METADATA[c.courseId]?.schedule || '---012---, Thứ 4, Phòng C101',
                    instructor: MOCK_METADATA[c.courseId]?.instructor || 'Giảng viên Khoa CNTT',
                }));
                setCourses(enriched);
            })
            .catch(() => setError('Không thể tải danh sách môn học từ hệ thống.'));
    }, []);

    // Fetch student registrations from MongoDB
    const fetchRegistrations = useCallback(() => {
        if (!mssv) return;
        fetch(`${GATEWAY_URL}/api/registrations?studentId=${mssv}`)
            .then((r) => r.json())
            .then((data) => {
                const list = data.registrations || [];
                setRegistrations(list);
                setCart((prev) => {
                    const next = { ...prev };
                    list.forEach((r) => {
                        next[r.courseId] = {
                            ticketId: next[r.courseId]?.ticketId || 'DB_REGISTERED',
                            status: 'DONE',
                        };
                    });
                    return next;
                });
            })
            .catch((err) => console.error('Failed to fetch registrations:', err));
    }, [mssv]);

    useEffect(() => {
        fetchCourses();
        fetchRegistrations();
    }, [fetchCourses, fetchRegistrations]);

    // Handle status transition callback from CourseRow / useQueuePolling
    const handleStatusChange = useCallback((courseId, newStatus) => {
        setCart((prev) => ({
            ...prev,
            [courseId]: {
                ticketId: prev[courseId]?.ticketId,
                status: newStatus,
            },
        }));

        if (newStatus === 'DONE') {
            setSelected((prev) => {
                const next = new Set(prev);
                next.delete(courseId);
                return next;
            });
            fetchRegistrations();
            fetchCourses();
        }
    }, [fetchRegistrations, fetchCourses]);

    function toggleSelect(courseId) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(courseId)) next.delete(courseId);
            else next.add(courseId);
            return next;
        });
    }

    async function handleRegister() {
        if (selected.size === 0) return;
        setLoading(true);

        const toRegister = [...selected].filter((id) => !cart[id] || cart[id].status !== 'DONE');

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
    }

    // Reset Queue Button for test cleanup
    async function handleResetQueue() {
        try {
            await fetch(`${GATEWAY_URL}/api/queue/reset`, { method: 'POST' });
            setCart({});
            setResetMsg('Đã dọn dẹp hàng đợi Redis!');
            setTimeout(() => setResetMsg(''), 3000);
            fetchRegistrations();
            fetchCourses();
        } catch (e) {
            setResetMsg('Lỗi khi reset hàng đợi');
        }
    }

    const selectedList = courses.filter((c) => selected.has(c.courseId));
    const selectedCount = selectedList.length;
    const totalSelectedCredits = selectedList.reduce((sum, c) => sum + (c.credits || 3), 0);
    const registeredCount = registrations.length || Object.values(cart).filter((e) => e.status === 'DONE').length;

    return (
        <div className="min-h-screen bg-[#F8F9FA] text-gray-800 font-sans pb-24">
            {/* Top Navigation Bar (Teal / Steel Blue TDTU Style) */}
            <nav className="bg-[#005B7F] text-white px-6 py-2.5 flex items-center justify-between shadow-md text-xs font-medium">
                <div className="flex items-center space-x-6">
                    <span className="font-bold text-sm tracking-wide flex items-center gap-2">
                        <span className="bg-white text-[#005B7F] px-1.5 py-0.5 rounded font-black text-xs">PORTAL</span>
                        ĐĂNG KÝ MÔN HỌC
                    </span>
                    <div className="flex space-x-1">
                        <button className="bg-[#00425C] px-3 py-1.5 rounded font-semibold border-b-2 border-amber-400 text-white transition-all">
                            Đăng ký môn học theo KHHT
                        </button>
                        <button className="hover:bg-[#00425C]/60 px-3 py-1.5 rounded font-medium text-gray-200 transition-all">
                            Kế hoạch học tập
                        </button>
                        <button className="hover:bg-[#00425C]/60 px-3 py-1.5 rounded font-medium text-gray-200 transition-all">
                            Thông tin
                        </button>
                    </div>
                </div>

                <div className="flex items-center space-x-4">
                    {/* Student Info & Debug Trigger */}
                    <div
                        className="bg-[#00425C] px-3 py-1 rounded text-[11px] font-mono cursor-pointer select-none hover:bg-[#003348] border border-cyan-800 transition-all"
                        onClick={() => setClickCount((prev) => prev + 1)}
                        title="Triple-click to toggle test mode"
                    >
                        MSSV: <span className="font-bold text-amber-300">{mssv}</span>
                    </div>

                    <button
                        onClick={() => navigate('/login')}
                        className="bg-red-700 hover:bg-red-800 px-2.5 py-1 rounded text-white font-medium text-[11px] transition-all"
                    >
                        Đăng xuất
                    </button>
                </div>
            </nav>

            {/* Hidden Dev Debug Toolbar */}
            {isDebugMode && (
                <div className="bg-amber-100 border-b border-amber-300 px-6 py-2 flex items-center justify-between text-xs text-amber-900 shadow-inner animate-fade-in">
                    <div className="flex items-center space-x-2 font-mono">
                        <span className="bg-amber-800 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">DEV TEST MODE</span>
                        <span>Gateway: {GATEWAY_URL}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                        {resetMsg && <span className="text-emerald-700 font-bold">{resetMsg}</span>}
                        <button
                            onClick={handleResetQueue}
                            className="bg-amber-800 hover:bg-amber-900 text-white font-bold px-3 py-1 rounded shadow text-xs transition-all"
                        >
                            Reset Redis Queue State
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className="max-w-7xl mx-auto px-6 py-4 space-y-4">
                {/* Academic Term Header Panel */}
                <div className="bg-white p-4 rounded shadow-sm border border-gray-200 flex flex-wrap items-center justify-between text-xs gap-3">
                    <div className="flex items-center space-x-4">
                        <div>
                            <span className="text-gray-500 font-medium">Học kỳ: </span>
                            <span className="font-bold text-[#8C0000]">Học kỳ 1 - Năm học 2026-2027</span>
                        </div>
                        <div className="h-4 w-px bg-gray-300"></div>
                        <div>
                            <span className="text-gray-500 font-medium">Đợt đăng ký: </span>
                            <span className="font-semibold text-gray-800">Đợt 1 - Đăng ký chính thức</span>
                        </div>
                    </div>

                    <div className="flex items-center space-x-6 font-semibold">
                        <div className="text-blue-900">
                            Đã đăng ký: <span className="text-blue-600 font-bold text-sm">{registeredCount}</span> môn
                        </div>
                        <div className="text-amber-900">
                            Đang chọn: <span className="text-amber-600 font-bold text-sm">{selectedCount}</span> môn ({totalSelectedCredits} TC)
                        </div>
                    </div>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="bg-red-50 border-l-4 border-red-600 p-3 text-red-700 text-xs rounded shadow-sm">
                        {error}
                    </div>
                )}

                {/* Course Selection Actions (Sky Blue glossy buttons) */}
                <div className="flex items-center space-x-3">
                    <button
                        onClick={handleRegister}
                        disabled={selectedCount === 0 || loading}
                        className={`px-5 py-2 rounded text-xs font-bold text-red-900 shadow border border-sky-300 transition-all ${selectedCount === 0 || loading
                            ? 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed'
                            : 'bg-gradient-to-b from-sky-200 via-sky-300 to-sky-400 hover:from-sky-300 hover:to-sky-500 hover:shadow-md cursor-pointer active:scale-95'
                            }`}
                    >
                        {loading ? 'Đang gửi yêu cầu...' : `Đăng ký (${selectedCount})`}
                    </button>

                    <button
                        onClick={() => setSelected(new Set())}
                        disabled={selectedCount === 0}
                        className={`px-4 py-2 rounded text-xs font-semibold text-red-900 shadow border border-sky-300 transition-all ${selectedCount === 0
                            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                            : 'bg-gradient-to-b from-gray-100 to-gray-200 hover:bg-gray-200 hover:shadow-md cursor-pointer'
                            }`}
                    >
                        Hủy chọn các môn
                    </button>
                </div>

                {/* Main Course Table (Standard TDTU Red Header Design) */}
                <div className="bg-white rounded shadow-sm border border-[#E8DCDC] overflow-hidden">
                    <div className="bg-[#8C0000] text-white px-4 py-2.5 font-bold text-xs flex justify-between items-center">
                        <span>DANH SÁCH MÔN HỌC MỞ LỚP</span>
                        <span className="text-[11px] font-normal text-amber-200">
                            Hiển thị: {courses.length} môn
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-[#8C0000] text-white font-bold text-[11px]">
                                <tr>
                                    <th className="p-2 text-center border-r border-[#A31A1A] w-10">CHỌN</th>
                                    <th className="p-2 border-r border-[#A31A1A] w-20">MÃ MH</th>
                                    <th className="p-2 border-r border-[#A31A1A]">MÔN HỌC</th>
                                    <th className="p-2 text-center border-r border-[#A31A1A] w-14">SỐ TC</th>
                                    <th className="p-2 text-center border-r border-[#A31A1A] w-16">NHÓM</th>
                                    <th className="p-2 text-center border-r border-[#A31A1A] w-24">SL/TỐI ĐA</th>
                                    <th className="p-2 border-r border-[#A31A1A]">LỊCH HỌC: TIẾT - THỨ - PHÒNG - TUẦN</th>
                                    <th className="p-2 border-r border-[#A31A1A]">TÊN GIẢNG VIÊN</th>
                                    <th className="p-2 w-48 text-center">TRẠNG THÁI</th>
                                </tr>
                            </thead>
                            <tbody>
                                {courses.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="text-center py-8 text-gray-400">
                                            Đang tải danh sách môn học...
                                        </td>
                                    </tr>
                                ) : (
                                    courses.map((course, idx) => (
                                        <CourseRow
                                            key={course.courseId}
                                            course={course}
                                            isSelected={selected.has(course.courseId)}
                                            onToggle={() => toggleSelect(course.courseId)}
                                            cartEntry={cart[course.courseId]}
                                            studentId={mssv}
                                            rowIndex={idx}
                                            onStatusChange={handleStatusChange}
                                        />
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Bottom Right Floating Panel — "Các môn đang chọn" */}
            {selectedCount > 0 && (
                <div className="fixed bottom-0 right-6 z-50 bg-[#222222]/95 text-white w-72 p-3 rounded-t-md shadow-2xl border border-gray-700 backdrop-blur-sm transition-all animate-bounce-short">
                    <div className="flex items-center justify-between font-bold text-yellow-400 border-b border-gray-600 pb-1.5 mb-2 text-xs">
                        <span>Các môn đang chọn</span>
                        <span className="text-[10px] bg-yellow-900/60 text-yellow-300 px-1.5 py-0.5 rounded border border-yellow-700">
                            {selectedCount} môn
                        </span>
                    </div>

                    <ul className="space-y-1.5 max-h-36 overflow-y-auto text-[11px] text-gray-300 pr-1">
                        {selectedList.map((c) => (
                            <li key={c.courseId} className="flex justify-between items-center bg-gray-800/80 p-1.5 rounded border border-gray-700">
                                <span className="font-mono text-amber-300 font-bold">{c.courseId}</span>
                                <span className="truncate max-w-[140px] text-gray-200">{c.courseName}</span>
                                <span className="text-[10px] text-gray-400 font-mono">{c.credits || 3} TC</span>
                            </li>
                        ))}
                    </ul>

                    <div className="mt-3 pt-2 border-t border-gray-700 flex justify-between items-center text-xs font-bold text-gray-200">
                        <span>Tổng số tín chỉ:</span>
                        <span className="text-yellow-400 font-mono text-sm">{totalSelectedCredits} TC</span>
                    </div>

                    <button
                        onClick={handleRegister}
                        disabled={loading}
                        className="w-full mt-2 py-1.5 bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white font-bold text-xs rounded shadow transition-all active:scale-95"
                    >
                        {loading ? 'Đang gửi...' : 'Đăng ký ngay'}
                    </button>
                </div>
            )}
        </div>
    );
}
