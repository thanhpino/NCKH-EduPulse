import { useQueuePolling } from '../hooks/useQueuePolling';
import StatusBadge from './StatusBadge';

/**
 * CourseRow — 1 dòng trong bảng môn học
 *
 * Props:
 *   course     : { courseId, courseName, maxSlots, enrolled }
 *   isSelected : boolean
 *   onToggle   : () => void
 *   cartEntry  : { ticketId, status } | undefined
 *   studentId  : string — MSSV, cần thiết cho bước /api/register
 */
export default function CourseRow({ course, isSelected, onToggle, cartEntry, studentId }) {
    const { status, position, eta } = useQueuePolling(
        cartEntry?.ticketId ?? null,
        course.courseId,
        studentId,              // truyền xuống hook để gọi /api/register
        cartEntry?.status ?? null
    );

    const isFull = course.enrolled >= course.maxSlots;
    const alreadyRegistered = status === 'DONE';

    return (
        <tr className="border-b border-gray-200 hover:bg-gray-50 text-sm">
            {/* Checkbox — disable sau khi đã đăng ký xong */}
            <td className="px-3 py-2 text-center">
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={onToggle}
                    disabled={alreadyRegistered}
                    className="accent-[#E0001A] cursor-pointer"
                />
            </td>

            <td className="px-3 py-2 font-mono text-gray-700">{course.courseId}</td>
            <td className="px-3 py-2 font-medium text-gray-800">{course.courseName}</td>

            {/* Số TC — mock-backend không có trường tín chỉ, dùng 3 mặc định */}
            <td className="px-3 py-2 text-center text-gray-600">3</td>

            {/* Sĩ số */}
            <td className="px-3 py-2 text-center">
                <span className={isFull ? 'text-red-500 font-semibold' : 'text-gray-600'}>
                    {course.enrolled}/{course.maxSlots}
                </span>
            </td>

            {/* Badge trạng thái — tự poll độc lập */}
            <td className="px-3 py-2">
                <StatusBadge status={status} position={position} eta={eta} />
            </td>
        </tr>
    );
}
