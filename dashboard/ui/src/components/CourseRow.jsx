import { useState, useEffect } from 'react';
import { useQueuePolling } from '../hooks/useQueuePolling';
import StatusBadge from './StatusBadge';

/**
 * CourseRow — Dòng môn học chuẩn giao diện Portal TDTU có Accordion chọn Ca/Nhóm học
 * Tông màu đỏ mận mượt mà (TDTU Brand Crimson Red) dễ nhận diện, bỏ các khung trống 
 * không cần thiết (Mã MH, Số TC, Sĩ số, Trạng thái) và căn chỉnh 3 khối dữ liệu chuẩn cột.
 */
export default function CourseRow({ course, isSelected, onToggle, cartEntry, studentId, rowIndex, onStatusChange, onGroupChange }) {
    const { status, position, eta } = useQueuePolling(
        cartEntry?.ticketId ?? null,
        course.courseId,
        studentId,
        cartEntry?.status ?? null,
        onStatusChange
    );

    const isFull = course.enrolled >= course.maxSlots;
    const alreadyRegistered = status === 'DONE';

    // Toggle expansion for class group list sub-rows
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

    // Notify parent on mount (initial group) and group change
    const handleGroupChange = (groupCode) => {
        setSelectedGroupCode(groupCode);
        if (onGroupChange) onGroupChange(course.courseId, groupCode);
    };

    // Notify parent of initial group on mount
    useEffect(() => {
        if (onGroupChange) onGroupChange(course.courseId, selectedGroupCode);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
            {/* Dòng môn học chính */}
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

            {/* Dòng các Nhóm / Ca học (TÔNG MÀU ĐỎ MẬN TDTU SÁNG MƯỢT, BỎ CÁC KHUNG TRỐNG KHÔNG CẦN THIẾT) */}
            {isExpanded &&
                groups.map((g) => {
                    const isThisGroupSelected = selectedGroupCode === g.group;
                    return (
                        <tr
                            key={g.group}
                            onClick={() => {
                                if (!alreadyRegistered) {
                                    handleGroupChange(g.group);
                                }
                            }}
                            className={`border-b text-xs transition-all cursor-pointer ${isThisGroupSelected
                                ? 'bg-[#FCD8D8] text-[#8C0000] font-semibold border-l-4 border-l-[#8C0000] border-b-rose-300'
                                : 'bg-[#FFF5F5] hover:bg-[#FDE8E8] text-gray-800 border-b-rose-200/80'
                                } ${alreadyRegistered ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                            {/* 1. Gộp cột Chọn + Mã MH + Môn Học (colSpan 3) */}
                            <td colSpan={3} className="p-2 border-r border-rose-200/70">
                                <div className="flex items-center space-x-2 pl-3">
                                    <span className="text-[#8C0000] font-bold text-xs">↳</span>
                                    <input
                                        type="radio"
                                        name={`group-${course.courseId}`}
                                        checked={isThisGroupSelected}
                                        onChange={() => handleGroupChange(g.group)}
                                        disabled={alreadyRegistered}
                                        className="accent-[#8C0000] cursor-pointer h-3.5 w-3.5"
                                    />
                                    <span className={`font-mono text-xs ${isThisGroupSelected ? 'font-bold text-[#8C0000]' : 'text-gray-800'}`}>
                                        Nhóm {g.group}
                                    </span>
                                    {isThisGroupSelected && (
                                        <span className="bg-[#8C0000] text-white text-[10px] font-bold px-1.5 py-0.2 rounded shadow-2xs">
                                            ĐANG CHỌN
                                        </span>
                                    )}
                                </div>
                            </td>

                            {/* 2. Gộp cột Số TC + Sĩ Số + Lịch Học (colSpan 3) — Căn thẳng cột Lịch Học */}
                            <td colSpan={3} className="p-2 font-mono text-[11px] border-r border-rose-200/70">
                                <span className="font-semibold text-[#8C0000] bg-rose-100 px-1 py-0.5 rounded border border-rose-300 mr-1.5 text-[10px]">
                                    N{g.group}
                                </span>
                                <span className={isThisGroupSelected ? 'text-gray-900 font-semibold' : 'text-gray-700'}>
                                    {g.schedule}
                                </span>
                            </td>

                            {/* 3. Gộp cột Tên Giảng Viên + Trạng Thái (colSpan 2) — Căn thẳng cột Giảng Viên */}
                            <td colSpan={2} className="p-2 text-gray-800">
                                <span className={isThisGroupSelected ? 'text-[#8C0000] font-bold' : 'text-gray-700'}>
                                    {g.instructor}
                                </span>
                            </td>
                        </tr>
                    );
                })}
        </>
    );
}
