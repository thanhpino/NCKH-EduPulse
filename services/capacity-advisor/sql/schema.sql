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

-- Ensure all columns exist for auto-migration if table was created in an earlier build
ALTER TABLE advisor_decisions ADD COLUMN IF NOT EXISTS instant_gradient DOUBLE PRECISION;
ALTER TABLE advisor_decisions ADD COLUMN IF NOT EXISTS trend_slope DOUBLE PRECISION;
ALTER TABLE advisor_decisions ADD COLUMN IF NOT EXISTS old_batch_size INTEGER;
ALTER TABLE advisor_decisions ADD COLUMN IF NOT EXISTS new_batch_size INTEGER;

-- Index on timestamp for performant time-series and recent decision lookups
CREATE INDEX IF NOT EXISTS idx_advisor_decisions_timestamp 
ON advisor_decisions (timestamp DESC);
