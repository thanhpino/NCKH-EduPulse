import { useState } from 'react';
import { useQueuePolling } from '../hooks/useQueuePolling';
import StatusBadge from './StatusBadge';

/**
 * CourseRow — Dòng môn học chuẩn giao diện Portal TDTU có Dropdown chọn Ca/Nhóm học
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

    // Get active schedule & instructor matching selected group dropdown
    const activeGroup = groups.find((g) => g.group === selectedGroupCode) || groups[0];

    // Alternating background colors matching TDTU portal row styling
    const rowBg = isSelected
        ? 'bg-[#FFF9C4]' // Light yellow highlight when selected
        : rowIndex % 2 === 0
            ? 'bg-white'
            : 'bg-[#FFFDF0]';

    return (
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

            {/* Môn học */}
            <td className="p-2 font-medium text-gray-900 border-r border-[#E8DCDC]">{course.courseName}</td>

            {/* Số TC */}
            <td className="p-2 text-center text-gray-700 font-mono border-r border-[#E8DCDC]">{course.credits || 3}</td>

            {/* Dropdown Chọn Nhóm / Ca học */}
            <td className="p-2 text-center border-r border-[#E8DCDC]">
                <select
                    value={selectedGroupCode}
                    onChange={(e) => setSelectedGroupCode(e.target.value)}
                    disabled={alreadyRegistered}
                    className="bg-white border border-gray-300 rounded px-1.5 py-0.5 text-xs font-mono font-bold text-[#005B7F] focus:outline-none focus:ring-1 focus:ring-[#005B7F] cursor-pointer hover:border-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed shadow-2xs"
                >
                    {groups.map((g) => (
                        <option key={g.group} value={g.group}>
                            Nhóm {g.group}
                        </option>
                    ))}
                </select>
            </td>

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
    );
}
