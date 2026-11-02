// scripts/setup-waiting-room.js
// Utility to set up a specific Virtual Waiting Room state for Live Demo
// Scenario: 50 active tokens + 3 students waiting in queue (#1, #2, #3)
// When demo student registers via UI, they become #4 in queue!
// Automatically waits for demo student to click 'Đăng ký', then advances queue real-time!

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3002';
const COURSE_ID = process.argv[2] || 'CS501';
const DRAIN_INTERVAL_MS = parseInt(process.argv[3] || process.env.DRAIN_INTERVAL_MS || '1200');

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function setupWaitingRoom() {
    console.log(`🚀 ========================================================`);
    console.log(`🚀 EduPulse Traffic Gateway — Virtual Waiting Room Live Demo`);
    console.log(`🚀 Target Course: ${COURSE_ID}`);
    console.log(`🚀 Gateway URL:   ${GATEWAY_URL}`);
    console.log(`🚀 Advance Speed: 1 slot released every ${DRAIN_INTERVAL_MS / 1000}s`);
    console.log(`🚀 ========================================================\n`);

    try {
        // 1. Reset Redis queue & unregister demo student 52000001
        console.log('1. Đang dọn dẹp hàng đợi Redis & reset môn học...');
        await fetch(`${GATEWAY_URL}/api/queue/reset`, { method: 'POST' });
        await fetch(`${GATEWAY_URL}/api/unregister`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: '52000001' })
        }).catch(() => {});
        console.log('✅ Hệ thống đã sạch sẽ, sinh viên 52000001 sẵn sàng đăng ký mới.\n');

        // 2. Tạo 50 active tokens để lấp đầy batch size (50/50)
        console.log('2. Đang tạo 50 sinh viên ACTIVE để lấp đầy công suất (50/50)...');
        const activeStudents = [];
        for (let i = 1; i <= 50; i++) {
            const studentId = `SV_ACTIVE_${String(i).padStart(3, '0')}`;
            const joinRes = await fetch(`${GATEWAY_URL}/api/queue/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentId, courseId: COURSE_ID }),
            });
            const joinData = await joinRes.json();
            if (joinData.ticketId && (joinData.directAdmission || joinData.status === 'PENDING_ENTRY' || joinData.status === 'ACTIVE')) {
                await fetch(`${GATEWAY_URL}/api/session/enter`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ticketId: joinData.ticketId }),
                });
                activeStudents.push({ studentId, ticketId: joinData.ticketId });
            }
        }
        console.log(`✅ Đã lấp đầy ${activeStudents.length} active tokens trong server.\n`);

        // 3. Xếp hàng 3 sinh viên chờ sẵn (#1, #2, #3)
        console.log('3. Đang đưa 3 sinh viên chờ sẵn vào hàng đợi (#1, #2, #3)...');
        let thirdTicketId = null;
        for (let i = 1; i <= 3; i++) {
            const studentId = `SV_WAITING_${i}`;
            const joinRes = await fetch(`${GATEWAY_URL}/api/queue/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentId, courseId: COURSE_ID }),
            });
            const joinData = await joinRes.json();
            if (i === 3) thirdTicketId = joinData.ticketId;
            console.log(`   - Sinh viên ${studentId}: Vị trí #${joinData.position || 'N/A'}`);
        }
        console.log(`✅ Hàng đợi hiện có 3 người (#1, #2, #3).\n`);

        console.log(`🎉 ========================================================`);
        console.log(`🎉 SETUP HOÀN TẤT! HỆ THỐNG ĐANG CHỜ BẠN THAO TÁC TRÊN WEB:`);
        console.log(`👉 Mở web (http://localhost:3000), tích chọn [CS501] và bấm [Đăng ký]!`);
        console.log(`👉 Bạn sẽ lập tức thấy badge vàng: HÀNG ĐỢI #4`);
        console.log(`🎉 ========================================================\n`);

        // 4. LẮNG NGHE CHO ĐẾN KHI SINH VIÊN BẤM ĐĂNG KÝ TRÊN WEB (Queue length >= 4)
        console.log(`⏳ Đang lắng nghe... Hàng đợi đang giữ nguyên ở vị trí #3 (bạn có thể thong thả bấm khi sẵn sàng)...`);
        let hasJoined = false;
        let waitSeconds = 0;

        while (!hasJoined && waitSeconds < 120) {
            await sleep(500);
            waitSeconds += 0.5;

            if (thirdTicketId) {
                try {
                    const statusRes = await fetch(`${GATEWAY_URL}/api/queue/status/${thirdTicketId}?courseId=${COURSE_ID}`);
                    if (statusRes.ok) {
                        const statusData = await statusRes.json();
                        if (statusData.totalInQueue >= 4) {
                            hasJoined = true;
                            console.log(`\n🚀 [PHÁT HIỆN] Sinh viên trên web đã bấm Đăng ký và vào Hàng đợi #4!`);
                            console.log(`⚡ Bắt đầu đếm lùi và nhả slot (mỗi ${DRAIN_INTERVAL_MS / 1000}s)...`);
                            break;
                        }
                    }
                } catch {
                    // ignore transient network poll errors
                }
            }
        }

        if (!hasJoined) {
            console.log(`⏱️ Hết thời gian chờ 2 phút mà chưa thấy bấm. Tự động xả hàng đợi...`);
        }

        // Đợi 0.8s để mắt người kịp thấy rõ số #4 trước khi nhảy sang #3
        await sleep(800);

        // 5. Bắt đầu xả từng sinh viên active để hàng đợi nhảy: #4 -> #3 -> #2 -> #1 -> Đã đăng ký!
        let drainIndex = 0;
        const maxDrains = 6; // Chỉ cần xả 5-6 người là demo student đã hoàn tất đăng ký
        const interval = setInterval(async () => {
            if (drainIndex >= activeStudents.length || drainIndex >= maxDrains) {
                console.log('\n🏁 [HOÀN TẤT DEMO] Sinh viên trên web đã được cấp slot và đăng ký thành công!');
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
                    console.log(`⚡ [Slot giải phóng #${drainIndex}] ${activeUser.studentId} hoàn tất -> Hàng đợi nhảy tiếp!`);
                }
            } catch (err) {
                console.error(`Lỗi khi nhả slot active student:`, err.message);
            }
        }, DRAIN_INTERVAL_MS);

    } catch (err) {
        console.error('❌ Setup thất bại:', err.message);
    }
}

setupWaitingRoom();
