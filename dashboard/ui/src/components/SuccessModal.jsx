/**
 * SuccessModal — Pop-up thông báo Hủy môn học thành công chuẩn UI TDTU
 * Supports English/Vietnamese localization.
 */
export default function SuccessModal({ isOpen, onClose, count = 0, lang }) {
    const currentLang = lang || (typeof window !== 'undefined' ? localStorage.getItem('appLang') || 'vi' : 'vi');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-lg shadow-2xl border border-emerald-300 w-full max-w-sm overflow-hidden transform transition-all scale-100">
                {/* Modal Header */}
                <div className="bg-[#005B7F] text-white px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-2 font-bold text-xs tracking-wide">
                        <span className="text-emerald-400 text-base">✅</span>
                        <span>{currentLang === 'en' ? 'SYSTEM NOTIFICATION' : 'THÔNG BÁO TỪ HỆ THỐNG'}</span>
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
                        {currentLang === 'en' ? 'CANCELLED SUCCESSFULLY!' : 'ĐÃ HỦY ĐĂNG KÝ THÀNH CÔNG!'}
                    </h4>

                    <p className="text-xs text-gray-600 leading-relaxed">
                        {currentLang === 'en' ? (
                            <>
                                System successfully cancelled <span className="font-bold text-emerald-700">{count}</span> course(s) and released class slots.
                            </>
                        ) : (
                            <>
                                Hệ thống đã hủy <span className="font-bold text-emerald-700">{count}</span> môn học và giải phóng slot thành công.
                            </>
                        )}
                    </p>

                    <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded text-[11px] text-emerald-800 font-mono">
                        {currentLang === 'en'
                            ? 'Registered course list updated. Please review your schedule.'
                            : 'Trạng thái danh sách môn học đã được cập nhật. Sinh viên vui lòng xem lại danh sách.'}
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="bg-gray-50 px-5 py-3 text-center border-t border-gray-100">
                    <button
                        onClick={onClose}
                        className="w-full py-2 bg-[#005B7F] hover:bg-[#00425C] text-white font-bold rounded text-xs shadow transition-all cursor-pointer active:scale-95"
                    >
                        {currentLang === 'en' ? 'OK (Close)' : 'Đồng ý (Đóng)'}
                    </button>
                </div>
            </div>
        </div>
    );
}
