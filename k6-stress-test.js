// k6-stress-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Định nghĩa Custom Metrics cho báo cáo khóa luận
const directAdmittedCounter = new Counter('direct_admitted_students');
const waitingQueueCounter = new Counter('waiting_queue_students');
const joinLatency = new Trend('join_queue_latency');

export const options = {
    scenarios: {
        concurrency_spike: {
            executor: 'ramping-vus',
            startVUs: 10,
            stages: [
                { duration: '3s', target: 1000 }, // Ramping up to 1000 VUs over 3 seconds
                { duration: '5s', target: 1000 }, // Hold 1000 VUs for 5 seconds
            ],
            gracefulRampDown: '0s',
        },
    },
    thresholds: {
        http_req_failed: ['rate<0.05'], // Tỷ lệ lỗi HTTP < 5%
        http_req_duration: ['p(95)<500'], // 95% request phản hồi dưới 500ms
    },
};

export default function () {
    const url = 'http://localhost:3002/api/queue/join';
    const payload = JSON.stringify({
        studentId: `SV_${__VU}_${Date.now()}`,
        courseId: 'CS101',
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
        },
    };

    const res = http.post(url, payload, params);

    // Record response time
    joinLatency.add(res.timings.duration);

    // Check status 201 Created
    check(res, {
        'status is 201': (r) => r.status === 201,
    });

    if (res.status === 201) {
        const body = res.json();
        if (body.admitted === true) {
            directAdmittedCounter.add(1);
        } else if (body.position) {
            waitingQueueCounter.add(1);
        }

    }
}
