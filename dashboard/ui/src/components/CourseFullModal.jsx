/**
 * CourseFullModal — Popup thông báo nhóm/môn học đã đủ sĩ số
 * Supports English/Vietnamese localization.
 */
import { translateCourseName, translateSchedule, translateInstructor } from '../utils/i18n';

export default function CourseFullModal({ isOpen, courseName, courseId, group, groups, isCourseFullyFull, onClose, lang }) {
    const currentLang = lang || (typeof window !== 'undefined' ? localStorage.getItem('appLang') || 'vi' : 'vi');

    if (!isOpen) return null;

    const allGroupsFull = isCourseFullyFull;
    const otherGroups = (groups || []).filter((g) => g.group !== group);
    const displayCourseName = translateCourseName(courseId, courseName || courseId, currentLang);

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
                            {allGroupsFull
                                ? (currentLang === 'en' ? 'All Groups Are Full!' : 'Tất cả nhóm đã đủ sĩ số!')
                                : (currentLang === 'en' ? `Group ${group} Is Full!` : `Nhóm ${group} đã đủ sĩ số!`)}
                        </h2>
                        <p className="text-red-100 text-xs">
                            {allGroupsFull
                                ? (currentLang === 'en' ? 'No available groups left for this course' : 'Không còn nhóm nào trống cho môn học này')
                                : (currentLang === 'en' ? 'Please select another available group' : 'Vui lòng chọn nhóm lớp khác còn trống')}
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
                            {displayCourseName && (
                                <p className="text-red-600 text-xs mt-0.5">{displayCourseName}</p>
                            )}
                            <p className="text-red-700 text-[11px] mt-1 font-medium">
                                {currentLang === 'en' ? `Selected Section: Group ${group || '01'}` : `Nhóm đăng ký: Nhóm ${group || '01'}`}
                            </p>
                        </div>
                        <span className="ml-auto bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                            {currentLang === 'en' ? 'FULL' : 'HẾT CHỖ'}
                        </span>
                    </div>

                    {/* Context message */}
                    <p className="text-gray-700 text-sm leading-relaxed">
                        {allGroupsFull ? (
                            currentLang === 'en' ? (
                                <>Sorry, <strong>all groups</strong> for course <strong>{displayCourseName}</strong> have reached full capacity. Your queue entry was cancelled.</>
                            ) : (
                                <>Rất tiếc, <strong>tất cả các nhóm</strong> của môn học <strong>{displayCourseName}</strong> đều đã đạt giới hạn sĩ số. Hàng đợi của bạn đã được hủy tự động.</>
                            )
                        ) : (
                            currentLang === 'en' ? (
                                <>Sorry, <strong>Group {group}</strong> of course <strong>{displayCourseName}</strong> reached full capacity while you were in queue. Your queue entry was cancelled.</>
                            ) : (
                                <>Rất tiếc, <strong>Nhóm {group}</strong> của môn học <strong>{displayCourseName}</strong> đã đạt giới hạn sĩ số trong khi bạn đang chờ. Hàng đợi của bạn đã được hủy tự động.</>
                            )
                        )}
                    </p>

                    {/* Alternative groups list */}
                    {!allGroupsFull && otherGroups.length > 0 && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
                            <p className="text-emerald-800 font-semibold text-xs uppercase tracking-wide flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                {currentLang === 'en' ? 'Other available groups — select to register' : 'Nhóm khác còn trống — chọn để đăng ký'}
                            </p>
                            <div className="space-y-1.5">
                                {otherGroups.map((g) => (
                                    <div
                                        key={g.group}
                                        className="flex items-center gap-2 bg-white border border-emerald-200 rounded-md px-3 py-2 hover:bg-emerald-100 transition-colors cursor-pointer"
                                        onClick={onClose}
                                    >
                                        <span className="bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                                            {currentLang === 'en' ? `G${g.group}` : `N${g.group}`}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-gray-800 truncate">
                                                {translateSchedule(g.schedule, currentLang)}
                                            </p>
                                            <p className="text-[11px] text-gray-500 truncate">
                                                {translateInstructor(g.instructor, currentLang)}
                                            </p>
                                        </div>
                                        <span className="text-emerald-600 text-[10px] font-semibold whitespace-nowrap">
                                            {currentLang === 'en' ? 'AVAILABLE' : 'CÒN CHỖ'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Suggestions */}
                    {allGroupsFull && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                            <p className="text-amber-800 font-semibold text-xs uppercase tracking-wide">
                                {currentLang === 'en' ? 'Next Suggestions' : 'Gợi ý tiếp theo'}
                            </p>
                            <ul className="space-y-1.5 text-xs text-amber-900">
                                <li className="flex items-start gap-2">
                                    <span className="text-amber-500 font-bold mt-0.5">1.</span>
                                    <span>
                                        {currentLang === 'en'
                                            ? 'Select an equivalent course in your Study Plan to ensure sufficient credits this term.'
                                            : 'Chọn môn học thay thế tương đương trong KHHT để đảm bảo đủ tín chỉ kỳ này.'}
                                    </span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-amber-500 font-bold mt-0.5">2.</span>
                                    <span>
                                        {currentLang === 'en'
                                            ? 'Monitor system — dropped slots may reopen or register in next semester.'
                                            : 'Theo dõi hệ thống — sinh viên hủy môn có thể mở lại slot, hoặc đăng ký vào kỳ tiếp theo.'}
                                    </span>
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
                        {allGroupsFull
                            ? (currentLang === 'en' ? 'Got it, choose another course' : 'Đã hiểu, chọn môn khác')
                            : (currentLang === 'en' ? 'Got it, choose another group' : 'Đã hiểu, chọn nhóm khác')}
                    </button>
                </div>
            </div>
        </div>
    );
}
