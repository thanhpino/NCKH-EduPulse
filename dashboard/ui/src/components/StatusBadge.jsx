/**
 * StatusBadge — Status Indicator per course row (Virtual Waiting Room)
 *
 * status: null          → Not requested yet
 * status: 'waiting'     → 🟡 Hàng đợi #position · ~X s/phút
 * status: 'PENDING_ENTRY'→ ⚡ Đến lượt! (Cấp Token)
 * status: 'ACTIVE'      → ⏳ Đang đăng ký...
 * status: 'DONE'        → 🟢 Đã đăng ký
 */
export default function StatusBadge({ status, position, eta }) {
    if (!status) return null;

    if (status === 'DONE') {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                🟢 Đã đăng ký
            </span>
        );
    }

    if (status === 'waiting') {
        const seconds = eta ? Math.max(1, eta) : 2;
        const etaText = seconds >= 60 ? `~${Math.ceil(seconds / 60)} phút` : `~${seconds}s`;
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 shadow-sm animate-pulse">
                🟡 Hàng đợi {position ? `#${position}` : '#1'} · {etaText}
            </span>
        );
    }

    if (status === 'PENDING_ENTRY') {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-900 border border-purple-300 shadow-sm animate-pulse">
                ⚡ Đến lượt! (Cấp Token)
            </span>
        );
    }

    // ACTIVE status
    return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-300 animate-pulse">
            ⏳ Đang đăng ký...
        </span>
    );
}
