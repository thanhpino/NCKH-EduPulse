/**
 * CourseFullModal — Popup thông báo môn học đã đủ sĩ số
 * Hiển thị khi sinh viên đang đợi trong queue nhưng môn đã đầy.
 */
export default function CourseFullModal({ isOpen, courseName, courseId, onClose }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-red-100">
                {/* Header */}
                <div className="bg-linear-to-r from-red-600 to-rose-500 px-6 py-4 flex items-center gap-3">
                    <div className="shrink-0 bg-white/20 rounded-full p-2">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-white font-bold text-base">Môn học đã đủ sĩ số!</h2>
                        <p className="text-red-100 text-xs">Không thể đăng ký môn này</p>
                    </div>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                    {/* Course info badge */}
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3">
                        <span className="text-red-500 text-lg mt-0.5">📚</span>
                        <div>
                            <p className="font-bold text-red-800 text-sm">{courseId}</p>
                            {courseName && (
                                <p className="text-red-600 text-xs mt-0.5">{courseName}</p>
                            )}
                        </div>
                        <span className="ml-auto bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                            HẾT CHỖ
                        </span>
                    </div>

                    {/* Message */}
                    <p className="text-gray-700 text-sm leading-relaxed">
                        Rất tiếc, môn học này đã đạt giới hạn sĩ số trong khi bạn đang chờ. Hàng đợi của bạn đã được hủy tự động.
                    </p>

                    {/* Suggestions */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                        <p className="text-amber-800 font-semibold text-xs uppercase tracking-wide">Gợi ý tiếp theo</p>
                        <ul className="space-y-1.5 text-xs text-amber-900">
                            <li className="flex items-start gap-2">
                                <span className="text-amber-500 font-bold mt-0.5">1.</span>
                                <span>Kiểm tra các <strong>nhóm lớp khác</strong> của môn học này — có thể nhóm khác còn slot trống.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-amber-500 font-bold mt-0.5">2.</span>
                                <span>Chọn <strong>môn học thay thế</strong> tương đương trong KHHT để đảm bảo đủ tín chỉ kỳ này.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-amber-500 font-bold mt-0.5">3.</span>
                                <span>Theo dõi hệ thống — sinh viên hủy môn có thể mở lại slot, hoặc đăng ký vào <strong>kỳ tiếp theo</strong>.</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-5">
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 bg-linear-to-r from-[#005B7F] to-[#007CAD] hover:from-[#004C6B] hover:to-[#006A94] text-white font-bold text-sm rounded-lg shadow transition-all active:scale-95 cursor-pointer"
                    >
                        Đã hiểu, chọn môn khác
                    </button>
                </div>
            </div>
        </div>
    );
}
