// k6-stress-test.js
// EduPulse Load & Stress Testing Script for Traffic Gateway

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Custom Metrics cho báo cáo khóa luận
const directAdmittedCounter = new Counter('direct_admitted_students');
const waitingQueueCounter = new Counter('waiting_queue_students');
const joinLatency = new Trend('join_queue_latency');
const registerSuccessCounter = new Counter('register_success');

export const options = {
    scenarios: {
        // Kịch bản: Spike 1000 Virtual Users trong 3 giây trên tất cả các môn học mở lớp
        concurrency_spike: {
            executor: 'ramping-vus',
            startVUs: 10,
            stages: [
                { duration: '3s', target: 1000 }, // Ramp-up lên 1000 VUs trong 3 giây
                { duration: '5s', target: 1000 }, // Giữ 1000 VUs trong 5 giây
            ],
            gracefulRampDown: '1s',
        },
    },
    thresholds: {
        http_req_failed: ['rate<0.05'],    // Tỷ lệ lỗi HTTP < 5%
        http_req_duration: ['p(95)<500'],  // 95% request phản hồi dưới 500ms
    },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3002';
const COURSES = [
    'CS101', 'CS102', 'CS201', 'CS202', 'CS301', 'CS302',
    'CS401', 'CS402', 'CS501', 'CS502', 'CS601', 'CS602',
    'CS701', 'CS702', 'CS801', 'CS802', 'CS901', 'CS902',
    'CS1001', 'CS1002', 'CS1101', 'CS1102', 'CS1201', 'CS1202', 'CS1203'
];

export default function () {
    const studentId = `SV_${__VU}_${__ITER}_${Date.now()}`;
    // Phân bổ ngẫu nhiên hoặc chọn môn qua ENV: TARGET_COURSE=CS501 k6 run k6-stress-test.js
    const courseId = __ENV.TARGET_COURSE || COURSES[(__VU + __ITER) % COURSES.length];

    // 1. Send /api/queue/join request
    const joinPayload = JSON.stringify({ studentId, courseId });
    const params = { headers: { 'Content-Type': 'application/json' } };

    const startTime = Date.now();
    const res = http.post(`${BASE_URL}/api/queue/join`, joinPayload, params);
    const duration = Date.now() - startTime;

    joinLatency.add(duration);

    // Check status 201 Created
    const passed = check(res, {
        'status is 201': (r) => r.status === 201,
    });

    if (res.status === 201) {
        const body = res.json();

        // 2. Count direct vs queue admission
        if (body.directAdmission === true || body.status === 'ACTIVE') {
            directAdmittedCounter.add(1);

            // Directly register if ACTIVE token is granted immediately
            if (body.ticketId) {
                const regPayload = JSON.stringify({
                    studentId,
                    courseId,
                    ticketId: body.ticketId,
                });
                const regRes = http.post(`${BASE_URL}/api/register`, regPayload, params);
                if (regRes.status === 200) {
                    registerSuccessCounter.add(1);
                }
            }
        } else if (body.position) {
            waitingQueueCounter.add(1);
        }
    }
}
