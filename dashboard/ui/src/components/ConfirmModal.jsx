/**
 * ConfirmModal — Pop-up modal xác nhận hủy đăng ký môn học chuẩn UI TDTU
 */
export default function ConfirmModal({ isOpen, onClose, onConfirm, registeredCount, registeredList = [], loading }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-lg shadow-2xl border border-red-200 w-full max-w-md overflow-hidden transform transition-all scale-100">
                {/* Modal Header */}
                <div className="bg-[#8C0000] text-white px-5 py-3.5 flex items-center justify-between">
                    <div className="flex items-center space-x-2 font-bold text-sm">
                        <span className="text-amber-300 text-base">⚠️</span>
                        <span>XÁC NHẬN HỦY ĐĂNG KÝ MÔN HỌC</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-300 hover:text-white text-lg font-bold transition-colors cursor-pointer"
                    >
                        ✕
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-5 space-y-4 text-xs text-gray-700">
                    <p className="font-semibold text-gray-800 text-sm">
                        Bạn có chắc chắn muốn hủy đăng ký <span className="text-red-700 font-bold">{registeredCount}</span> môn học đã được hệ thống ghi nhận?
                    </p>

                    {registeredList.length > 0 && (
                        <div className="bg-gray-50 p-3 rounded border border-gray-200 space-y-1.5 max-h-36 overflow-y-auto">
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Danh sách môn học sẽ bị hủy:</span>
                            {registeredList.map((r) => (
                                <div key={r.courseId} className="flex justify-between items-center bg-white p-2 rounded border border-gray-200 text-xs">
                                    <span className="font-mono font-bold text-red-900">{r.courseId}</span>
                                    <span className="text-gray-600 truncate max-w-50">{r.courseName || r.courseId}</span>
                                    <span className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-medium">Xác nhận hủy</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="bg-amber-50 border-l-4 border-amber-500 p-3 text-amber-900 rounded text-[11px] space-y-1">
                        <div className="font-bold flex items-center gap-1">
                            <span>ℹ️ LƯU Ý QUAN TRỌNG:</span>
                        </div>
                        <p>Thao tác này sẽ xóa môn học sinh viên chôn và giải phóng slot môn học để nhường lại cho các sinh viên khác.</p>
                    </div>
                </div>

                {/* Modal Footer / Action Buttons */}
                <div className="bg-gray-100 px-5 py-3 flex justify-end space-x-3 border-t border-gray-200">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2 bg-white hover:bg-gray-200 text-gray-700 font-semibold rounded text-xs border border-gray-300 transition-all cursor-pointer"
                    >
                        Quay lại
                    </button>

                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className="px-5 py-2 bg-red-700 hover:bg-red-800 active:bg-red-900 text-white font-bold rounded text-xs shadow transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95"
                    >
                        {loading ? (
                            <>
                                <span className="animate-spin text-white">⏳</span>
                                <span>Đang xử lý hủy...</span>
                            </>
                        ) : (
                            <>
                                <span>🗑️ Xác nhận Hủy môn</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
