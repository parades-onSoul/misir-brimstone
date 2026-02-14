-- ============================================================
-- MISIR v1.5 Sensitivity Tuning
-- ============================================================
-- Purpose:
--   Lower early-stage assignment strictness so relevant captures
--   contribute to subspace progress sooner.
--
-- Safe to run multiple times.
-- ============================================================

BEGIN;

INSERT INTO misir.system_config (key, value, description)
VALUES (
    'assignment_margin_threshold',
    '0.05',
    'Minimum margin (d2-d1) for centroid updates. Tuned from 0.1 to 0.05 for early-stage spaces.'
)
ON CONFLICT (key) DO UPDATE
SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = NOW();

COMMIT;
