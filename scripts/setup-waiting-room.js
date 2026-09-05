// scripts/setup-waiting-room.js
// Utility to set up a specific Virtual Waiting Room state for Live Demo
// Scenario: 50 active tokens + 3 students waiting in queue (#1, #2, #3)
// When demo student registers via UI, they become #4 in queue!
// Automatically simulates active students finishing registration every 3s to advance the queue real-time!

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3002';
const COURSE_ID = process.argv[2] || 'CS501';
const DRAIN_INTERVAL_MS = parseInt(process.env.DRAIN_INTERVAL_MS || '3000');

async function setupWaitingRoom() {
    console.log(`\n======================================================`);
    console.log(`🚀 EduPulse Traffic Gateway — Virtual Waiting Room Setup`);
    console.log(`Target Course: ${COURSE_ID}`);
    console.log(`Gateway URL: ${GATEWAY_URL}`);
    console.log(`Auto-Drain Speed: 1 active student finished every ${DRAIN_INTERVAL_MS / 1000}s`);
    console.log(`======================================================\n`);

    try {
        // First reset queue state if needed
        console.log('1. Resetting previous Redis queue state...');
        await fetch(`${GATEWAY_URL}/api/queue/reset`, { method: 'POST' });
        console.log('✅ Queue reset clean.\n');

        const activeStudents = [];
        console.log('2. Creating 50 ACTIVE students to fill batch capacity (50/50)...');
        for (let i = 1; i <= 50; i++) {
            const studentId = `SV_ACTIVE_${String(i).padStart(3, '0')}`;
            const joinRes = await fetch(`${GATEWAY_URL}/api/queue/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentId, courseId: COURSE_ID }),
            });
            const joinData = await joinRes.json();
            if (joinData.ticketId && (joinData.directAdmission || joinData.status === 'PENDING_ENTRY')) {
                await fetch(`${GATEWAY_URL}/api/session/enter`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ticketId: joinData.ticketId }),
                });
                activeStudents.push({ studentId, ticketId: joinData.ticketId });
            }
        }
        console.log(`✅ 50 active tokens successfully occupied (${activeStudents.length} active).\n`);

        console.log('3. Enqueuing 3 WAITING students (#1, #2, #3 in queue)...');
        for (let i = 1; i <= 3; i++) {
            const studentId = `SV_WAITING_${i}`;
            const joinRes = await fetch(`${GATEWAY_URL}/api/queue/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentId, courseId: COURSE_ID }),
            });
            const joinData = await joinRes.json();
            console.log(`   - Student ${studentId}: Position #${joinData.position || 'N/A'}, status: ${joinData.status}`);
        }

        console.log('\n======================================================');
        console.log(`🎉 SETUP COMPLETE!`);
        console.log(`Now go to UI (http://localhost:3000) and click 'Đăng ký' for ${COURSE_ID}.`);
        console.log(`You will see: 🟡 Hàng đợi #4 -> #3 -> #2 -> #1 -> 🟢 Đã đăng ký!`);
        console.log(`Starting real-time queue drain loop (1 active student registers every ${DRAIN_INTERVAL_MS / 1000}s)...`);
        console.log(`======================================================\n`);

        let drainIndex = 0;
        const interval = setInterval(async () => {
            if (drainIndex >= activeStudents.length) {
                console.log('🏁 All active students processed. Queue draining complete.');
                clearInterval(interval);
                return;
            }

            const activeUser = activeStudents[drainIndex++];
            try {
                const regRes = await fetch(`${GATEWAY_URL}/api/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        studentId: activeUser.studentId,
                        courseId: COURSE_ID,
                        ticketId: activeUser.ticketId,
                    }),
                });
                if (regRes.ok) {
                    console.log(`⚡ [Simulated Active Student] ${activeUser.studentId} registered -> Slot released! Queue advancing...`);
                }
            } catch (err) {
                console.error(`Error registering active student ${activeUser.studentId}:`, err.message);
            }
        }, DRAIN_INTERVAL_MS);

    } catch (err) {
        console.error('❌ Setup failed:', err.message);
    }
}

setupWaitingRoom();
