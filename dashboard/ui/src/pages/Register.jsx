import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import CourseRow from '../components/CourseRow';
import ConfirmModal from '../components/ConfirmModal';
import SuccessModal from '../components/SuccessModal';
import InfoModal from '../components/InfoModal';
import StudyPlanModal from '../components/StudyPlanModal';
import CourseFullModal from '../components/CourseFullModal';
import { translateCourseName, translateInstructor } from '../utils/i18n';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:3002';

const TRANSLATIONS = {
    vi: {
        switchLangTooltip: 'Switch to English',
        portalBrand: 'ĐĂNG KÝ MÔN HỌC',
        tabRegister: 'Đăng ký môn học theo KHHT',
        tabPlan: 'Kế hoạch học tập',
        tabInfo: 'Thông tin',
        mssvLabel: 'MSSV:',
        logout: 'Đăng xuất',
        termLabel: 'Học kỳ:',
        termValue: 'Học kỳ 2 - Năm học 2026-2027',
        regRoundLabel: 'Đợt đăng ký:',
        regRoundValue: 'Đợt 1 - Đăng ký chính thức',
        registeredCount: 'Đã đăng ký:',
        selectedCount: 'Đang chọn:',
        coursesUnit: 'môn',
        tcUnit: 'TC',
        btnRegister: 'Đăng ký',
        btnRegistering: 'Đang gửi yêu cầu...',
        btnUnregister: 'Hủy các môn học đã đăng ký',
        catalogTitle: 'DANH SÁCH MÔN HỌC MỞ LỚP',
        showing: 'Hiển thị:',
        colSTT: 'CHỌN',
        colCourseId: 'MÃ MH',
        colCourseName: 'MÔN HỌC & CHỌN NHÓM',
        colCredits: 'SỐ TC',
        colGroup: 'SL/TỐI ĐA',
        colSchedule: 'LỊCH HỌC: TIẾT - THỨ - PHÒNG - TUẦN',
        colInstructor: 'TÊN GIẢNG VIÊN',
        colStatus: 'TRẠNG THÁI',
        registeredSidebarTitle: '📋 MÔN HỌC ĐÃ ĐĂNG KÝ',
        noRegistered: 'Chưa đăng ký môn nào',
        noRegisteredHint: 'Chọn môn từ bảng bên trái và nhấn "Đăng ký"',
        loadingCourses: 'Đang tải danh sách môn học...',
        loadError: 'Không thể tải danh sách môn học từ hệ thống.',
        totalCreditsRegistered: 'Tổng số tín chỉ đã ĐK:',
        checkPlanHint: 'Đối chiếu với Kế hoạch học tập để đảm bảo đủ tín chỉ',
        selectedCoursesTitle: 'Các môn đang chọn',
        totalSelectedCredits: 'Tổng số tín chỉ:',
        registerNow: 'Đăng ký ngay',
    },
    en: {
        switchLangTooltip: 'Chuyển sang Tiếng Việt',
        portalBrand: 'COURSE REGISTRATION',
        tabRegister: 'Course Registration by Study Plan',
        tabPlan: 'Study Plan',
        tabInfo: 'Information',
        mssvLabel: 'Student ID:',
        logout: 'Log out',
        termLabel: 'Semester:',
        termValue: 'Semester 2 - Academic Year 2026-2027',
        regRoundLabel: 'Registration Phase:',
        regRoundValue: 'Phase 1 - Official Registration',
        registeredCount: 'Registered:',
        selectedCount: 'Selected:',
        coursesUnit: 'courses',
        tcUnit: 'Credits',
        btnRegister: 'Register',
        btnRegistering: 'Submitting request...',
        btnUnregister: 'Drop registered courses',
        catalogTitle: 'AVAILABLE COURSE CATALOG',
        showing: 'Showing:',
        colSTT: 'SELECT',
        colCourseId: 'COURSE ID',
        colCourseName: 'COURSE & GROUP SELECT',
        colCredits: 'CREDITS',
        colGroup: 'CAPACITY',
        colSchedule: 'SCHEDULE: PERIOD - DAY - ROOM - WEEK',
        colInstructor: 'INSTRUCTOR NAME',
        colStatus: 'STATUS',
        registeredSidebarTitle: '📋 REGISTERED COURSES',
        noRegistered: 'No courses registered yet',
        noRegisteredHint: 'Select courses from the left table and click "Register"',
        loadingCourses: 'Loading available courses...',
        loadError: 'Failed to load course catalog from system.',
        totalCreditsRegistered: 'Total Registered Credits:',
        checkPlanHint: 'Cross-check with Study Plan to ensure sufficient credits',
        selectedCoursesTitle: 'Selected Courses',
        totalSelectedCredits: 'Total Credits:',
        registerNow: 'Register Now',
    }
};

// Mock additional metadata for TDTU course schedule & details (with ---123456789012345--- format for Tuần)
const MOCK_METADATA = {
    CS101: { credits: 3, group: '01', schedule: '---012---, Thứ 2, Phòng C101, ---1234----9012345---', instructor: 'TS. Nguyễn Văn A' },
    CS201: { credits: 4, group: '02', schedule: '---345---, Thứ 3, Phòng C202, ---1234567---12345---', instructor: 'PGS. TS. Trương Minh Thành' },
    CS301: { credits: 3, group: '01', schedule: '---678---, Thứ 4, Phòng B105, ---1--456789012345---', instructor: 'ThS. Huỳnh Trần Thiên Phú' },
    CS401: { credits: 3, group: '03', schedule: '---012---, Thứ 5, Phòng A301, ---1234567---12345---', instructor: 'TS. Phạm Minh D' },
    CS501: { credits: 3, group: '01', schedule: '---345---, Thứ 6, Phòng C304, ---123456--9012345---', instructor: 'TS. Đỗ Thanh E' },
};

export default function Register() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const mssv = searchParams.get('mssv') || 'B2012345';

    const [lang, setLang] = useState(() => localStorage.getItem('appLang') || 'vi');
    const t = TRANSLATIONS[lang];

    const toggleLanguage = () => {
        setLang((prev) => {
            const next = prev === 'vi' ? 'en' : 'vi';
            localStorage.setItem('appLang', next);
            return next;
        });
    };

    const [courses, setCourses] = useState([]);
    const [registrations, setRegistrations] = useState([]);
    const [selected, setSelected] = useState(new Set());
    const [cart, setCart] = useState({}); // courseId → { ticketId, status }
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [clickCount, setClickCount] = useState(0);
    const [resetMsg, setResetMsg] = useState('');
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('register'); // 'register' | 'plan' | 'info'
    const [successCount, setSuccessCount] = useState(0);
    // Course Full Modal state
    const [courseFullInfo, setCourseFullInfo] = useState(null); // { courseId, courseName, group, groups }
    // Track selected group per course
    const [selectedGroups, setSelectedGroups] = useState({}); // courseId → groupCode
    const isDebugMode = searchParams.get('debug') === 'true' || clickCount >= 3;

    // Fetch course catalog
    const fetchCourses = useCallback(() => {
        fetch(`${GATEWAY_URL}/api/courses`)
            .then((r) => r.json())
            .then((data) => {
                const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
                const rooms = ['C101', 'C202', 'B105', 'A301', 'C304', 'D201', 'E102', 'B303'];
                const instructors = [
                    'TS. Nguyễn Văn A',
                    'PGS. TS. Trương Minh Thành',
                    'ThS. Huỳnh Trần Thiên Phú',
                    'TS. Phạm Minh D',
                    'TS. Đỗ Thanh E',
                    'ThS. Nguyễn Thị Thu',
                    'TS. Lê Văn Hoàng',
                    'PGS. TS. Trần Quốc Bảo'
                ];
                const weekPatterns = [
                    '---1234----9012345---',
                    '---1234567---12345---',
                    '---1--456789012345---',
                    '---123456--9012345---',
                    '--23456789012345---'
                ];
                const periods = ['---012---', '---345---', '---678---', '---789---'];

                const enriched = data.map((c, idx) => {
                    const meta = MOCK_METADATA[c.courseId];
                    const day = days[idx % days.length];
                    const room = rooms[idx % rooms.length];
                    const inst = instructors[idx % instructors.length];
                    const week = weekPatterns[idx % weekPatterns.length];
                    const period = periods[idx % periods.length];
                    const grp = String((idx % 5) + 1).padStart(2, '0');

                    const courseGroups = [
                        {
                            group: '01',
                            schedule: meta?.schedule || `${period}, ${day}, Phòng ${room}, ${week}`,
                            instructor: meta?.instructor || inst,
                        },
                        {
                            group: '02',
                            schedule: `${periods[(idx + 1) % periods.length]}, ${days[(idx + 2) % days.length]}, Phòng ${rooms[(idx + 3) % rooms.length]}, ${weekPatterns[(idx + 1) % weekPatterns.length]}`,
                            instructor: instructors[(idx + 2) % instructors.length],
                        },
                        {
                            group: '03',
                            schedule: `${periods[(idx + 2) % periods.length]}, ${days[(idx + 4) % days.length]}, Phòng ${rooms[(idx + 5) % rooms.length]}, ${weekPatterns[(idx + 2) % weekPatterns.length]}`,
                            instructor: instructors[(idx + 4) % instructors.length],
                        },
                    ];

                    return {
                        ...c,
                        credits: meta?.credits || (c.courseId.includes('1203') ? 10 : (idx % 2 === 0 ? 3 : 4)),
                        group: meta?.group || grp,
                        groups: courseGroups,
                        schedule: courseGroups[0].schedule,
                        instructor: courseGroups[0].instructor,
                    };
                });
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

    // Initial load + Auto real-time sync polling (no F5 required)
    useEffect(() => {
        fetchCourses();
        fetchRegistrations();

        const timer = setInterval(() => {
            fetchCourses();
            fetchRegistrations();
        }, 2500);

        return () => clearInterval(timer);
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

        // Show course full popup — clear cart entry so row resets to idle
        if (newStatus === 'course_full') {
            const courseInfo = courses.find((c) => c.courseId === courseId);
            const currentGroup = selectedGroups[courseId] || courseInfo?.group || '01';
            setCourseFullInfo({
                courseId,
                courseName: courseInfo?.courseName || courseId,
                group: currentGroup,
                groups: courseInfo?.groups || [],
            });
            setCart((prev) => {
                const next = { ...prev };
                delete next[courseId];
                return next;
            });
            setSelected((prev) => {
                const next = new Set(prev);
                next.delete(courseId);
                return next;
            });
            fetchCourses(); // refresh slots on table
        }
    }, [fetchRegistrations, fetchCourses, courses, selectedGroups]);

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

                    // Course full — show popup immediately, don't enter queue
                    if (res.status === 409 && data.status === 'course_full') {
                        const courseInfo = courses.find((c) => c.courseId === courseId);
                        const currentGroup = selectedGroups[courseId] || courseInfo?.group || '01';
                        setCourseFullInfo({
                            courseId,
                            courseName: courseInfo?.courseName || courseId,
                            group: currentGroup,
                            groups: courseInfo?.groups || [],
                        });
                        setSelected((prev) => { const s = new Set(prev); s.delete(courseId); return s; });
                        return;
                    }

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

    // Open UI Confirm Modal for Unregistration
    function handleUnregisterClick() {
        if (registeredCount === 0 || loading) return;
        setIsConfirmModalOpen(true);
    }

    // Execute Unregistration Action
    async function confirmUnregisterAction() {
        setLoading(true);
        const countToDrop = registeredCount;
        try {
            const res = await fetch(`${GATEWAY_URL}/api/unregister`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentId: mssv }),
            });
            const data = await res.json();
            if (data.success || data.count > 0) {
                // Instantly clear local states so UI resets immediately
                setCart({});
                setRegistrations([]);
                setSelected(new Set());
                fetchRegistrations();
                fetchCourses();

                // Open Success Notification Pop-up Modal
                setSuccessCount(data.count || countToDrop);
                setIsSuccessModalOpen(true);
            }
        } catch (err) {
            console.error('Failed to unregister courses:', err);
        } finally {
            setLoading(false);
            setIsConfirmModalOpen(false);
        }
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

    // Map registered list details for modal
    const registeredList = registrations.map((r) => {
        const found = courses.find((c) => c.courseId === r.courseId);
        return {
            courseId: r.courseId,
            courseName: found ? found.courseName : r.courseId,
        };
    });

    return (
        <div className="min-h-screen bg-[#F8F9FA] text-gray-800 font-sans pb-24">
            {/* Top Navigation Bar (Teal / Steel Blue TDTU Style) */}
            <nav className="bg-[#005B7F] text-white px-6 py-2.5 flex items-center justify-between shadow-md text-xs font-medium">
                <div className="flex items-center space-x-6">
                    <span className="font-bold text-sm tracking-wide flex items-center gap-2">
                        <span className="bg-white text-[#005B7F] px-1.5 py-0.5 rounded font-black text-xs">EDU PULSE</span>
                        {t.portalBrand}
                    </span>
                    <div className="flex space-x-1">
                        <button
                            onClick={() => setActiveTab('register')}
                            className={`px-3 py-1.5 rounded font-semibold transition-all cursor-pointer ${activeTab === 'register'
                                ? 'bg-[#00425C] border-b-2 border-amber-400 text-white'
                                : 'hover:bg-[#00425C]/60 text-gray-200'
                                }`}
                        >
                            {t.tabRegister}
                        </button>
                        <button
                            onClick={() => setIsPlanModalOpen(true)}
                            className="hover:bg-[#00425C]/60 px-3 py-1.5 rounded font-medium text-gray-200 transition-all cursor-pointer flex items-center space-x-1"
                        >
                            <span>{t.tabPlan}</span>
                        </button>
                        <button
                            onClick={() => setIsInfoModalOpen(true)}
                            className="hover:bg-[#00425C]/60 px-3 py-1.5 rounded font-medium text-gray-200 transition-all cursor-pointer"
                        >
                            {t.tabInfo}
                        </button>
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    {/* Flag Language Switcher (Left of MSSV) */}
                    <button
                        type="button"
                        onClick={toggleLanguage}
                        className="flex items-center justify-center p-1 rounded-md bg-[#00425C] hover:bg-[#003348] transition-all cursor-pointer border border-cyan-400/60 shadow-sm hover:scale-105 active:scale-95"
                        title={t.switchLangTooltip}
                        aria-label={t.switchLangTooltip}
                    >
                        {lang === 'vi' ? (
                            /* UK Flag (switch to English) */
                            <svg viewBox="0 0 60 30" className="w-7 h-4.5 rounded-xs shadow-xs border border-white/80 transition-transform">
                                <clipPath id="uk-clip-nav">
                                    <path d="M0 0 v30 h60 v-30 z" />
                                </clipPath>
                                <g clipPath="url(#uk-clip-nav)">
                                    <path d="M0 0 v30 h60 v-30 z" fill="#012169" />
                                    <path d="M0 0 L60 30 M60 0 L0 30" stroke="#fff" strokeWidth="6" />
                                    <path d="M0 0 L60 30 M60 0 L0 30" stroke="#C8102E" strokeWidth="4" />
                                    <path d="M30 0 v30 M0 15 h60" stroke="#fff" strokeWidth="10" />
                                    <path d="M30 0 v30 M0 15 h60" stroke="#C8102E" strokeWidth="6" />
                                </g>
                            </svg>
                        ) : (
                            /* Vietnam Flag (switch to Vietnamese) */
                            <svg viewBox="0 0 60 40" className="w-7 h-4.5 rounded-xs shadow-xs border border-white/80 transition-transform">
                                <rect width="60" height="40" fill="#DA251D" />
                                <polygon
                                    points="30,8 33.7,19.4 45.7,19.4 36,26.4 39.7,37.8 30,30.8 20.3,37.8 24,26.4 14.3,19.4 26.3,19.4"
                                    fill="#FFFF00"
                                />
                            </svg>
                        )}
                    </button>

                    {/* Student Info & Debug Trigger */}
                    <div
                        className="bg-[#00425C] px-3 py-1 rounded text-[11px] font-mono cursor-pointer select-none hover:bg-[#003348] border border-cyan-800 transition-all"
                        onClick={() => setClickCount((prev) => prev + 1)}
                        title="Triple-click to toggle test mode"
                    >
                        {t.mssvLabel} <span className="font-bold text-amber-300">{mssv}</span>
                    </div>

                    <button
                        onClick={() => navigate('/login')}
                        className="bg-red-700 hover:bg-red-800 px-2.5 py-1 rounded text-white font-medium text-[11px] transition-all cursor-pointer"
                    >
                        {t.logout}
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
                            className="bg-amber-800 hover:bg-amber-900 text-white font-bold px-3 py-1 rounded shadow text-xs transition-all cursor-pointer"
                        >
                            Reset Redis Queue State
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content Area — 2 Column Layout */}
            <div className="max-w-[1600px] mx-auto px-6 py-4 space-y-4">
                {/* Academic Term Header Panel */}
                <div className="bg-white p-4 rounded shadow-sm border border-gray-200 flex flex-wrap items-center justify-between text-xs gap-3">
                    <div className="flex items-center space-x-4">
                        <div>
                            <span className="text-gray-500 font-medium">{t.termLabel} </span>
                            <span className="font-bold text-[#8C0000]">{t.termValue}</span>
                        </div>
                        <div className="h-4 w-px bg-gray-300"></div>
                        <div>
                            <span className="text-gray-500 font-medium">{t.regRoundLabel} </span>
                            <span className="font-semibold text-gray-800">{t.regRoundValue}</span>
                        </div>
                    </div>

                    <div className="flex items-center space-x-6 font-semibold">
                        <div className="text-blue-900">
                            {t.registeredCount} <span className="text-blue-600 font-bold text-sm">{registeredCount}</span> {t.coursesUnit}
                        </div>
                        <div className="text-amber-900">
                            {t.selectedCount} <span className="text-amber-600 font-bold text-sm">{selectedCount}</span> {t.coursesUnit} ({totalSelectedCredits} {t.tcUnit})
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
                            : 'bg-linear-to-b from-sky-200 via-sky-300 to-sky-400 hover:from-sky-300 hover:to-sky-500 hover:shadow-md cursor-pointer active:scale-95'
                            }`}
                    >
                        {loading ? t.btnRegistering : `${t.btnRegister} (${selectedCount})`}
                    </button>

                    <button
                        onClick={handleUnregisterClick}
                        disabled={registeredCount === 0 || loading}
                        className={`px-4 py-2 rounded text-xs font-semibold shadow border transition-all ${registeredCount === 0 || loading
                            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                            : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300 hover:shadow-md cursor-pointer active:scale-95'
                            }`}
                    >
                        {t.btnUnregister} {registeredCount > 0 ? `(${registeredCount})` : ''}
                    </button>
                </div>

                {/* 2-Column Grid: Course Table (Left) + Registered Sidebar (Right) */}
                <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4 items-start">
                    {/* LEFT — Main Course Table */}
                    <div className="bg-white rounded shadow-sm border border-[#E8DCDC] overflow-hidden">
                        <div className="bg-[#8C0000] text-white px-4 py-2.5 font-bold text-xs flex justify-between items-center">
                            <span>{t.catalogTitle}</span>
                            <span className="text-[11px] font-normal text-amber-200">
                                {t.showing} {courses.length} {t.coursesUnit}
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-[#8C0000] text-white font-bold text-[11px]">
                                    <tr>
                                        <th className="p-2 text-center border-r border-[#A31A1A] w-10">{t.colSTT}</th>
                                        <th className="p-2 border-r border-[#A31A1A] w-20">{t.colCourseId}</th>
                                        <th className="p-2 border-r border-[#A31A1A]">{t.colCourseName}</th>
                                        <th className="p-2 text-center border-r border-[#A31A1A] w-14">{t.colCredits}</th>
                                        <th className="p-2 text-center border-r border-[#A31A1A] w-24">{t.colGroup}</th>
                                        <th className="p-2 border-r border-[#A31A1A]">{t.colSchedule}</th>
                                        <th className="p-2 border-r border-[#A31A1A]">{t.colInstructor}</th>
                                        <th className="p-2 w-36 text-center">{t.colStatus}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {courses.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="text-center py-8 text-gray-400">
                                                {t.loadingCourses}
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
                                                onGroupChange={(cId, groupCode) => setSelectedGroups(prev => ({ ...prev, [cId]: groupCode }))}
                                                lang={lang}
                                            />
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* RIGHT — Danh sách môn đã đăng ký (Sticky Sidebar) */}
                    <div className="xl:sticky xl:top-4">
                        <div className="bg-white rounded shadow-sm border border-emerald-200 overflow-hidden">
                            {/* Header */}
                            <div className="bg-[#005B7F] text-white px-4 py-2.5 font-bold text-xs flex justify-between items-center">
                                <span className="flex items-center gap-1.5">
                                    {t.registeredSidebarTitle}
                                </span>
                                <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    {registeredCount} {t.coursesUnit}
                                </span>
                            </div>

                            {/* Content */}
                            <div className="p-3">
                                {registeredCount === 0 ? (
                                    <div className="text-center py-8 space-y-2">
                                        <div className="text-3xl">📭</div>
                                        <p className="text-gray-400 text-xs">{t.noRegistered}</p>
                                        <p className="text-gray-300 text-[10px]">{t.noRegisteredHint}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {registrations.map((reg, idx) => {
                                            const courseInfo = courses.find((c) => c.courseId === reg.courseId);
                                            const groupCode = selectedGroups[reg.courseId] || courseInfo?.group || '01';
                                            const groupInfo = courseInfo?.groups?.find((g) => g.group === groupCode);
                                            return (
                                                <div
                                                    key={reg.courseId}
                                                    className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-2.5 space-y-1.5 hover:bg-emerald-50 transition-colors"
                                                >
                                                    {/* Row 1: Course ID + Name + Credits */}
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-[10px] font-bold text-white bg-emerald-600 px-1.5 py-0.5 rounded">
                                                                    {idx + 1}
                                                                </span>
                                                                <span className="font-mono font-bold text-emerald-800 text-xs">
                                                                    {reg.courseId}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs font-medium text-gray-800 mt-0.5 truncate">
                                                                {translateCourseName(reg.courseId, courseInfo?.courseName, lang)}
                                                            </p>
                                                        </div>
                                                        <span className="bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap">
                                                            {courseInfo?.credits || 3} {t.tcUnit}
                                                        </span>
                                                    </div>

                                                    {/* Row 2: Group + Schedule + Instructor */}
                                                    <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
                                                        <span className="bg-amber-100 text-amber-800 font-bold px-1 py-0.5 rounded border border-amber-200">
                                                            {lang === 'en' ? `G${groupCode}` : `N${groupCode}`}
                                                        </span>
                                                        <span className="truncate">
                                                            {translateInstructor(groupInfo?.instructor || courseInfo?.instructor || '---', lang)}
                                                        </span>
                                                    </div>

                                                    {/* Row 3: Status */}
                                                    <div className="flex items-center gap-1 text-[10px]">
                                                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 font-semibold px-1.5 py-0.5 rounded-full border border-emerald-300">
                                                            🟢 {lang === 'vi' ? 'Đã đăng ký thành công' : 'Registered successfully'}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Total Credits Summary */}
                                {registeredCount > 0 && (
                                    <div className="mt-3 pt-2.5 border-t border-emerald-200">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="font-semibold text-gray-600">{t.totalCreditsRegistered}</span>
                                            <span className="font-bold text-emerald-700 text-sm font-mono">
                                                {registrations.reduce((sum, r) => {
                                                    const c = courses.find((c) => c.courseId === r.courseId);
                                                    return sum + (c?.credits || 3);
                                                }, 0)} {t.tcUnit}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-gray-400 mt-1 italic">
                                            {t.checkPlanHint}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Right Floating Panel — "Các môn đang chọn" */}
            {selectedCount > 0 && (
                <div className="fixed bottom-0 right-6 z-50 bg-[#222222]/95 text-white w-72 p-3 rounded-t-md shadow-2xl border border-gray-700 backdrop-blur-sm transition-all animate-bounce-short">
                    <div className="flex items-center justify-between font-bold text-yellow-400 border-b border-gray-600 pb-1.5 mb-2 text-xs">
                        <span>{t.selectedCoursesTitle}</span>
                        <span className="text-[10px] bg-yellow-900/60 text-yellow-300 px-1.5 py-0.5 rounded border border-yellow-700">
                            {selectedCount} {t.coursesUnit}
                        </span>
                    </div>

                    <ul className="space-y-1.5 max-h-36 overflow-y-auto text-[11px] text-gray-300 pr-1">
                        {selectedList.map((c) => (
                            <li key={c.courseId} className="flex justify-between items-center bg-gray-800/80 p-1.5 rounded border border-gray-700">
                                <span className="font-mono text-amber-300 font-bold">{c.courseId}</span>
                                <span className="truncate max-w-35 text-gray-200">{c.courseName}</span>
                                <span className="text-[10px] text-gray-400 font-mono">{c.credits || 3} {t.tcUnit}</span>
                            </li>
                        ))}
                    </ul>

                    <div className="mt-3 pt-2 border-t border-gray-700 flex justify-between items-center text-xs font-bold text-gray-200">
                        <span>{t.totalSelectedCredits}</span>
                        <span className="text-yellow-400 font-mono text-sm">{totalSelectedCredits} {t.tcUnit}</span>
                    </div>

                    <button
                        onClick={handleRegister}
                        disabled={loading}
                        className="w-full mt-2 py-1.5 bg-linear-to-r from-sky-400 to-blue-500 hover:from-sky-500 hover:to-blue-600 text-white font-bold text-xs rounded shadow transition-all active:scale-95 cursor-pointer"
                    >
                        {loading ? t.btnRegistering : t.registerNow}
                    </button>
                </div>
            )}

            {/* Confirmation Pop-up Modal for Unregistration */}
            <ConfirmModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={confirmUnregisterAction}
                registeredCount={registeredCount}
                registeredList={registeredList}
                loading={loading}
                lang={lang}
            />

            {/* Success Pop-up Modal for Unregistration */}
            <SuccessModal
                isOpen={isSuccessModalOpen}
                onClose={() => setIsSuccessModalOpen(false)}
                count={successCount}
                lang={lang}
            />

            {/* Course Full Pop-up Modal */}
            <CourseFullModal
                isOpen={!!courseFullInfo}
                courseId={courseFullInfo?.courseId}
                courseName={courseFullInfo?.courseName}
                group={courseFullInfo?.group}
                groups={courseFullInfo?.groups || []}
                isCourseFullyFull={true}
                onClose={() => setCourseFullInfo(null)}
                lang={lang}
            />

            {/* Software Info & Team Developer Modal */}
            <InfoModal
                isOpen={isInfoModalOpen}
                onClose={() => setIsInfoModalOpen(false)}
                lang={lang}
            />

            {/* Study Plan (Kế hoạch học tập) Modal */}
            <StudyPlanModal
                isOpen={isPlanModalOpen}
                onClose={() => setIsPlanModalOpen(false)}
                studentId={mssv}
                courses={courses}
                onProceedToRegister={() => setActiveTab('register')}
                lang={lang}
            />
        </div>
    );
}
