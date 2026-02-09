-- ============================================================
-- MISIR SCHEMA v1.1 MIGRATION — Assignment Margin Support
-- CORRECTED VERSION
-- ============================================================
-- Version: 1.1.0
-- Date: February 2026
-- Purpose: Add Assignment Margin to prevent centroid pollution
-- from ambiguous signals
-- ============================================================

BEGIN;

-- ============================================================
-- PART 1: Schema Changes
-- ============================================================

ALTER TABLE misir.signal
ADD COLUMN IF NOT EXISTS margin FLOAT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS updates_centroid BOOLEAN NOT NULL DEFAULT TRUE;

INSERT INTO misir.system_config (key, value, description)
VALUES (
    'assignment_margin_threshold',
    '0.1',
    'Minimum margin (d2-d1) for a signal to update centroid. Lower = more restrictive.'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_signal_updates_centroid
ON misir.signal (subspace_id, updates_centroid)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_signal_margin
ON misir.signal (margin)
WHERE margin IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_signal_subspace_margin
ON misir.signal (subspace_id, margin DESC)
WHERE margin IS NOT NULL AND deleted_at IS NULL;

-- ============================================================
-- PART 2: Modified Trigger Function (CORRECTED)
-- ============================================================

DROP FUNCTION IF EXISTS misir.update_subspace_centroid() CASCADE;

CREATE OR REPLACE FUNCTION misir.update_subspace_centroid()
RETURNS TRIGGER AS $$
DECLARE
    v_subspace_id BIGINT;
    v_new_centroid vector(768);
    v_old_centroid vector(768);
    v_learning_rate FLOAT;
    v_distance_threshold FLOAT := 0.05;
    v_min_signals_between_logs INTEGER := 5;
    v_signals_since_last_log INTEGER;
    v_centroid_distance FLOAT;
    v_total_signal_count INTEGER;
    v_centroid_signal_count INTEGER;
BEGIN
    v_subspace_id := NEW.subspace_id;
    
    -- CRITICAL: Skip centroid update if signal has low margin
    IF NEW.updates_centroid = FALSE THEN
        RAISE NOTICE 'Skipping centroid update for subspace %: signal margin too low (ambiguous assignment)', v_subspace_id;
        RETURN NEW;
    END IF;
    
    -- Load config
    BEGIN
        SELECT 
            (value->>'distance_threshold')::FLOAT,
            (value->>'min_signals_between_logs')::INTEGER
        INTO 
            v_distance_threshold,
            v_min_signals_between_logs
        FROM misir.system_config
        WHERE key = 'centroid_history_threshold';
    EXCEPTION
        WHEN OTHERS THEN
            v_distance_threshold := 0.05;
            v_min_signals_between_logs := 5;
    END;
    
    -- Get learning rate
    SELECT learning_rate, centroid_embedding 
    INTO v_learning_rate, v_old_centroid
    FROM misir.subspace
    WHERE id = v_subspace_id;
    
    IF v_learning_rate IS NULL THEN
        v_learning_rate := 0.1;
    END IF;
    
    -- Count signals (two types)
    -- Total signals (for history logging)
    SELECT COUNT(*) INTO v_total_signal_count
    FROM misir.signal
    WHERE subspace_id = v_subspace_id AND deleted_at IS NULL;
    
    -- Centroid-updating signals (for confidence)
    SELECT COUNT(*) INTO v_centroid_signal_count
    FROM misir.signal
    WHERE subspace_id = v_subspace_id 
      AND updates_centroid = TRUE
      AND deleted_at IS NULL;
    
    -- Calculate new centroid using EMA (CORRECTED VECTOR ARITHMETIC)
    IF v_old_centroid IS NULL OR v_centroid_signal_count = 1 THEN
        v_new_centroid := NEW.vector;
    ELSE
        -- CRITICAL FIX: Use element-wise computation (pgvector doesn't support scalar * vector)
        v_new_centroid := (
            SELECT ARRAY_AGG(
                (1 - v_learning_rate) * v_old_centroid[i] + v_learning_rate * NEW.vector[i]
            )::vector(768)
            FROM generate_series(1, 768) AS i
        );
    END IF;
    
    -- Update subspace (CORRECTED: Use DISTINCT artifact count)
    UPDATE misir.subspace
    SET centroid_embedding = v_new_centroid,
        centroid_updated_at = NOW(),
        artifact_count = (
            SELECT COUNT(DISTINCT artifact_id)
            FROM misir.signal
            WHERE subspace_id = v_subspace_id AND deleted_at IS NULL
        ),
        confidence = LEAST(1.0, v_centroid_signal_count::FLOAT / 20.0)
    WHERE id = v_subspace_id;
    
    -- Calculate distance moved
    IF v_old_centroid IS NOT NULL THEN
        v_centroid_distance := 1 - (v_new_centroid <=> v_old_centroid);
    ELSE
        v_centroid_distance := 1.0;
    END IF;
    
    -- Count centroid-updating signals since last log
    SELECT COUNT(*) INTO v_signals_since_last_log
    FROM misir.signal s
    WHERE s.subspace_id = v_subspace_id
      AND s.updates_centroid = TRUE
      AND s.deleted_at IS NULL
      AND s.created_at > COALESCE(
          (SELECT MAX(computed_at) FROM misir.subspace_centroid_history 
           WHERE subspace_id = v_subspace_id),
          '1970-01-01'::TIMESTAMPTZ
      );
    
    -- Log to history (use total signal count, not just centroid-updating)
    IF v_centroid_distance >= v_distance_threshold 
       OR v_signals_since_last_log >= v_min_signals_between_logs THEN
        INSERT INTO misir.subspace_centroid_history (
            subspace_id, centroid_embedding, artifact_count, signal_count, confidence, computed_at
        ) VALUES (
            v_subspace_id, 
            v_new_centroid, 
            (SELECT COUNT(DISTINCT artifact_id) FROM misir.signal WHERE subspace_id = v_subspace_id AND deleted_at IS NULL),
            v_total_signal_count,  -- Use total, not just centroid-updating
            LEAST(1.0, v_centroid_signal_count::FLOAT / 20.0), 
            NOW()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = misir, pg_catalog, public;

-- Recreate trigger
CREATE TRIGGER signal_update_centroid
    AFTER INSERT ON misir.signal
    FOR EACH ROW
    WHEN (NEW.subspace_id IS NOT NULL AND NEW.deleted_at IS NULL)
    EXECUTE FUNCTION misir.update_subspace_centroid();

-- ============================================================
-- PART 3: Optimized Helper Function
-- ============================================================

CREATE OR REPLACE FUNCTION misir.calculate_assignment_margin(
    p_signal_vector vector(768),
    p_user_id UUID,
    p_space_id BIGINT
)
RETURNS TABLE(
    nearest_subspace_id BIGINT,
    nearest_distance FLOAT,
    second_distance FLOAT,
    margin FLOAT,
    updates_centroid BOOLEAN
) AS $$
DECLARE
    v_threshold FLOAT;
BEGIN
    -- Get margin threshold from config
    SELECT COALESCE((value)::FLOAT, 0.1)
    INTO v_threshold
    FROM misir.system_config
    WHERE key = 'assignment_margin_threshold';
    
    IF v_threshold IS NULL THEN
        v_threshold := 0.1;
    END IF;

    RETURN QUERY
    WITH top_2_subspaces AS (
        -- OPTIMIZATION: LIMIT 2 instead of ROW_NUMBER() over all subspaces
        SELECT 
            s.id,
            (s.centroid_embedding <=> p_signal_vector) AS distance
        FROM misir.subspace s
        WHERE s.user_id = p_user_id
          AND s.space_id = p_space_id
          AND s.centroid_embedding IS NOT NULL
        ORDER BY s.centroid_embedding <=> p_signal_vector
        LIMIT 2
    ),
    nearest AS (
        SELECT id, distance FROM top_2_subspaces ORDER BY distance LIMIT 1
    ),
    second AS (
        SELECT distance FROM top_2_subspaces ORDER BY distance OFFSET 1 LIMIT 1
    )
    SELECT 
        n.id,
        n.distance,
        COALESCE(s.distance, 1.0),
        COALESCE(s.distance, 1.0) - n.distance,
        (COALESCE(s.distance, 1.0) - n.distance) >= v_threshold
    FROM nearest n
    LEFT JOIN second s ON true;
END;
$$ LANGUAGE plpgsql
SET search_path = misir, pg_catalog, public;

-- ============================================================
-- PART 4: Validation
-- ============================================================

DO $$
DECLARE
    v_margin_col BOOLEAN;
    v_updates_col BOOLEAN;
    v_config_exists BOOLEAN;
BEGIN
    -- Check columns
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'misir' AND table_name = 'signal' AND column_name = 'margin'
    ) INTO v_margin_col;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'misir' AND table_name = 'signal' AND column_name = 'updates_centroid'
    ) INTO v_updates_col;
    
    SELECT EXISTS (
        SELECT 1 FROM misir.system_config WHERE key = 'assignment_margin_threshold'
    ) INTO v_config_exists;
    
    IF NOT v_margin_col THEN
        RAISE EXCEPTION 'Column signal.margin not created';
    END IF;
    
    IF NOT v_updates_col THEN
        RAISE EXCEPTION 'Column signal.updates_centroid not created';
    END IF;
    
    IF NOT v_config_exists THEN
        RAISE EXCEPTION 'Config assignment_margin_threshold not created';
    END IF;
    
    RAISE NOTICE '=========================================';
    RAISE NOTICE '✓ v1.1 MIGRATION SUCCESSFUL';
    RAISE NOTICE '✓ Assignment Margin Implemented';
    RAISE NOTICE '=========================================';
END $$;

COMMIT;

-- ============================================================
-- POST-DEPLOYMENT MONITORING QUERIES
-- ============================================================

-- Query 1: Check margin distribution
-- SELECT 
--     CASE 
--         WHEN margin < 0.1 THEN 'ambiguous'
--         WHEN margin < 0.2 THEN 'low'
--         WHEN margin < 0.5 THEN 'medium'
--         ELSE 'high'
--     END AS margin_category,
--     COUNT(*) as signal_count,
--     ROUND(AVG(margin)::NUMERIC, 3) as avg_margin
-- FROM misir.signal
-- WHERE margin IS NOT NULL
-- GROUP BY margin_category
-- ORDER BY avg_margin;

-- Query 2: Centroid update rate
-- SELECT 
--     subspace_id,
--     COUNT(*) as total_signals,
--     SUM(CASE WHEN updates_centroid THEN 1 ELSE 0 END) as updated_centroid,
--     ROUND((SUM(CASE WHEN updates_centroid THEN 1 ELSE 0 END)::FLOAT / COUNT(*)) * 100, 1) as update_rate_percent
-- FROM misir.signal
-- WHERE created_at > NOW() - INTERVAL '7 days'
-- GROUP BY subspace_id
-- ORDER BY total_signals DESC
-- LIMIT 10;
