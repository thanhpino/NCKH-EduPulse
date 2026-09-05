import { useState } from 'react';
import { useQueuePolling } from '../hooks/useQueuePolling';
import StatusBadge from './StatusBadge';

/**
 * CourseRow — Dòng môn học chuẩn giao diện Portal TDTU có Accordion chọn Ca/Nhóm học
 */
export default function CourseRow({ course, isSelected, onToggle, cartEntry, studentId, rowIndex, onStatusChange }) {
    const { status, position, eta } = useQueuePolling(
        cartEntry?.ticketId ?? null,
        course.courseId,
        studentId,
        cartEntry?.status ?? null,
        onStatusChange
    );

    const isFull = course.enrolled >= course.maxSlots;
    const alreadyRegistered = status === 'DONE';

    // Toggle expansion for class group list sub-row
    const [isExpanded, setIsExpanded] = useState(false);

    // Available class groups for this course (default 3 groups if not provided)
    const groups = course.groups || [
        {
            group: '01',
            schedule: course.schedule || '---012---, Thứ 2, Phòng C101, ---1234----9012345---',
            instructor: course.instructor || 'TS. Nguyễn Văn A',
        },
        {
            group: '02',
            schedule: '---345---, Thứ 4, Phòng C202, ---1234567---12345---',
            instructor: 'PGS. TS. Trương Minh Thành',
        },
        {
            group: '03',
            schedule: '---678---, Thứ 6, Phòng A301, ---123456--9012345---',
            instructor: 'TS. Lê Văn Hoàng',
        },
    ];

    const [selectedGroupCode, setSelectedGroupCode] = useState(course.group || '01');

    // Get active schedule & instructor matching selected group
    const activeGroup = groups.find((g) => g.group === selectedGroupCode) || groups[0];

    // Alternating background colors matching TDTU portal row styling
    const rowBg = isSelected
        ? 'bg-[#FFF9C4]' // Light yellow highlight when selected
        : rowIndex % 2 === 0
            ? 'bg-white'
            : 'bg-[#FFFDF0]';

    return (
        <>
            <tr className={`border-b border-[#E8DCDC] hover:bg-[#FFF9C4] transition-colors text-xs ${rowBg}`}>
                {/* Checkbox */}
                <td className="p-2 text-center border-r border-[#E8DCDC]">
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={onToggle}
                        disabled={alreadyRegistered}
                        className="accent-[#8C0000] cursor-pointer h-3.5 w-3.5"
                    />
                </td>

                {/* Mã MH */}
                <td className="p-2 font-mono font-medium text-gray-800 border-r border-[#E8DCDC]">{course.courseId}</td>

                {/* Môn học & Nút mũi tên mở danh sách nhóm ca học */}
                <td className="p-2 font-medium text-gray-900 border-r border-[#E8DCDC]">
                    <div className="flex items-center justify-between gap-2">
                        <span>{course.courseName}</span>

                        {/* Button Mũi tên xuống để mở list nhóm (đẩy các môn dưới xuống) */}
                        <button
                            type="button"
                            onClick={() => setIsExpanded(!isExpanded)}
                            className={`flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded border transition-all shrink-0 cursor-pointer ${isExpanded
                                ? 'bg-[#8C0000] text-white border-[#8C0000] shadow-sm'
                                : 'bg-amber-100/90 hover:bg-amber-200 text-amber-900 border-amber-300 shadow-2xs'
                                }`}
                            title="Bấm để xem lịch các ca học và chọn nhóm"
                        >
                            <span>Nhóm {activeGroup.group}</span>
                            <svg
                                className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>
                </td>

                {/* Số TC */}
                <td className="p-2 text-center text-gray-700 font-mono border-r border-[#E8DCDC]">{course.credits || 3}</td>

                {/* Sĩ số SL/Tối đa */}
                <td className="p-2 text-center font-mono font-bold border-r border-[#E8DCDC]">
                    <span className={isFull ? 'text-[#D32F2F]' : 'text-[#1976D2]'}>
                        {course.enrolled}/{course.maxSlots}
                    </span>
                </td>

                {/* Lịch học (Cập nhật theo Nhóm/Ca đã chọn) */}
                <td className="p-2 text-gray-700 font-mono text-[11px] border-r border-[#E8DCDC]">
                    <span className="font-semibold text-amber-800 bg-amber-50 px-1 py-0.5 rounded border border-amber-200 mr-1 text-[10px]">
                        N{activeGroup.group}
                    </span>
                    {activeGroup.schedule}
                </td>

                {/* Tên Giảng viên (Cập nhật theo Nhóm/Ca đã chọn) */}
                <td className="p-2 text-gray-700 border-r border-[#E8DCDC]">
                    {activeGroup.instructor}
                </td>

                {/* Status Badge Column */}
                <td className="p-2">
                    <StatusBadge status={status} position={position} eta={eta} />
                </td>
            </tr>

            {/* Accordion Sub-row: Xổ danh sách nhóm ca học (đẩy môn dưới xuống) */}
            {isExpanded && (
                <tr className="bg-amber-50/90 border-b-2 border-amber-300 text-xs">
                    <td colSpan={8} className="p-3 pl-8 bg-linear-to-r from-amber-50/80 via-sky-50/40 to-amber-50/80">
                        <div className="bg-white border border-amber-200 rounded-lg p-3 shadow-md space-y-2">
                            <div className="flex items-center justify-between font-bold text-xs text-amber-900 border-b border-amber-200 pb-2">
                                <span className="flex items-center gap-2">
                                    <span className="bg-[#8C0000] text-white text-[10px] px-1.5 py-0.5 rounded font-black">DANH SÁCH CA HỌC MỞ LỚP</span>
                                    <span>Chọn Nhóm / Ca học cho môn: <strong className="text-gray-900">{course.courseName}</strong></span>
                                </span>
                                <span className="text-[11px] font-mono text-gray-500 font-normal">Mã MH: {course.courseId}</span>
                            </div>

                            <div className="space-y-1.5">
                                {groups.map((g) => {
                                    const isThisGroupSelected = selectedGroupCode === g.group;
                                    return (
                                        <div
                                            key={g.group}
                                            onClick={() => {
                                                if (!alreadyRegistered) {
                                                    setSelectedGroupCode(g.group);
                                                }
                                            }}
                                            className={`flex items-center justify-between p-2.5 rounded-md border cursor-pointer transition-all ${isThisGroupSelected
                                                ? 'bg-[#FFF9C4] border-amber-400 shadow-sm ring-1 ring-amber-400 font-semibold'
                                                : 'bg-gray-50/80 border-gray-200 hover:bg-amber-50/80 text-gray-700'
                                                } ${alreadyRegistered ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        >
                                            <div className="flex items-center space-x-3 shrink-0">
                                                <input
                                                    type="radio"
                                                    name={`group-${course.courseId}`}
                                                    checked={isThisGroupSelected}
                                                    onChange={() => setSelectedGroupCode(g.group)}
                                                    disabled={alreadyRegistered}
                                                    className="accent-[#8C0000] cursor-pointer h-4 w-4"
                                                />
                                                <span className="font-mono font-bold text-xs text-[#005B7F]">
                                                    Nhóm {g.group}
                                                </span>
                                            </div>

                                            <div className="flex-1 px-4 font-mono text-[11px] text-gray-800">
                                                <span className="text-gray-500 font-sans mr-1 font-normal">Lịch học:</span>
                                                <span className="font-semibold text-amber-900">{g.schedule}</span>
                                            </div>

                                            <div className="text-[11px] text-gray-700 font-medium w-56 text-right shrink-0">
                                                <span className="text-gray-500 font-sans mr-1 font-normal">Giảng viên:</span>
                                                <span className="font-semibold text-gray-900">{g.instructor}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}
