import http from 'k6/http';
import { check, sleep } from 'k6';

// ============================================
// Scenario A: Direct attack on Mock Backend
// (NO Gateway protection)
// Expected: backend will crash/lag heavily
// ============================================

export const options = {
    scenarios: {
        burst_traffic: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '10s', target: 100 },   // ramp up
                { duration: '30s', target: 500 },   // burst
                { duration: '60s', target: 1000 },  // peak load
                { duration: '10s', target: 0 },     // ramp down
            ],
        },
    },
    thresholds: {
        http_req_duration: ['p(95)<5000'],
        http_req_failed: ['rate<0.5'],
    },
};

const MOCK_BACKEND_URL = __ENV.MOCK_URL || 'http://localhost:3010';

export default function () {
    const studentId = `SV${Math.floor(Math.random() * 100000)}`;
    const courseId = ['CS101', 'CS201', 'CS301', 'CS401', 'CS501'][Math.floor(Math.random() * 5)];

    const res = http.post(`${MOCK_BACKEND_URL}/api/register`, JSON.stringify({
        studentId,
        courseId,
    }), {
        headers: { 'Content-Type': 'application/json' },
    });

    check(res, {
        'status is 201 or 409': (r) => r.status === 201 || r.status === 409,
        'response time < 2s': (r) => r.timings.duration < 2000,
    });

    sleep(0.1);
}
