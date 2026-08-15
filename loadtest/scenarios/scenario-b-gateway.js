import http from 'k6/http';
import { check, sleep } from 'k6';

// ============================================
// Scenario B: Traffic through Gateway
// (WITH Virtual Waiting Room protection)
// Expected: backend stays healthy, users see queue
// ============================================

export const options = {
    scenarios: {
        burst_traffic: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '10s', target: 100 },
                { duration: '30s', target: 500 },
                { duration: '60s', target: 1000 },
                { duration: '10s', target: 0 },
            ],
        },
    },
    thresholds: {
        http_req_duration: ['p(95)<5000'],
        http_req_failed: ['rate<0.1'],  // Much lower threshold — gateway should absorb load
    },
};

const GATEWAY_URL = __ENV.GATEWAY_URL || 'http://localhost:3002';

export default function () {
    // Step 1: Join the queue
    const joinRes = http.post(`${GATEWAY_URL}/api/queue/join`, JSON.stringify({}), {
        headers: { 'Content-Type': 'application/json' },
    });

    check(joinRes, {
        'got ticket': (r) => r.status === 201,
        'has position': (r) => JSON.parse(r.body).position > 0,
    });

    if (joinRes.status !== 201) return;

    const ticket = JSON.parse(joinRes.body);

    // Step 2: Poll for admission
    let admitted = false;
    for (let i = 0; i < 10; i++) {
        sleep(1);
        const statusRes = http.get(`${GATEWAY_URL}/api/queue/status/${ticket.ticketId}`);

        if (statusRes.status === 200) {
            const data = JSON.parse(statusRes.body);
            if (data.status === 'admitted') {
                admitted = true;
                break;
            }
        }
    }

    check(null, {
        'eventually admitted': () => admitted,
    });
}
