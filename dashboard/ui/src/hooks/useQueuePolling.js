import { useState, useEffect, useRef } from 'react';

const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:3002';
const POLL_INTERVAL = 1500;

/**
 * Custom hook — poll trạng thái hàng đợi + tự động advance qua các bước:
 *   waiting → PENDING_ENTRY → /api/session/enter → ACTIVE → /api/register → DONE
 *   Nếu server trả về course_full → dừng ngay, callback báo về UI hiện popup.
 *
 * @param {string|null} ticketId      - ID vé từ /api/queue/join
 * @param {string}      courseId      - Mã môn học
 * @param {string}      studentId     - MSSV (dùng khi gọi /api/register)
 * @param {string|null} initialStatus - Trạng thái ban đầu
 * @param {function}    onStatusChange- Callback báo về Register page khi status thay đổi
 */
export function useQueuePolling(ticketId, courseId, studentId, initialStatus, onStatusChange) {
    const [status, setStatus] = useState(initialStatus ?? null);
    const [position, setPosition] = useState(null);
    const [eta, setEta] = useState(null);
    const intervalRef = useRef(null);
    const processingRef = useRef(false);

    // Sync initialStatus when changed from outside (e.g. MongoDB fetch or unregistration)
    useEffect(() => {
        setStatus(initialStatus ?? null);
        if (!initialStatus) {
            setPosition(null);
            setEta(null);
        }
    }, [initialStatus]);

    useEffect(() => {
        if (!ticketId || status === 'DONE' || status === 'course_full') return;

        async function checkAndAdvance() {
            try {
                const res = await fetch(
                    `${GATEWAY_URL}/api/queue/status/${ticketId}?courseId=${courseId}`
                );
                if (!res.ok) throw new Error(`Poll failed: ${res.status}`);
                const data = await res.json();

                // COURSE FULL — stop polling immediately, notify parent to show popup
                if (data.status === 'course_full') {
                    clearInterval(intervalRef.current);
                    setStatus('course_full');
                    setPosition(null);
                    setEta(null);
                    onStatusChange?.(courseId, 'course_full');
                    return;
                }

                setPosition(data.position ?? null);
                setEta(data.estimatedWaitSeconds ?? null);

                // PENDING_ENTRY → gọi /api/session/enter để nhận token ACTIVE
                if (data.status === 'PENDING_ENTRY' && !processingRef.current) {
                    processingRef.current = true;
                    const enterRes = await fetch(`${GATEWAY_URL}/api/session/enter`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ticketId }),
                    });
                    if (enterRes.ok) {
                        setStatus('ACTIVE');
                        onStatusChange?.(courseId, 'ACTIVE');
                    }
                    processingRef.current = false;
                    return;
                }

                // ACTIVE → gọi /api/register vào mock-backend thật
                if (data.status === 'ACTIVE' && !processingRef.current) {
                    processingRef.current = true;
                    const regRes = await fetch(`${GATEWAY_URL}/api/register`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ studentId, courseId, ticketId }),
                    });
                    if (regRes.ok) {
                        setStatus('DONE');
                        onStatusChange?.(courseId, 'DONE');
                        clearInterval(intervalRef.current);
                    } else {
                        const errData = await regRes.json().catch(() => ({}));
                        // Handle course full at registration time (race condition edge case)
                        if (regRes.status === 409 || errData?.error?.includes('full')) {
                            clearInterval(intervalRef.current);
                            setStatus('course_full');
                            onStatusChange?.(courseId, 'course_full');
                        } else {
                            console.error(`[useQueuePolling] register failed for ${courseId}: ${regRes.status}`);
                        }
                    }
                    processingRef.current = false;
                    return;
                }

                setStatus(data.status);
                onStatusChange?.(courseId, data.status);
            } catch (err) {
                console.error(`[useQueuePolling] ${courseId}:`, err.message);
            }
        }

        intervalRef.current = setInterval(checkAndAdvance, POLL_INTERVAL);
        return () => clearInterval(intervalRef.current);
    }, [ticketId, courseId, studentId, status]);

    return { status, position, eta };
}
