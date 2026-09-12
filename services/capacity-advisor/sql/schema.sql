-- ==============================================================================
-- Capacity Advisor Database Schema (edupulse_advisor)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS advisor_decisions (
    id               SERIAL PRIMARY KEY,
    timestamp        TIMESTAMPTZ DEFAULT NOW(),
    avg_latency      DOUBLE PRECISION,
    error_rate       DOUBLE PRECISION,
    instant_gradient DOUBLE PRECISION,
    trend_slope      DOUBLE PRECISION,
    action           TEXT,
    old_batch_size   INTEGER,
    new_batch_size   INTEGER,
    reason           TEXT
);

-- Index on timestamp for performant time-series and recent decision lookups
CREATE INDEX IF NOT EXISTS idx_advisor_decisions_timestamp 
ON advisor_decisions (timestamp DESC);
