/**
 * EduPulse Dashboard — Internationalization (i18n) Helper Utilities
 * Comprehensive bilingual English/Vietnamese dictionary for all 25 CS courses.
 */

export const COURSE_TRANSLATIONS = {
    CS101: {
        name: { vi: 'Nhập môn Lập trình', en: 'Introduction to Programming' },
    },
    CS102: {
        name: { vi: 'Kỹ thuật Lập trình', en: 'Programming Techniques' },
    },
    CS201: {
        name: { vi: 'Cấu trúc Dữ liệu & Giải thuật', en: 'Data Structures & Algorithms' },
    },
    CS202: {
        name: { vi: 'Lập trình Hướng đối tượng', en: 'Object-Oriented Programming' },
    },
    CS301: {
        name: { vi: 'Cơ sở Dữ liệu', en: 'Database Systems' },
    },
    CS302: {
        name: { vi: 'Hệ Quản trị CSDL', en: 'Database Management Systems' },
    },
    CS401: {
        name: { vi: 'Mạng Máy tính', en: 'Computer Networks' },
    },
    CS402: {
        name: { vi: 'Lập trình Mạng', en: 'Network Programming' },
    },
    CS501: {
        name: { vi: 'Trí tuệ Nhân tạo', en: 'Artificial Intelligence' },
    },
    CS502: {
        name: { vi: 'Học máy & Khai phá Dữ liệu', en: 'Machine Learning & Data Mining' },
    },
    CS601: {
        name: { vi: 'Phát triển Ứng dụng Web', en: 'Web Application Development' },
    },
    CS602: {
        name: { vi: 'Lập trình Thiết bị Di động', en: 'Mobile Application Development' },
    },
    CS701: {
        name: { vi: 'An toàn & Bảo mật Thông tin', en: 'Information Security & Safety' },
    },
    CS702: {
        name: { vi: 'Mã hóa & Ứng dụng', en: 'Cryptography & Applications' },
    },
    CS801: {
        name: { vi: 'Kiến trúc Phần mềm', en: 'Software Architecture' },
    },
    CS802: {
        name: { vi: 'Kiểm thử & Đảm bảo Chất lượng PM', en: 'Software Testing & Quality Assurance' },
    },
    CS901: {
        name: { vi: 'Điện toán Đám mây', en: 'Cloud Computing' },
    },
    CS902: {
        name: { vi: 'Hệ thống Phân tán', en: 'Distributed Systems' },
    },
    CS1001: {
        name: { vi: 'Lập trình Python Nâng cao', en: 'Advanced Python Programming' },
    },
    CS1002: {
        name: { vi: 'Xử lý Ảnh & Thị giác Máy tính', en: 'Image Processing & Computer Vision' },
    },
    CS1101: {
        name: { vi: 'Xử lý Ngôn ngữ Tự nhiên', en: 'Natural Language Processing' },
    },
    CS1102: {
        name: { vi: 'Công nghệ Blockchain & Smart Contracts', en: 'Blockchain Technology & Smart Contracts' },
    },
    CS1201: {
        name: { vi: 'Quản lý Dự án Phần mềm', en: 'Software Project Management' },
    },
    CS1202: {
        name: { vi: 'Thiết kế Giao diện UI/UX', en: 'UI/UX Interface Design' },
    },
    CS1203: {
        name: { vi: 'Thực tập Doanh nghiệp & Đồ án', en: 'Enterprise Internship & Capstone Project' },
    },
};

export function translateCourseName(courseId, originalName, lang = 'vi') {
    if (lang === 'vi') return originalName;
    if (COURSE_TRANSLATIONS[courseId]?.name?.en) {
        return COURSE_TRANSLATIONS[courseId].name.en;
    }
    return originalName;
}

export function translateSchedule(scheduleStr, lang = 'vi') {
    if (!scheduleStr || lang === 'vi') return scheduleStr;
    return scheduleStr
        .replace(/Thứ 2/g, 'Mon')
        .replace(/Thứ 3/g, 'Tue')
        .replace(/Thứ 4/g, 'Wed')
        .replace(/Thứ 5/g, 'Thu')
        .replace(/Thứ 6/g, 'Fri')
        .replace(/Thứ 7/g, 'Sat')
        .replace(/Chủ Nhật/g, 'Sun')
        .replace(/Phòng/g, 'Room');
}

export function translateInstructor(instructorStr, lang = 'vi') {
    if (!instructorStr || lang === 'vi') return instructorStr;
    return instructorStr
        .replace(/PGS\. TS\./g, 'Assoc. Prof. Dr.')
        .replace(/TS\./g, 'Dr.')
        .replace(/ThS\./g, 'M.Sc.')
        .replace(/Nguyễn Văn A/g, 'Nguyen Van A')
        .replace(/Trương Minh Thành/g, 'Truong Minh Thanh')
        .replace(/Huỳnh Trần Thiên Phú/g, 'Huynh Tran Thien Phu')
        .replace(/Phạm Minh D/g, 'Pham Minh D')
        .replace(/Đỗ Thanh E/g, 'Do Thanh E')
        .replace(/Nguyễn Thị Thu/g, 'Nguyen Thi Thu')
        .replace(/Lê Văn Hoàng/g, 'Le Van Hoang')
        .replace(/Trần Quốc Bảo/g, 'Tran Quoc Bao');
}

export function translateGroupLabel(groupCode, lang = 'vi') {
    return lang === 'en' ? `Group ${groupCode}` : `Nhóm ${groupCode}`;
}
