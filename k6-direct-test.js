// k6-direct-test.js
// EduPulse Load Test — DIRECT to Mock Backend (NO Traffic Gateway)
// dùng để chứng minh hệ thống SẬP khi KHÔNG có Traffic Gateway & Virtual Queue

import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const directRegisterLatency = new Trend('direct_backend_latency');
const directErrorCounter = new Counter('direct_backend_errors');
const directSuccessCounter = new Counter('direct_backend_success');

export const options = {
    scenarios: {
        concurrency_spike: {
            executor: 'ramping-vus',
            startVUs: 10,
            stages: [
                { duration: '3s', target: 1000 },
                { duration: '5s', target: 1000 },
            ],
            gracefulRampDown: '1s',
        },
    },
    thresholds: {
        http_req_failed: ['rate<0.05'],    // Tỷ lệ lỗi kỳ vọng (nhưng sẽ tạch khi không có Gateway)
        http_req_duration: ['p(95)<500'],  // p95 latency kỳ vọng (sẽ tạch khi không có Gateway)
    },
};

const BACKEND_URL = __ENV.BACKEND_URL || 'http://localhost:3010';
const COURSES = [
    'CS101', 'CS102', 'CS201', 'CS202', 'CS301', 'CS302',
    'CS401', 'CS402', 'CS501', 'CS502', 'CS601', 'CS602',
    'CS701', 'CS702', 'CS801', 'CS802', 'CS901', 'CS902',
    'CS1001', 'CS1002', 'CS1101', 'CS1102', 'CS1201', 'CS1202', 'CS1203'
];

export default function () {
    const studentId = `DIRECT_SV_${__VU}_${__ITER}_${Date.now()}`;
    const courseId = __ENV.TARGET_COURSE || COURSES[(__VU + __ITER) % COURSES.length];

    const regPayload = JSON.stringify({ studentId, courseId });
    const params = { headers: { 'Content-Type': 'application/json' } };

    const startTime = Date.now();
    // Bắn THẲNG vào Mock Backend bypass Gateway
    const res = http.post(`${BACKEND_URL}/api/register`, regPayload, params);
    const duration = Date.now() - startTime;

    directRegisterLatency.add(duration);

    if (res.status === 201) {
        directSuccessCounter.add(1);
    } else {
        directErrorCounter.add(1);
    }

    check(res, {
        'status is 201': (r) => r.status === 201,
    });
}
