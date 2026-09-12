// services/traffic-gateway/src/admission.js

const config = require('./config');
const { TOKEN_STATUS } = config;

module.exports = (redis, queue, token, logger = console) => {

    let intervalHandle = null;
    let currentBatchSize = config.BATCH_SIZE; // Capacity Advisor fix run time

    async function admitBatch(courseId) {
        // Cleanup active set first — mandatory, otherwise stuck (bug mentioned earlier)
        await token.cleanupExpired(courseId);

        const activeCount = await token.getActiveCount(courseId); // Redis, NOT using in-memory Map
        const slotsAvailable = currentBatchSize - activeCount;

        if (slotsAvailable <= 0) return { courseId, admitted: [] };

        const candidates = await queue.getNextBatch(courseId, slotsAvailable);
        if (candidates.length === 0) return { courseId, admitted: [] };

        const admitted = [];
        for (const ticketId of candidates) {
            try {
                const admitRes = await token.atomicAdmit(ticketId, courseId, TOKEN_STATUS.PENDING_ENTRY);
                if (admitRes.admitted) {
                    await queue.dequeue(ticketId, courseId);
                    admitted.push(ticketId);
                } else {
                    // Capacity filled mid-batch
                    break;
                }
            } catch (err) {
                logger.error(`Failed to admit ${ticketId} for ${courseId}:`, err.message);
            }
        }

        if (admitted.length > 0) {
            logger.info(`Admitted ${admitted.length} for ${courseId} (active: ${activeCount + admitted.length}/${currentBatchSize})`);
        }

        return { courseId, admitted };
    }

    async function admitAllCourses() {
        const activeCourses = await redis.smembers(config.COURSES_SET_KEY);
        for (const courseId of activeCourses) {
            try {
                await admitBatch(courseId);
            } catch (err) {
                logger.error(`Error processing ${courseId}:`, err.message);
            }
        }
    }

    // Called when student clicks "enter" — chuyển PENDING_ENTRY → ACTIVE
    async function enterSession(ticketId) {
        return await token.activateToken(ticketId); // return null if expired PENDING_ENTRY
    }

    // Heartbeat — only extend if token is in ACTIVE state (check in token.js, not here)
    async function heartbeat(ticketId) {
        const updatedToken = await token.heartbeat(ticketId);
        return updatedToken ? { ok: true } : { ok: false, error: 'Session not active or expired' };
    }

    function startAdmissionLoop() {
        if (intervalHandle) return;
        intervalHandle = setInterval(async () => {
            try {
                await admitAllCourses();
            } catch (err) {
                logger.error('Admission loop error:', err);
            }
        }, config.ADMISSION_INTERVAL);
        logger.info(`Admission loop started (every ${config.ADMISSION_INTERVAL}ms)`);
    }

    function stopAdmissionLoop() {
        if (intervalHandle) {
            clearInterval(intervalHandle);
            intervalHandle = null;
        }
    }

    function setBatchSize(newSize) {
        if (newSize < 1) throw new Error('Batch size must be >= 1');
        logger.info(`Batch size changed: ${currentBatchSize} → ${newSize}`);
        currentBatchSize = newSize;
    }

    return {
        admitBatch,
        admitAllCourses,
        enterSession,
        heartbeat,
        startAdmissionLoop,
        stopAdmissionLoop,
        setBatchSize,
        getBatchSize: () => currentBatchSize,
    };
};