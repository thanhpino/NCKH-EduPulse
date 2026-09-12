/**
 * CourseFullModal — Popup thông báo nhóm/môn học đã đủ sĩ số
 * 
 * 2 Kịch bản:
 *   A) Nhóm X bị đầy nhưng CÒN nhóm khác trống → hiện danh sách nhóm khác để chọn
 *   B) TẤT CẢ nhóm của môn đều đầy → chỉ hiện thông báo đầy, khuyên chọn môn khác/kỳ sau
 */
export default function CourseFullModal({ isOpen, courseName, courseId, group, groups, isCourseFullyFull, onClose }) {
    if (!isOpen) return null;

    // Determine if there are alternative groups available
    // Since all groups share the same courseId capacity in current system,
    // if courseId is full → all groups are full
    const allGroupsFull = isCourseFullyFull;
    const otherGroups = (groups || []).filter((g) => g.group !== group);

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
                        <h2 className="text-white font-bold text-base">
                            {allGroupsFull ? 'Tất cả nhóm đã đủ sĩ số!' : `Nhóm ${group} đã đủ sĩ số!`}
                        </h2>
                        <p className="text-red-100 text-xs">
                            {allGroupsFull
                                ? 'Không còn nhóm nào trống cho môn học này'
                                : 'Vui lòng chọn nhóm lớp khác còn trống'}
                        </p>
                    </div>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                    {/* Course + Group info badge */}
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3">
                        <span className="text-red-500 text-lg mt-0.5">📚</span>
                        <div className="flex-1">
                            <p className="font-bold text-red-800 text-sm">{courseId}</p>
                            {courseName && (
                                <p className="text-red-600 text-xs mt-0.5">{courseName}</p>
                            )}
                            <p className="text-red-700 text-[11px] mt-1 font-medium">
                                Nhóm đăng ký: <span className="font-bold">Nhóm {group || '01'}</span>
                            </p>
                        </div>
                        <span className="ml-auto bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                            HẾT CHỖ
                        </span>
                    </div>

                    {/* Context message */}
                    <p className="text-gray-700 text-sm leading-relaxed">
                        {allGroupsFull
                            ? <>Rất tiếc, <strong>tất cả các nhóm</strong> của môn học <strong>{courseName || courseId}</strong> đều đã đạt giới hạn sĩ số. Hàng đợi của bạn đã được hủy tự động.</>
                            : <>Rất tiếc, <strong>Nhóm {group}</strong> của môn học <strong>{courseName || courseId}</strong> đã đạt giới hạn sĩ số trong khi bạn đang chờ. Hàng đợi của bạn đã được hủy tự động.</>
                        }
                    </p>

                    {/* Alternative groups list (only when NOT all groups are full) */}
                    {!allGroupsFull && otherGroups.length > 0 && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
                            <p className="text-emerald-800 font-semibold text-xs uppercase tracking-wide flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                Nhóm khác còn trống — chọn để đăng ký
                            </p>
                            <div className="space-y-1.5">
                                {otherGroups.map((g) => (
                                    <div
                                        key={g.group}
                                        className="flex items-center gap-2 bg-white border border-emerald-200 rounded-md px-3 py-2 hover:bg-emerald-100 transition-colors cursor-pointer"
                                        onClick={onClose}
                                    >
                                        <span className="bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                                            N{g.group}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-gray-800 truncate">
                                                {g.schedule}
                                            </p>
                                            <p className="text-[11px] text-gray-500 truncate">
                                                {g.instructor}
                                            </p>
                                        </div>
                                        <span className="text-emerald-600 text-[10px] font-semibold whitespace-nowrap">
                                            CÒN CHỖ
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* All groups full — suggestions */}
                    {allGroupsFull && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                            <p className="text-amber-800 font-semibold text-xs uppercase tracking-wide">Gợi ý tiếp theo</p>
                            <ul className="space-y-1.5 text-xs text-amber-900">
                                <li className="flex items-start gap-2">
                                    <span className="text-amber-500 font-bold mt-0.5">1.</span>
                                    <span>Chọn <strong>môn học thay thế</strong> tương đương trong KHHT để đảm bảo đủ tín chỉ kỳ này.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-amber-500 font-bold mt-0.5">2.</span>
                                    <span>Theo dõi hệ thống — sinh viên hủy môn có thể mở lại slot, hoặc đăng ký vào <strong>kỳ tiếp theo</strong>.</span>
                                </li>
                            </ul>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 pb-5">
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 bg-linear-to-r from-[#005B7F] to-[#007CAD] hover:from-[#004C6B] hover:to-[#006A94] text-white font-bold text-sm rounded-lg shadow transition-all active:scale-95 cursor-pointer"
                    >
                        {allGroupsFull ? 'Đã hiểu, chọn môn khác' : 'Đã hiểu, chọn nhóm khác'}
                    </button>
                </div>
            </div>
        </div>
    );
}
