/**
 * StatusBadge — Status Indicator per course row
 *
 * status: null         → Not requested yet
 * status: 'waiting'    → 🟡 Đang chờ #position · ~X phút
 * status: 'PENDING_ENTRY' | 'ACTIVE' → ⏳ Đang xử lý...
 * status: 'DONE'       → 🟢 Đã đăng ký
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
        const minutes = eta ? Math.max(1, Math.ceil(eta / 60)) : 1;
        const etaText = `~${minutes} phút`;
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 shadow-sm animate-pulse">
                🟡 Đang chờ {position ? `#${position}` : ''} · {etaText}
            </span>
        );
    }

    return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-300">
            ⏳ Đang xử lý...
        </span>
    );
}
