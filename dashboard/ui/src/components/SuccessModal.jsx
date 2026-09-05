/**
 * SuccessModal — Pop-up thông báo Hủy môn học thành công chuẩn UI TDTU
 */
export default function SuccessModal({ isOpen, onClose, count = 0 }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-lg shadow-2xl border border-emerald-300 w-full max-w-sm overflow-hidden transform transition-all scale-100">
                {/* Modal Header */}
                <div className="bg-[#005B7F] text-white px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-2 font-bold text-xs tracking-wide">
                        <span className="text-emerald-400 text-base">✅</span>
                        <span>THÔNG BÁO TỪ HỆ THỐNG</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-300 hover:text-white font-bold text-base transition-colors cursor-pointer"
                    >
                        ✕
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 text-center space-y-3">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold shadow-inner">
                        ✓
                    </div>

                    <h4 className="font-bold text-gray-800 text-sm">
                        ĐÃ HỦY ĐĂNG KÝ THÀNH CÔNG!
                    </h4>

                    <p className="text-xs text-gray-600 leading-relaxed">
                        Hệ thống đã hủy <span className="font-bold text-emerald-700">{count}</span> môn học và giải phóng slot trên MongoDB thành công.
                    </p>

                    <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded text-[11px] text-emerald-800 font-mono">
                        Trạng thái danh sách môn học đã được cập nhật real-time.
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="bg-gray-50 px-5 py-3 text-center border-t border-gray-100">
                    <button
                        onClick={onClose}
                        className="w-full py-2 bg-[#005B7F] hover:bg-[#00425C] text-white font-bold rounded text-xs shadow transition-all cursor-pointer active:scale-95"
                    >
                        Đồng ý (Đóng)
                    </button>
                </div>
            </div>
        </div>
    );
}
