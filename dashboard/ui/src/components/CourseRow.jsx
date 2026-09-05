import { useQueuePolling } from '../hooks/useQueuePolling';
import StatusBadge from './StatusBadge';

/**
 * CourseRow — Dòng môn học chuẩn giao diện Portal TDTU
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

            {/* Nhóm */}
            <td className="p-2 text-center text-gray-700 font-mono border-r border-[#E8DCDC]">{course.group || '01'}</td>

            {/* Sĩ số SL/Tối đa — Red if full/near full, Blue if available */}
            <td className="p-2 text-center font-mono font-bold border-r border-[#E8DCDC]">
                <span className={isFull ? 'text-[#D32F2F]' : 'text-[#1976D2]'}>
                    {course.enrolled}/{course.maxSlots}
                </span>
            </td>

            {/* Lịch học */}
            <td className="p-2 text-gray-700 font-mono text-[11px] border-r border-[#E8DCDC]">
                {course.schedule || '---012---, Thứ 4, Phòng C101'}
            </td>

            {/* Tên Giảng viên */}
            <td className="p-2 text-gray-700 border-r border-[#E8DCDC]">{course.instructor || 'TS. Nguyễn Văn A'}</td>

            {/* Status Badge Column */}
            <td className="p-2">
                <StatusBadge status={status} position={position} eta={eta} />
            </td>
        </tr>
    );
}
