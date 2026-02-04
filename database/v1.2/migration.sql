-- Migration: v1.2 - SourceType Alignment
-- Purpose: Align content_source enum with backend SourceType
-- Date: February 4, 2026
--
-- Changes:
--   - Rename 'ai' -> 'chat' (AI Chat logs)
--   - Rename 'document' -> 'pdf' (PDFs)
--   - Add 'other' (fallback)
--   - Keep: web, video, note
--
-- WARNING: PostgreSQL does not support RENAME or DROP of enum values.
--          This migration recreates the enum type.

BEGIN;

-- ============================================================================
-- PART 1: Migrate engagement_level enum
-- ============================================================================

-- Step 1a: Create new engagement_level enum
CREATE TYPE misir.engagement_level_v2 AS ENUM (
    'latent',
    'discovered',
    'engaged',
    'saturated'
);

-- Step 1b: Drop default on engagement_level
ALTER TABLE misir.artifact 
    ALTER COLUMN engagement_level DROP DEFAULT;

-- Step 1c: Convert to text temporarily
ALTER TABLE misir.artifact 
    ALTER COLUMN engagement_level TYPE text 
    USING engagement_level::text;

-- Step 1d: Transform old values to new values
UPDATE misir.artifact SET engagement_level = 'latent' WHERE engagement_level = 'ambient';
UPDATE misir.artifact SET engagement_level = 'saturated' WHERE engagement_level = 'committed';
-- 'engaged' stays as 'engaged'

-- Step 1e: Convert to new enum
ALTER TABLE misir.artifact 
    ALTER COLUMN engagement_level TYPE misir.engagement_level_v2 
    USING engagement_level::misir.engagement_level_v2;

-- ============================================================================
-- PART 2: Migrate content_source enum
-- ============================================================================

-- Step 2a: Create new content_source enum
CREATE TYPE misir.content_source_v2 AS ENUM (
    'web',
    'pdf',
    'video',
    'chat',
    'note',
    'other'
);

-- Step 2b: Drop default on content_source
ALTER TABLE misir.artifact 
    ALTER COLUMN content_source DROP DEFAULT;

-- Step 2c: Update artifact table to use new enum
-- First, change column to text temporarily
ALTER TABLE misir.artifact 
    ALTER COLUMN content_source TYPE text 
    USING content_source::text;

-- Step 2d: Transform old values to new values
UPDATE misir.artifact SET content_source = 'chat' WHERE content_source = 'ai';
UPDATE misir.artifact SET content_source = 'pdf' WHERE content_source = 'document';

-- Step 2e: Convert column to new enum type
ALTER TABLE misir.artifact 
    ALTER COLUMN content_source TYPE misir.content_source_v2 
    USING content_source::misir.content_source_v2;

-- ============================================================================
-- PART 3: Drop old functions and enums
-- ============================================================================

-- Step 3a: Drop old RPC function that depends on old enums (MUST happen before DROP TYPE)
DROP FUNCTION IF EXISTS misir.insert_artifact_with_signal(uuid,bigint,text,vector,bigint,bigint,text,text,misir.engagement_level,misir.content_source,integer,double precision,double precision,integer,double precision,misir.signal_type,bigint[],timestamp with time zone) CASCADE;
DROP FUNCTION IF EXISTS misir.insert_artifact_with_signal(uuid,bigint,text,vector,bigint,bigint,text,text,misir.engagement_level,misir.content_source,integer,double precision,double precision,integer,double precision,misir.signal_type,bigint[],timestamp with time zone,double precision,boolean) CASCADE;

-- Step 3b: Drop old enum types (now safe)
DROP TYPE misir.engagement_level;
DROP TYPE misir.content_source;

-- Step 3c: Rename new enums to original names
ALTER TYPE misir.engagement_level_v2 RENAME TO engagement_level;
ALTER TYPE misir.content_source_v2 RENAME TO content_source;

-- Step 3d: Restore default constraints
ALTER TABLE misir.artifact 
    ALTER COLUMN engagement_level SET DEFAULT 'latent'::misir.engagement_level;

ALTER TABLE misir.artifact 
    ALTER COLUMN content_source SET DEFAULT 'web'::misir.content_source;

-- Step 8: Update RPC function signature (recreate with new enum)
-- Note: The function uses the enum type, so it needs to be recreated
-- after the enum is renamed.

DROP FUNCTION IF EXISTS misir.insert_artifact_with_signal CASCADE;

CREATE OR REPLACE FUNCTION misir.insert_artifact_with_signal(
    p_user_id uuid,
    p_space_id bigint,
    p_url text,
    p_embedding vector(768),
    p_subspace_id bigint DEFAULT NULL,
    p_session_id bigint DEFAULT NULL,
    p_title text DEFAULT NULL,
    p_content text DEFAULT NULL,
    p_engagement_level misir.engagement_level DEFAULT 'latent',
    p_content_source misir.content_source DEFAULT 'web',
    p_dwell_time_ms integer DEFAULT 0,
    p_scroll_depth double precision DEFAULT 0.0,
    p_reading_depth double precision DEFAULT 0.0,
    p_word_count integer DEFAULT 0,
    p_signal_magnitude double precision DEFAULT 1.0,
    p_signal_type misir.signal_type DEFAULT 'semantic',
    p_matched_marker_ids bigint[] DEFAULT ARRAY[]::bigint[],
    p_captured_at timestamp with time zone DEFAULT now(),
    -- v1.1 Assignment Margin
    p_margin double precision DEFAULT NULL,
    p_updates_centroid boolean DEFAULT true
)
RETURNS TABLE(artifact_id bigint, signal_id bigint, is_new boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = misir, public
AS $$
DECLARE
    v_artifact_id bigint;
    v_signal_id bigint;
    v_normalized_url text;
    v_domain text;
    v_is_new boolean := false;
    v_existing_level misir.engagement_level;
BEGIN
    -- Normalize URL (strip tracking params, lowercase)
    v_normalized_url := misir.normalize_url(p_url);
    v_domain := misir.extract_domain(p_url);
    
    -- Check for existing artifact (upsert logic)
    SELECT id, engagement_level INTO v_artifact_id, v_existing_level
    FROM misir.artifact
    WHERE user_id = p_user_id AND normalized_url = v_normalized_url;
    
    IF v_artifact_id IS NULL THEN
        -- INSERT new artifact
        v_is_new := true;
        
        INSERT INTO misir.artifact (
            user_id, space_id, subspace_id, session_id,
            url, normalized_url, domain,
            title, extracted_text, word_count,
            engagement_level, content_source,
            dwell_time_ms, scroll_depth, reading_depth,
            captured_at
        ) VALUES (
            p_user_id, p_space_id, p_subspace_id, p_session_id,
            p_url, v_normalized_url, v_domain,
            p_title, p_content, p_word_count,
            p_engagement_level, p_content_source,
            p_dwell_time_ms, p_scroll_depth, p_reading_depth,
            p_captured_at
        )
        RETURNING id INTO v_artifact_id;
    ELSE
        -- UPDATE existing artifact (semantic ordering: never downgrade)
        UPDATE misir.artifact SET
            title = COALESCE(p_title, title),
            extracted_text = COALESCE(p_content, extracted_text),
            word_count = GREATEST(word_count, p_word_count),
            engagement_level = CASE 
                WHEN misir.engagement_level_order(p_engagement_level) > misir.engagement_level_order(engagement_level)
                THEN p_engagement_level 
                ELSE engagement_level 
            END,
            dwell_time_ms = GREATEST(dwell_time_ms, p_dwell_time_ms),
            scroll_depth = GREATEST(scroll_depth, p_scroll_depth),
            reading_depth = GREATEST(reading_depth, p_reading_depth),
            updated_at = now()
        WHERE id = v_artifact_id;
    END IF;
    
    -- Insert signal
    INSERT INTO misir.signal (
        artifact_id, space_id, user_id, subspace_id,
        vector, magnitude, signal_type,
        embedding_model, embedding_dimension,
        margin, updates_centroid
    ) VALUES (
        v_artifact_id, p_space_id, p_user_id, p_subspace_id,
        p_embedding, p_signal_magnitude, p_signal_type,
        'nomic-ai/nomic-embed-text-v1.5', 768,
        p_margin, p_updates_centroid
    )
    RETURNING id INTO v_signal_id;
    
    RETURN QUERY SELECT 
        v_artifact_id, 
        v_signal_id, 
        v_is_new,
        CASE WHEN v_is_new THEN 'Created new artifact' ELSE 'Updated existing artifact' END;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION misir.insert_artifact_with_signal TO authenticated;

COMMIT;

-- Verification query (run after migration)
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = 'misir.content_source'::regtype;
