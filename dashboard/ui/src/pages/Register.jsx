import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import CourseRow from '../components/CourseRow';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3010';
const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:3002';

// Mock schedule data mapping for realistic TDTU portal look
const MOCK_METADATA = {
    CS101: { credits: 3, group: '01', schedule: '---012---, Thứ 4, Phòng C102', instructor: 'TS. Nguyễn Văn A' },
    CS201: { credits: 3, group: '02', schedule: '----345---, Thứ 3, Phòng C201', instructor: 'ThS. Trần Thị B' },
    CS301: { credits: 3, group: '01', schedule: '---789---, Thứ 5, Phòng C305', instructor: 'PGS.TS. Lê Văn C' },
    CS401: { credits: 3, group: '03', schedule: '---456---, Thứ 2, Phòng B104', instructor: 'ThS. Phạm Hoàng D' },
    CS501: { credits: 3, group: '01', schedule: '123-------, Thứ 6, Phòng A202', instructor: 'TS. Võ Minh E' },
};

export default function Register() {
    const [searchParams] = useSearchParams();
    const mssv = searchParams.get('mssv') || 'B2012345';

    const [courses, setCourses] = useState([]);
    const [selected, setSelected] = useState(new Set());
    const [cart, setCart] = useState({}); // courseId → { ticketId, status }
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [clickCount, setClickCount] = useState(0);
    const isDebugMode = searchParams.get('debug') === 'true' || clickCount >= 3;

    // Fetch course catalog
    useEffect(() => {
        fetch(`${BACKEND_URL}/api/courses`)
            .then((r) => r.json())
            .then((data) => {
                // Enrich with mock metadata (credits, group, schedule, instructor)
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
        setSelected(new Set());
    }

    // Reset Queue Button for test cleanup
    async function handleResetQueue() {
        try {
            const res = await fetch(`${GATEWAY_URL}/api/queue/reset`, { method: 'POST' });
            const data = await res.json();
            setCart({});
            setResetMsg('Đã dọn dẹp hàng đợi Redis!');
            setTimeout(() => setResetMsg(''), 3000);
        } catch (e) {
            setResetMsg('Lỗi khi reset hàng đợi');
        }
    }

    const selectedList = courses.filter((c) => selected.has(c.courseId));
    const selectedCount = selectedList.length;
    const totalSelectedCredits = selectedList.reduce((sum, c) => sum + (c.credits || 3), 0);
    const registeredCount = Object.values(cart).filter((e) => e.status === 'DONE').length;

    return (
        <div className="min-h-screen bg-[#F8F9FA] text-gray-800 font-sans pb-24">
            {/* Top Navigation Bar (Teal / Steel Blue TDTU Style) */}
            <nav className="bg-[#005B7F] text-white px-6 py-2.5 flex items-center justify-between shadow-md text-xs font-medium">
                <div className="flex items-center gap-6">
                    <span className="cursor-pointer hover:text-cyan-200 transition-colors flex items-center gap-1 font-bold text-white border-b-2 border-cyan-300 pb-0.5">
                        📋 Đăng ký môn học theo KHHT
                    </span>
                    <span className="cursor-pointer hover:text-cyan-200 transition-colors flex items-center gap-1 opacity-90">
                        📅 Kế hoạch học tập
                    </span>
                    <span className="cursor-pointer hover:text-cyan-200 transition-colors flex items-center gap-1 opacity-90">
                        ℹ️ Thông tin
                    </span>
                </div>
                <div
                    onClick={() => setClickCount((prev) => prev + 1)}
                    className="font-semibold text-cyan-100 bg-cyan-900/40 px-3 py-1 rounded border border-cyan-700/50 cursor-pointer select-none"
                    title="Click 3 lần để mở Dev Test Mode"
                >
                    MSSV: {mssv}
                </div>
            </nav>

            {/* Announcement Section */}
            <div className="bg-[#FFFDE7] border-b border-[#FFF59D] px-6 py-2.5 text-xs text-gray-700 text-center shadow-inner">
                Sinh viên có thể đăng ký và chỉnh sửa thông tin đăng ký đến{' '}
                <span className="text-[#D32F2F] font-bold">17 giờ - ngày 30/12/2025</span>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-4">
                {/* Action Buttons Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                        {/* Button 1: Đăng ký */}
                        <button
                            onClick={handleRegister}
                            disabled={loading || selectedCount === 0}
                            className="bg-linear-to-b from-[#D4ECFC] via-[#A8D3F4] to-[#78B4E3] hover:from-[#C0E3FC] hover:to-[#6AA8DC] text-[#900000] font-bold px-5 py-1 rounded-[3px] text-xs border border-[#5896C7] shadow-[0_1px_2px_rgba(0,0,0,0.15)] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                        >
                            {loading ? 'Đang xử lý...' : selectedCount > 0 ? `Đăng ký (${selectedCount})` : 'Đăng ký'}
                        </button>

                        {/* Button 2: Hủy các môn đã đăng ký */}
                        <button
                            onClick={() => {
                                setSelected(new Set());
                                setCart({});
                            }}
                            className="bg-gradient-to-b from-[#D4ECFC] via-[#A8D3F4] to-[#78B4E3] hover:from-[#C0E3FC] hover:to-[#6AA8DC] text-[#900000] font-bold px-5 py-1 rounded-[3px] text-xs border border-[#5896C7] shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-all cursor-pointer"
                        >
                            Hủy các môn đã đăng ký
                        </button>
                    </div>

                    <div className="text-xs text-gray-600 font-medium">
                        Đã đăng ký thành công: <span className="text-green-600 font-bold text-sm">{registeredCount}</span> môn
                    </div>
                </div>

                {/* Dotted Separator Line */}
                <div className="border-t-2 border-dotted border-[#3388BB] my-3"></div>

                {/* Error Banner */}
                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                        {error}
                    </div>
                )}

                {/* Course Table (Classic TDTU Style with Dark Crimson Header) */}
                <div className="bg-white border border-[#D5D8DC] rounded-sm shadow-md overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-[#8C0000] text-white font-bold">
                            <tr>
                                <th className="p-2 text-center border-r border-[#A31A1A] w-10">CHỌN</th>
                                <th className="p-2 border-r border-[#A31A1A] w-20">MÃ MH</th>
                                <th className="p-2 border-r border-[#A31A1A]">MÔN HỌC</th>
                                <th className="p-2 text-center border-r border-[#A31A1A] w-14">SỐ TC</th>
                                <th className="p-2 text-center border-r border-[#A31A1A] w-16">NHÓM</th>
                                <th className="p-2 text-center border-r border-[#A31A1A] w-24">SL/TỐI ĐA</th>
                                <th className="p-2 border-r border-[#A31A1A]">LỊCH HỌC: TIẾT - THỨ - PHÒNG - TUẦN</th>
                                <th className="p-2 border-r border-[#A31A1A]">TÊN GIẢNG VIÊN</th>
                                <th className="p-2 w-48">TRẠNG THÁI</th>
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
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer total */}
                <div className="mt-2 text-xs text-gray-600 text-right font-medium">
                    Tổng: <span className="font-bold text-gray-800">{registeredCount}</span> môn đã đăng ký
                </div>
            </div>

            {/* Bottom Right Floating Panel — "Các môn đang chọn" (Point 3 in Image 2) */}
            <div className="fixed bottom-0 right-6 z-50 bg-[#222222]/95 text-white w-72 p-3 rounded-t-md shadow-2xl border border-gray-700 backdrop-blur-sm transition-all">
                <div className="flex items-center justify-between font-bold text-yellow-400 border-b border-gray-600 pb-1.5 mb-2 text-xs">
                    <span>Các môn đang chọn</span>
                    <span className="text-[10px] bg-yellow-900/60 text-yellow-300 px-1.5 py-0.5 rounded border border-yellow-700">
                        {selectedCount} môn
                    </span>
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1 pr-1 text-xs">
                    {selectedList.length === 0 ? (
                        <div className="text-gray-400 italic text-center py-2 text-[11px]">
                            Chưa chọn môn nào
                        </div>
                    ) : (
                        selectedList.map((c) => (
                            <div key={c.courseId} className="flex items-center justify-between bg-gray-800/80 px-2 py-1 rounded text-[11px]">
                                <span className="font-medium text-cyan-300">{c.courseId}</span>
                                <span className="text-gray-200 truncate max-w-[140px]" title={c.courseName}>
                                    {c.courseName}
                                </span>
                                <span className="text-gray-400 font-mono">({c.credits}TC)</span>
                            </div>
                        ))
                    )}
                    <div className="border-t border-gray-700 pt-1.5 mt-2 flex items-center justify-between text-xs font-bold text-yellow-300">
                        <span>Tổng:</span>
                        <span>{selectedCount} môn, {totalSelectedCredits} chỉ</span>
                    </div>
                </div>

            </div>

            {/* Hidden Dev Mode Floating Bar (Only shown with ?debug=true or triple-click MSSV) */}
            {isDebugMode && (
                <div className="fixed bottom-4 left-6 z-50 bg-[#1E293B]/95 text-white px-3 py-2 rounded-md shadow-2xl border border-slate-700 text-xs flex items-center gap-3 backdrop-blur-sm">
                    <span className="font-bold text-amber-400 flex items-center gap-1">🛠️ Test Mode</span>
                    <button
                        onClick={handleResetQueue}
                        className="bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold px-2.5 py-1 rounded text-[11px] transition-colors cursor-pointer"
                    >
                        🧹 Clear Redis Queue
                    </button>
                    {resetMsg && <span className="text-emerald-400 font-medium text-[11px]">{resetMsg}</span>}
                </div>
            )}
        </div>
    );
}
