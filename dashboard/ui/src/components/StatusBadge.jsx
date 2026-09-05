/**
 * StatusBadge — hiển thị trạng thái đăng ký môn học per-row
 *
 * status: null         → không hiện gì (chưa bấm Đăng ký)
 * status: 'waiting'    → 🟡 Đang chờ #pos · ~eta phút
 * status: 'PENDING_ENTRY' | 'ACTIVE' → ⏳ Đang xử lý...
 * status: 'DONE'       → 🟢 Đã đăng ký
 */
export default function StatusBadge({ status, position, eta }) {
    if (!status) return null;

    if (status === 'DONE') {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                🟢 Đã đăng ký
            </span>
        );
    }

    if (status === 'waiting') {
        const etaText = eta ? `~${Math.ceil(eta / 60)} phút` : '...';
        return (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
                🟡 Đang chờ {position ? `#${position}` : ''} · {etaText}
            </span>
        );
    }

    // PENDING_ENTRY, ACTIVE, hoặc trạng thái trung gian khác
    return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
            ⏳ Đang xử lý...
        </span>
    );
}
