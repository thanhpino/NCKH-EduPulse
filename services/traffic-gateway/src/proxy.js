// services/traffic-gateway/src/proxy.js

const config = require('./config');

module.exports = (logger) => {

    /**
     * Forward registration request đến Mock Backend
     * @param {string} studentId
     * @param {string} courseId
     * @param {string} ticketId - idempotency key
     *
     */
    async function forwardRegistration(studentId, courseId, ticketId) {
        const url = `${config.MOCK_BACKEND_URL}/api/register`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Idempotency-Key': ticketId, // Mock Backend support this header
                },
                body: JSON.stringify({ studentId, courseId, ticketId }),
                signal: AbortSignal.timeout(5000), // 5s timeout
            });

            const data = await response.json();

            if (!response.ok) {
                logger.warn(`Registration failed for ${studentId}/${courseId}: ${response.status} ${JSON.stringify(data)}`);
                return {
                    success: false,
                    status: response.status,
                    error: data.error || 'Registration failed',
                };
            }

            logger.info(`Registration success for ${studentId}/${courseId} (ticket: ${ticketId})`);
            return { success: true, status: response.status, data };

        } catch (err) {
            // Distinct timeout vs connection error
            if (err.name === 'TimeoutError' || err.name === 'AbortError') {
                logger.error(`Registration timeout for ${studentId}/${courseId}`);
                return { success: false, status: 504, error: 'Mock Backend timeout' };
            }
            logger.error(`Registration error for ${studentId}/${courseId}:`, err.message);
            return { success: false, status: 502, error: 'Mock Backend unreachable' };
        }
    }

    return { forwardRegistration };
};