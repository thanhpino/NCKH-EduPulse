/**
 * StatusBadge — Status Indicator per course row (Virtual Waiting Room)
 * Supports English/Vietnamese language switching.
 */
export default function StatusBadge({ status, position, eta, lang }) {
    const currentLang = lang || (typeof window !== 'undefined' ? localStorage.getItem('appLang') || 'vi' : 'vi');

    if (!status) return null;

    if (status === 'DONE') {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                🟢 {currentLang === 'en' ? 'Registered' : 'Đã đăng ký'}
            </span>
        );
    }

    if (status === 'course_full') {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-800 border border-red-300 animate-pulse">
                🔴 {currentLang === 'en' ? 'Class Full' : 'Hết chỗ'}
            </span>
        );
    }

    if (status === 'waiting') {
        const seconds = eta ? Math.max(1, eta) : 2;
        const etaText = currentLang === 'en'
            ? (seconds >= 60 ? `~${Math.ceil(seconds / 60)} min` : `~${seconds}s`)
            : (seconds >= 60 ? `~${Math.ceil(seconds / 60)} phút` : `~${seconds}s`);

        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 shadow-xs animate-pulse">
                🟡 {currentLang === 'en' ? `Queue ${position ? `#${position}` : '#1'} · ${etaText}` : `Hàng đợi ${position ? `#${position}` : '#1'} · ${etaText}`}
            </span>
        );
    }

    if (status === 'PENDING_ENTRY') {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-900 border border-purple-300 shadow-xs animate-pulse">
                ⚡ {currentLang === 'en' ? 'Your turn! (Token Granted)' : 'Đến lượt! (Cấp Token)'}
            </span>
        );
    }

    // ACTIVE status
    return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-300 animate-pulse">
            ⏳ {currentLang === 'en' ? 'Registering...' : 'Đang đăng ký...'}
        </span>
    );
}
