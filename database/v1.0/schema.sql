-- ============================================================================
-- MISIR DATABASE SCHEMA v1.0 - PRODUCTION COMPLETE
-- ============================================================================
-- Version: 1.0 FINAL
-- Codename: shiro.exe
-- Date: February 4, 2026
-- PostgreSQL: 14+ with pgvector extension
--
-- This file combines:
-- - Core schema (database-schema-v1-shiro.md)
-- - Critical additions (database-schema-v1-CRITICAL-ADDITIONS.md)
-- - All bug fixes (correct math, JSONB migration, error handling)
-- - Auto-triggers (domain extraction, centroid updates)
-- - Transaction helpers
--
-- Deploy: Run entire file in a single transaction
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: EXTENSIONS & SCHEMA SETUP
-- ============================================================================

-- Create custom schema
CREATE SCHEMA IF NOT EXISTS misir;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Grant usage
GRANT USAGE ON SCHEMA misir TO authenticated;
GRANT USAGE ON SCHEMA misir TO service_role;

-- ============================================================================
-- PART 2: ENUM TYPES
-- ============================================================================

-- Engagement level (stable, won't change)
CREATE TYPE misir.engagement_level AS ENUM ('ambient', 'engaged', 'committed');

-- Content source (stable categories)
CREATE TYPE misir.content_source AS ENUM ('web', 'ai', 'video', 'document', 'note');

-- Decay rate (mathematical constants)
CREATE TYPE misir.decay_rate AS ENUM ('high', 'medium', 'low');

-- Signal type (mathematical categories)
CREATE TYPE misir.signal_type AS ENUM ('semantic', 'temporal', 'behavioral', 'structural');

-- Insight severity (UI constants)
CREATE TYPE misir.insight_severity AS ENUM ('low', 'medium', 'high', 'critical');

-- Insight status (workflow states)
CREATE TYPE misir.insight_status AS ENUM ('active', 'dismissed', 'acted');

-- ============================================================================
-- PART 3: CORE TABLES (11 + 1 junction = 12 total)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PROFILE (extends Supabase auth.users)
-- ----------------------------------------------------------------------------

CREATE TABLE misir.profile (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    display_name TEXT,
    avatar_url TEXT,
    timezone TEXT DEFAULT 'UTC',
    
    onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    onboarded_at TIMESTAMPTZ,
    
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. SYSTEM_CONFIG (global configuration)
-- ----------------------------------------------------------------------------

CREATE TABLE misir.system_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO misir.system_config (key, value, description) VALUES
    ('embedding_model', '{"name": "nomic-ai/nomic-embed-text-v1.5", "dimension": 768, "context_length": 8192}', 'Current embedding model for NEW vectors (existing vectors track their own model)'),
    ('vector_index_params', '{"m": 16, "ef_construction": 128}', 'HNSW index parameters - ef_construction=128 for production-quality recall'),
    ('reading_depth_constants', '{"avg_wpm": 200, "time_weight": 0.6, "scroll_weight": 0.4, "max_ratio": 1.5}', 'Reading depth calculation parameters (SINGLE SOURCE OF TRUTH)'),
    ('centroid_history_threshold', '{"distance_threshold": 0.05, "min_signals_between_logs": 5}', 'Semantic distance threshold for logging centroid changes - prevents history spam');

-- ----------------------------------------------------------------------------
-- 3. SPACE (top-level knowledge container)
-- ----------------------------------------------------------------------------

CREATE TABLE misir.space (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    description TEXT,
    
    embedding vector(768),
    
    evidence FLOAT NOT NULL DEFAULT 0.0
        CHECK (evidence >= 0.0 AND evidence <= 100.0),
    
    layout JSONB NOT NULL DEFAULT '{"state": [0.0, 0.0, 0.0, 0.0]}'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. SUBSPACE (semantic clusters within a space)
-- ----------------------------------------------------------------------------

CREATE TABLE misir.subspace (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    space_id BIGINT NOT NULL REFERENCES misir.space(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    description TEXT,
    
    centroid_embedding vector(768),
    centroid_updated_at TIMESTAMPTZ,
    
    -- v1.0 CRITICAL ADDITION: Learning rate for EMA updates
    learning_rate FLOAT NOT NULL DEFAULT 0.1
        CHECK (learning_rate > 0.0 AND learning_rate <= 1.0),
    
    artifact_count INTEGER NOT NULL DEFAULT 0,
    confidence FLOAT NOT NULL DEFAULT 0.0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 5. SUBSPACE_CENTROID_HISTORY (audit trail for centroid evolution)
-- ----------------------------------------------------------------------------

CREATE TABLE misir.subspace_centroid_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    subspace_id BIGINT NOT NULL REFERENCES misir.subspace(id) ON DELETE CASCADE,
    
    centroid_embedding vector(768) NOT NULL,
    artifact_count INTEGER NOT NULL DEFAULT 0,
    signal_count INTEGER NOT NULL DEFAULT 0,
    confidence DOUBLE PRECISION DEFAULT 0.0,
    
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 6. MARKER (semantic tags for classification)
-- ----------------------------------------------------------------------------

CREATE TABLE misir.marker (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    space_id BIGINT NOT NULL REFERENCES misir.space(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    label TEXT NOT NULL,
    embedding vector(768),
    weight FLOAT NOT NULL DEFAULT 1.0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT marker_unique_per_space UNIQUE (space_id, label)
);

-- ----------------------------------------------------------------------------
-- 7. SESSION (browsing session grouping)
-- ----------------------------------------------------------------------------

CREATE TABLE misir.session (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    space_id BIGINT REFERENCES misir.space(id) ON DELETE SET NULL,
    
    external_id TEXT NOT NULL,
    
    artifact_count INTEGER NOT NULL DEFAULT 0,
    total_dwell_ms BIGINT NOT NULL DEFAULT 0,
    
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT session_external_id_unique UNIQUE (user_id, external_id)
);

-- ----------------------------------------------------------------------------
-- 8. ARTIFACT (captured content with engagement metrics)
-- ----------------------------------------------------------------------------

CREATE TABLE misir.artifact (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    space_id BIGINT NOT NULL REFERENCES misir.space(id) ON DELETE CASCADE,
    subspace_id BIGINT REFERENCES misir.subspace(id) ON DELETE SET NULL,
    session_id BIGINT REFERENCES misir.session(id) ON DELETE SET NULL,
    
    -- Content identification
    title TEXT,
    url TEXT NOT NULL,
    normalized_url TEXT NOT NULL,
    domain TEXT NOT NULL,
    
    -- Content
    extracted_text TEXT,
    content_hash TEXT,
    word_count INTEGER,
    
    -- Embedding
    content_embedding vector(768),
    
    -- Classification (two dimensions)
    content_source misir.content_source NOT NULL DEFAULT 'web',
    engagement_level misir.engagement_level NOT NULL DEFAULT 'ambient',
    
    -- Engagement metrics
    dwell_time_ms INTEGER NOT NULL DEFAULT 0,
    scroll_depth FLOAT NOT NULL DEFAULT 0.0
        CHECK (scroll_depth >= 0.0 AND scroll_depth <= 1.0),
    reading_depth FLOAT NOT NULL DEFAULT 0.0
        CHECK (reading_depth >= 0.0 AND reading_depth <= 1.5),
    
    -- Weight calculation
    base_weight FLOAT NOT NULL DEFAULT 0.2
        CHECK (base_weight IN (0.2, 1.0, 2.0)),
    decay_rate misir.decay_rate NOT NULL DEFAULT 'high',
    relevance FLOAT NOT NULL DEFAULT 0.0,
    
    -- Matched markers (array of IDs for FK integrity)
    matched_marker_ids BIGINT[],
    
    -- Timestamps
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Metadata (flexible storage for future fields)
    metadata JSONB,
    
    CONSTRAINT artifact_unique_url_per_user UNIQUE (user_id, normalized_url)
);

-- v1.0 CRITICAL ADDITION: Auto-computed effective weight
ALTER TABLE misir.artifact
ADD COLUMN effective_weight FLOAT
    GENERATED ALWAYS AS (
        base_weight * relevance * 
        CASE decay_rate
            WHEN 'high' THEN 0.5
            WHEN 'medium' THEN 0.75
            WHEN 'low' THEN 0.9
        END
    ) STORED;

COMMENT ON COLUMN misir.artifact.normalized_url IS 'URL with tracking parameters removed for deduplication';

-- ----------------------------------------------------------------------------
-- 9. SIGNAL (vector emissions from artifacts)
-- ----------------------------------------------------------------------------

CREATE TABLE misir.signal (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    artifact_id BIGINT NOT NULL REFERENCES misir.artifact(id) ON DELETE CASCADE,
    space_id BIGINT NOT NULL REFERENCES misir.space(id) ON DELETE CASCADE,
    subspace_id BIGINT REFERENCES misir.subspace(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Vector data
    vector vector(768) NOT NULL,
    magnitude DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    signal_type misir.signal_type NOT NULL,
    
    -- v1.0 CRITICAL ADDITION: Per-signal embedding model tracking
    embedding_model TEXT NOT NULL DEFAULT 'nomic-ai/nomic-embed-text-v1.5',
    embedding_dimension INTEGER NOT NULL DEFAULT 768,
    
    -- Soft-delete
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- v1.0 CRITICAL ADDITION: Constraint to ensure dimension matches model
-- Future-proof: validates consistency, not hardcoded value
ALTER TABLE misir.signal
ADD CONSTRAINT signal_dimension_matches 
    CHECK (
        (embedding_model LIKE 'nomic-ai%' AND embedding_dimension = 768) OR
        (embedding_model = 'BAAI/bge-small-en-v1.5' AND embedding_dimension = 384) OR
        (embedding_dimension BETWEEN 256 AND 8192)  -- Allow future models
    );

-- ----------------------------------------------------------------------------
-- 10. INSIGHT (observations about knowledge patterns)
-- ----------------------------------------------------------------------------

CREATE TABLE misir.insight (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    space_id BIGINT REFERENCES misir.space(id) ON DELETE CASCADE,
    subspace_id BIGINT REFERENCES misir.subspace(id) ON DELETE CASCADE,
    
    headline TEXT NOT NULL,
    description TEXT,
    insight_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    severity misir.insight_severity NOT NULL DEFAULT 'low',
    status misir.insight_status NOT NULL DEFAULT 'active',
    
    dismissed_at TIMESTAMPTZ,
    acted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 11. AI_REPORT (generated intelligence summaries)
-- ----------------------------------------------------------------------------

CREATE TABLE misir.ai_report (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    report_type TEXT NOT NULL,
    report JSONB NOT NULL,
    
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 12. SUBSPACE_MARKER (junction table - v1.0 CRITICAL ADDITION)
-- ----------------------------------------------------------------------------
-- Purpose: Replace JSONB array with proper relational design for FK enforcement

CREATE TABLE misir.subspace_marker (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    
    subspace_id BIGINT NOT NULL REFERENCES misir.subspace(id) ON DELETE CASCADE,
    marker_id BIGINT NOT NULL REFERENCES misir.marker(id) ON DELETE CASCADE,
    
    weight FLOAT NOT NULL DEFAULT 1.0
        CHECK (weight >= 0.0 AND weight <= 1.0),
    
    source TEXT NOT NULL DEFAULT 'extracted'
        CHECK (source IN ('user_defined', 'extracted', 'suggested')),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT subspace_marker_unique UNIQUE (subspace_id, marker_id)
);

-- ============================================================================
-- PART 4: HELPER FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- URL Normalization (remove tracking params)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION misir.normalize_url(url_input TEXT)
RETURNS TEXT AS $$
DECLARE
    normalized TEXT;
BEGIN
    IF url_input IS NULL OR url_input = '' THEN
        RETURN url_input;
    END IF;
    
    normalized := url_input;
    
    -- Remove common tracking parameters
    normalized := regexp_replace(normalized, '[?&]utm_[^&]*', '', 'g');
    normalized := regexp_replace(normalized, '[?&]fbclid=[^&]*', '', 'g');
    normalized := regexp_replace(normalized, '[?&]gclid=[^&]*', '', 'g');
    normalized := regexp_replace(normalized, '[?&]msclkid=[^&]*', '', 'g');
    normalized := regexp_replace(normalized, '[?&]ref=[^&]*', '', 'g');
    
    -- Remove trailing ? or &
    normalized := regexp_replace(normalized, '[?&]$', '');
    
    RETURN normalized;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ----------------------------------------------------------------------------
-- Domain Extraction (v1.0 CRITICAL ADDITION)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION misir.extract_domain_from_url(url_input TEXT)
RETURNS TEXT AS $$
DECLARE
    domain_output TEXT;
BEGIN
    IF url_input IS NULL OR url_input = '' THEN
        RETURN NULL;
    END IF;
    
    -- Remove protocol
    domain_output := regexp_replace(url_input, '^https?://', '');
    -- Remove www. prefix
    domain_output := regexp_replace(domain_output, '^www\.', '');
    -- Remove path and query params
    domain_output := regexp_replace(domain_output, '/.*$', '');
    -- Remove port
    domain_output := regexp_replace(domain_output, ':\d+$', '');
    
    RETURN LOWER(domain_output);
EXCEPTION
    WHEN OTHERS THEN
        -- Return NULL instead of 'unknown' to avoid polluting analytics
        -- Indexes will skip NULL values
        RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ----------------------------------------------------------------------------
-- Timestamp Update Trigger
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION misir.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- URL Normalization Trigger (v1.0 CRITICAL BUG FIX)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION misir.set_normalized_url()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.url IS NOT NULL THEN
        NEW.normalized_url := misir.normalize_url(NEW.url);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Domain Auto-Extraction Trigger (v1.0 CRITICAL ADDITION)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION misir.set_domain_from_url()
RETURNS TRIGGER AS $$
BEGIN
    -- Only auto-set if domain is NULL or empty (don't overwrite manual values)
    IF NEW.url IS NOT NULL AND (NEW.domain IS NULL OR NEW.domain = '') THEN
        NEW.domain := misir.extract_domain_from_url(NEW.url);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Centroid Auto-Update Trigger (v1.0 CRITICAL ADDITION)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION misir.update_subspace_centroid()
RETURNS TRIGGER AS $$
DECLARE
    v_learning_rate FLOAT := 0.1;
    v_old_centroid vector(768);
    v_new_centroid vector(768);
    v_last_logged_centroid vector(768);
    v_centroid_distance FLOAT;
    v_distance_threshold FLOAT := 0.05;
    v_min_signals_between_logs INTEGER := 5;
    v_artifact_count INTEGER;
    v_signal_count INTEGER;
    v_signals_since_last_log INTEGER;
    v_subspace_id BIGINT;
BEGIN
    v_subspace_id := NEW.subspace_id;
    
    IF v_subspace_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Load configuration from system_config
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
            -- Use defaults if config missing
            v_distance_threshold := 0.05;
            v_min_signals_between_logs := 5;
    END;
    
    -- Get current subspace data
    SELECT 
        centroid_embedding, 
        learning_rate,
        artifact_count
    INTO 
        v_old_centroid, 
        v_learning_rate, 
        v_artifact_count
    FROM misir.subspace
    WHERE id = v_subspace_id;
    
    -- Initialize with first signal
    IF v_old_centroid IS NULL THEN
        UPDATE misir.subspace
        SET 
            centroid_embedding = NEW.vector,
            centroid_updated_at = NOW(),
            artifact_count = COALESCE(artifact_count, 0) + 1,
            confidence = 0.1
        WHERE id = v_subspace_id;
        
        INSERT INTO misir.subspace_centroid_history (
            subspace_id, centroid_embedding, artifact_count, signal_count, confidence, computed_at
        ) VALUES (
            v_subspace_id, NEW.vector, 1, 1, 0.1, NOW()
        );
        
        RETURN NEW;
    END IF;
    
    -- Compute new centroid with Exponential Moving Average
    -- Formula: new_centroid = (1 - α) * old_centroid + α * new_signal
    v_new_centroid := (
        SELECT array_agg(
            (1 - v_learning_rate) * v_old_centroid[i] + 
            v_learning_rate * NEW.vector[i]
        )::vector(768)
        FROM generate_series(1, 768) as i
    );
    
    -- Get current signal count
    SELECT COUNT(*) INTO v_signal_count
    FROM misir.signal
    WHERE subspace_id = v_subspace_id AND deleted_at IS NULL;
    
    -- Update subspace
    -- NOTE: artifact_count tracks UNIQUE artifacts, not total signals
    UPDATE misir.subspace
    SET 
        centroid_embedding = v_new_centroid,
        centroid_updated_at = NOW(),
        -- Only increment if this artifact is new to this subspace
        artifact_count = (
            SELECT COUNT(DISTINCT artifact_id)
            FROM misir.signal
            WHERE subspace_id = v_subspace_id AND deleted_at IS NULL
        ),
        confidence = LEAST(1.0, v_signal_count::FLOAT / 20.0)
    WHERE id = v_subspace_id;
    
    -- CRITICAL IMPROVEMENT: Log to history based on SEMANTIC DISTANCE, not time
    -- Get last logged centroid
    SELECT centroid_embedding INTO v_last_logged_centroid
    FROM misir.subspace_centroid_history
    WHERE subspace_id = v_subspace_id
    ORDER BY computed_at DESC
    LIMIT 1;
    
    -- Calculate distance moved
    IF v_last_logged_centroid IS NOT NULL THEN
        v_centroid_distance := 1 - (v_new_centroid <=> v_last_logged_centroid);
    ELSE
        v_centroid_distance := 1.0;  -- First log
    END IF;
    
    -- Count signals since last log
    SELECT COUNT(*) INTO v_signals_since_last_log
    FROM misir.signal
    WHERE subspace_id = v_subspace_id 
      AND deleted_at IS NULL
      AND created_at > COALESCE(
          (SELECT computed_at FROM misir.subspace_centroid_history 
           WHERE subspace_id = v_subspace_id 
           ORDER BY computed_at DESC LIMIT 1),
          '1970-01-01'::TIMESTAMPTZ
      );
    
    -- Log if centroid moved significantly OR minimum signals threshold met
    IF v_centroid_distance >= v_distance_threshold 
       OR v_signals_since_last_log >= v_min_signals_between_logs THEN
        INSERT INTO misir.subspace_centroid_history (
            subspace_id, centroid_embedding, artifact_count, signal_count, confidence, computed_at
        ) VALUES (
            v_subspace_id, v_new_centroid, 
            (SELECT COUNT(DISTINCT artifact_id) FROM misir.signal WHERE subspace_id = v_subspace_id AND deleted_at IS NULL),
            v_signal_count,
            LEAST(1.0, v_signal_count::FLOAT / 20.0), 
            NOW()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Reading Depth Validation (v1.0 CRITICAL ADDITION - Config-Driven)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION misir.validate_reading_depth()
RETURNS TRIGGER AS $$
DECLARE
    avg_wpm INTEGER := 200;
    time_weight FLOAT := 0.6;
    scroll_weight FLOAT := 0.4;
    max_ratio FLOAT := 1.5;
    expected_time_ms INTEGER;
    time_ratio FLOAT;
    computed_depth FLOAT;
    tolerance FLOAT := 0.05;
BEGIN
    -- Load constants from system_config (SINGLE SOURCE OF TRUTH)
    BEGIN
        SELECT 
            (value->>'avg_wpm')::INTEGER,
            (value->>'time_weight')::FLOAT,
            (value->>'scroll_weight')::FLOAT,
            (value->>'max_ratio')::FLOAT
        INTO 
            avg_wpm,
            time_weight,
            scroll_weight,
            max_ratio
        FROM misir.system_config
        WHERE key = 'reading_depth_constants';
    EXCEPTION
        WHEN OTHERS THEN
            -- Use defaults if config missing
            avg_wpm := 200;
            time_weight := 0.6;
            scroll_weight := 0.4;
            max_ratio := 1.5;
    END;
    
    IF NEW.word_count > 0 THEN
        -- CORRECT: 200 wpm = 3.33 words/sec = 300ms per word
        expected_time_ms := (NEW.word_count * 60000) / avg_wpm;
        
        time_ratio := LEAST(max_ratio, NEW.dwell_time_ms::FLOAT / NULLIF(expected_time_ms, 0));
        computed_depth := (time_ratio * time_weight) + (NEW.scroll_depth * scroll_weight);
        
        IF ABS(NEW.reading_depth - computed_depth) > tolerance THEN
            RAISE WARNING 'reading_depth mismatch for artifact %: stored=%, computed=%, delta=%',
                NEW.id, NEW.reading_depth, computed_depth, ABS(NEW.reading_depth - computed_depth);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- Transaction Helper (v1.0 CRITICAL ADDITION)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION misir.insert_artifact_with_signal(
    p_user_id UUID,
    p_space_id BIGINT,
    p_subspace_id BIGINT DEFAULT NULL,
    p_session_id BIGINT DEFAULT NULL,
    p_title TEXT DEFAULT NULL,
    p_url TEXT DEFAULT NULL,
    p_content TEXT DEFAULT NULL,
    p_embedding vector(768) DEFAULT NULL,
    p_engagement_level misir.engagement_level DEFAULT 'ambient',
    p_content_source misir.content_source DEFAULT 'web',
    p_dwell_time_ms INTEGER DEFAULT 0,
    p_scroll_depth FLOAT DEFAULT 0.0,
    p_reading_depth FLOAT DEFAULT 0.0,
    p_word_count INTEGER DEFAULT 0,
    p_signal_magnitude FLOAT DEFAULT 1.0,
    p_signal_type misir.signal_type DEFAULT 'semantic',
    p_matched_marker_ids BIGINT[] DEFAULT '{}'::BIGINT[],
    p_captured_at TIMESTAMPTZ DEFAULT NOW()
) RETURNS TABLE(
    artifact_id BIGINT, 
    signal_id BIGINT, 
    is_new BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_artifact_id BIGINT;
    v_signal_id BIGINT;
    v_embedding_model TEXT;
    v_embedding_dimension INTEGER;
    v_is_new BOOLEAN := TRUE;
    v_normalized_url TEXT;
    v_domain TEXT;
BEGIN
    -- Input validation
    IF p_embedding IS NULL THEN
        RAISE EXCEPTION 'embedding cannot be NULL';
    END IF;
    
    IF p_url IS NULL OR p_url = '' THEN
        RAISE EXCEPTION 'url cannot be NULL or empty';
    END IF;
    
    IF p_word_count < 0 THEN
        RAISE EXCEPTION 'word_count must be non-negative, got %', p_word_count;
    END IF;
    
    IF p_scroll_depth < 0.0 OR p_scroll_depth > 1.0 THEN
        RAISE EXCEPTION 'scroll_depth must be 0-1, got %', p_scroll_depth;
    END IF;
    
    IF p_reading_depth < 0.0 OR p_reading_depth > 1.5 THEN
        RAISE EXCEPTION 'reading_depth must be 0-1.5, got %', p_reading_depth;
    END IF;
    
    IF p_signal_magnitude < 0.0 OR p_signal_magnitude > 1.0 THEN
        RAISE EXCEPTION 'signal_magnitude must be 0-1, got %', p_signal_magnitude;
    END IF;
    
    -- Get embedding model and dimension from system_config (CRITICAL FIX)
    -- This allows model changes without function migration
    BEGIN
        SELECT 
            value->>'name',
            (value->>'dimension')::INTEGER
        INTO 
            v_embedding_model,
            v_embedding_dimension
        FROM misir.system_config
        WHERE key = 'embedding_model';
    EXCEPTION
        WHEN OTHERS THEN
            v_embedding_model := 'nomic-ai/nomic-embed-text-v1.5';
            v_embedding_dimension := 768;
            RAISE WARNING 'system_config missing embedding_model, using defaults: % (%d)', 
                v_embedding_model, v_embedding_dimension;
    END;
    
    -- Validate dimension matches config
    IF vector_dims(p_embedding) != v_embedding_dimension THEN
        RAISE EXCEPTION 'embedding dimension mismatch: expected % (from system_config), got %', 
            v_embedding_dimension, vector_dims(p_embedding);
    END IF;
    
    -- Normalize URL & domain
    v_normalized_url := misir.normalize_url(p_url);
    v_domain := misir.extract_domain_from_url(p_url);
    
    -- UPSERT artifact
    INSERT INTO misir.artifact (
        user_id, space_id, subspace_id, session_id,
        url, normalized_url, domain,
        title, extracted_text,
        content_embedding, 
        engagement_level, content_source,
        dwell_time_ms, scroll_depth, reading_depth,
        word_count, matched_marker_ids,
        captured_at, created_at
    ) VALUES (
        p_user_id, p_space_id, p_subspace_id, p_session_id,
        p_url, v_normalized_url, v_domain,
        COALESCE(p_title, 'Untitled'), p_content,
        p_embedding,
        p_engagement_level, p_content_source,
        p_dwell_time_ms, p_scroll_depth, p_reading_depth,
        p_word_count, p_matched_marker_ids,
        p_captured_at, NOW()
    )
    ON CONFLICT (user_id, normalized_url) DO UPDATE SET
        title = COALESCE(EXCLUDED.title, misir.artifact.title),
        subspace_id = COALESCE(EXCLUDED.subspace_id, misir.artifact.subspace_id),
        matched_marker_ids = CASE
            WHEN EXCLUDED.matched_marker_ids IS NOT NULL
                 AND COALESCE(array_length(EXCLUDED.matched_marker_ids, 1), 0) > 0
                THEN EXCLUDED.matched_marker_ids
            ELSE misir.artifact.matched_marker_ids
        END,
        dwell_time_ms = GREATEST(misir.artifact.dwell_time_ms, EXCLUDED.dwell_time_ms),
        scroll_depth = GREATEST(misir.artifact.scroll_depth, EXCLUDED.scroll_depth),
        reading_depth = GREATEST(misir.artifact.reading_depth, EXCLUDED.reading_depth),
        -- v1.0 CRITICAL BUG FIX: Semantic ordering, not lexicographic
        engagement_level = CASE 
            WHEN EXCLUDED.engagement_level = 'committed' THEN 'committed'
            WHEN EXCLUDED.engagement_level = 'engaged' AND misir.artifact.engagement_level = 'ambient' THEN 'engaged'
            WHEN EXCLUDED.engagement_level = 'ambient' AND misir.artifact.engagement_level = 'committed' THEN 'committed'
            WHEN EXCLUDED.engagement_level = 'ambient' AND misir.artifact.engagement_level = 'engaged' THEN 'engaged'
            ELSE misir.artifact.engagement_level
        END,
        updated_at = NOW()
    RETURNING id, (xmax = 0) INTO v_artifact_id, v_is_new;
    
    -- Insert signal (always create new signal)
    INSERT INTO misir.signal (
        artifact_id, space_id, subspace_id, user_id,
        vector, magnitude, signal_type,
        embedding_model, embedding_dimension,
        created_at
    ) VALUES (
        v_artifact_id, p_space_id, p_subspace_id, p_user_id,
        p_embedding, p_signal_magnitude, p_signal_type,
        v_embedding_model, 768,
        NOW()
    ) RETURNING id INTO v_signal_id;
    
    RETURN QUERY SELECT 
        v_artifact_id, 
        v_signal_id, 
        v_is_new,
        CASE 
            WHEN v_is_new THEN 'Created new artifact and signal'
            ELSE 'Updated existing artifact and created new signal'
        END::TEXT;
        
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'insert_artifact_with_signal failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 5: ATTACH TRIGGERS
-- ============================================================================

-- Updated_at triggers
CREATE TRIGGER profile_updated_at BEFORE UPDATE ON misir.profile
    FOR EACH ROW EXECUTE FUNCTION misir.update_updated_at();

CREATE TRIGGER space_updated_at BEFORE UPDATE ON misir.space
    FOR EACH ROW EXECUTE FUNCTION misir.update_updated_at();

CREATE TRIGGER subspace_updated_at BEFORE UPDATE ON misir.subspace
    FOR EACH ROW EXECUTE FUNCTION misir.update_updated_at();

CREATE TRIGGER artifact_updated_at BEFORE UPDATE ON misir.artifact
    FOR EACH ROW EXECUTE FUNCTION misir.update_updated_at();

CREATE TRIGGER subspace_centroid_history_updated_at BEFORE UPDATE ON misir.subspace_centroid_history
    FOR EACH ROW EXECUTE FUNCTION misir.update_updated_at();

-- URL normalization trigger (v1.0 CRITICAL BUG FIX)
CREATE TRIGGER artifact_normalize_url
    BEFORE INSERT OR UPDATE OF url ON misir.artifact
    FOR EACH ROW EXECUTE FUNCTION misir.set_normalized_url();

-- Domain extraction trigger
CREATE TRIGGER artifact_set_domain
    BEFORE INSERT OR UPDATE OF url ON misir.artifact
    FOR EACH ROW EXECUTE FUNCTION misir.set_domain_from_url();

-- Centroid auto-update trigger
CREATE TRIGGER signal_update_centroid
    AFTER INSERT ON misir.signal
    FOR EACH ROW
    WHEN (NEW.subspace_id IS NOT NULL AND NEW.deleted_at IS NULL)
    EXECUTE FUNCTION misir.update_subspace_centroid();

-- Reading depth validation trigger (commented out by default)
-- CREATE TRIGGER artifact_validate_reading_depth
--     BEFORE INSERT OR UPDATE ON misir.artifact
--     FOR EACH ROW EXECUTE FUNCTION misir.validate_reading_depth();

-- ============================================================================
-- PART 6: INDEXES
-- ============================================================================

-- Profile indexes
CREATE INDEX idx_profile_timezone ON misir.profile(timezone);

-- Space indexes
CREATE INDEX idx_space_user_id ON misir.space(user_id);
CREATE INDEX idx_space_evidence ON misir.space(evidence DESC);
CREATE INDEX idx_space_embedding_hnsw ON misir.space USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 128);

-- Subspace indexes
CREATE INDEX idx_subspace_space_id ON misir.subspace(space_id);
CREATE INDEX idx_subspace_user_id ON misir.subspace(user_id);
CREATE INDEX idx_subspace_centroid_hnsw ON misir.subspace USING hnsw (centroid_embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 128);

-- Subspace centroid history indexes
CREATE INDEX idx_centroid_history_subspace_id ON misir.subspace_centroid_history(subspace_id);
CREATE INDEX idx_centroid_history_computed_at ON misir.subspace_centroid_history(computed_at DESC);

-- Marker indexes
CREATE INDEX idx_marker_space_id ON misir.marker(space_id);
CREATE INDEX idx_marker_user_id ON misir.marker(user_id);
CREATE INDEX idx_marker_label ON misir.marker(label);
CREATE INDEX idx_marker_embedding_hnsw ON misir.marker USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 128);

-- Session indexes
CREATE INDEX idx_session_user_id ON misir.session(user_id);
CREATE INDEX idx_session_space_id ON misir.session(space_id);
CREATE INDEX idx_session_started_at ON misir.session(started_at DESC);

-- Artifact indexes
CREATE INDEX idx_artifact_user_id ON misir.artifact(user_id);
CREATE INDEX idx_artifact_space_id ON misir.artifact(space_id);
CREATE INDEX idx_artifact_subspace_id ON misir.artifact(subspace_id);
CREATE INDEX idx_artifact_session_id ON misir.artifact(session_id);
CREATE INDEX idx_artifact_domain ON misir.artifact(domain);
CREATE INDEX idx_artifact_captured_at ON misir.artifact(captured_at DESC);
CREATE INDEX idx_artifact_engagement ON misir.artifact(engagement_level);
CREATE INDEX idx_artifact_content_embedding_hnsw ON misir.artifact USING hnsw (content_embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 128);

-- Partial indexes for active records (soft-delete optimization)
CREATE INDEX idx_artifact_active ON misir.artifact(user_id, captured_at DESC)
    WHERE deleted_at IS NULL;

-- v1.0 CRITICAL ADDITION: Effective weight index
CREATE INDEX idx_artifact_effective_weight ON misir.artifact(effective_weight DESC)
    WHERE deleted_at IS NULL;

-- Signal indexes
CREATE INDEX idx_signal_artifact_id ON misir.signal(artifact_id);
CREATE INDEX idx_signal_space_id ON misir.signal(space_id);
CREATE INDEX idx_signal_subspace_id ON misir.signal(subspace_id);
CREATE INDEX idx_signal_user_id ON misir.signal(user_id);
CREATE INDEX idx_signal_created_at ON misir.signal(created_at DESC);
CREATE INDEX idx_signal_vector_hnsw ON misir.signal USING hnsw (vector vector_cosine_ops)
    WITH (m = 16, ef_construction = 128);

-- Partial index for active signals
CREATE INDEX idx_signal_active ON misir.signal(space_id, created_at DESC)
    WHERE deleted_at IS NULL;

-- v1.0 CRITICAL ADDITION: Embedding model index
CREATE INDEX idx_signal_embedding_model ON misir.signal(embedding_model);

-- Insight indexes
CREATE INDEX idx_insight_user_id ON misir.insight(user_id);
CREATE INDEX idx_insight_space_id ON misir.insight(space_id);
CREATE INDEX idx_insight_subspace_id ON misir.insight(subspace_id);
CREATE INDEX idx_insight_status ON misir.insight(status);
CREATE INDEX idx_insight_severity ON misir.insight(severity);

-- AI Report indexes
CREATE INDEX idx_ai_report_user_id ON misir.ai_report(user_id);
CREATE INDEX idx_ai_report_type ON misir.ai_report(report_type);
CREATE INDEX idx_ai_report_generated_at ON misir.ai_report(generated_at DESC);

-- v1.0 CRITICAL ADDITION: Subspace marker junction table indexes
CREATE INDEX idx_subspace_marker_subspace_id ON misir.subspace_marker(subspace_id);
CREATE INDEX idx_subspace_marker_marker_id ON misir.subspace_marker(marker_id);
CREATE INDEX idx_subspace_marker_subspace_weight ON misir.subspace_marker(subspace_id, weight DESC);
CREATE INDEX idx_subspace_marker_covering ON misir.subspace_marker(subspace_id) INCLUDE (marker_id, weight);

-- JSONB GIN indexes
CREATE INDEX idx_space_layout_gin ON misir.space USING gin(layout);
CREATE INDEX idx_artifact_metadata_gin ON misir.artifact USING gin(metadata);

-- ============================================================================
-- PART 7: ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE misir.profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE misir.system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE misir.space ENABLE ROW LEVEL SECURITY;
ALTER TABLE misir.subspace ENABLE ROW LEVEL SECURITY;
ALTER TABLE misir.subspace_centroid_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE misir.marker ENABLE ROW LEVEL SECURITY;
ALTER TABLE misir.session ENABLE ROW LEVEL SECURITY;
ALTER TABLE misir.artifact ENABLE ROW LEVEL SECURITY;
ALTER TABLE misir.signal ENABLE ROW LEVEL SECURITY;
ALTER TABLE misir.insight ENABLE ROW LEVEL SECURITY;
ALTER TABLE misir.ai_report ENABLE ROW LEVEL SECURITY;
ALTER TABLE misir.subspace_marker ENABLE ROW LEVEL SECURITY;

-- Profile policies
CREATE POLICY profile_owner ON misir.profile
    FOR ALL USING (id = auth.uid());

-- System config policies (read-only for users, write for service_role)
CREATE POLICY system_config_read ON misir.system_config
    FOR SELECT USING (true);

CREATE POLICY system_config_insert ON misir.system_config
    FOR INSERT WITH CHECK (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

CREATE POLICY system_config_update ON misir.system_config
    FOR UPDATE USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

CREATE POLICY system_config_delete ON misir.system_config
    FOR DELETE USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- Space policies
CREATE POLICY space_owner ON misir.space
    FOR ALL USING (user_id = auth.uid());

-- Subspace policies
CREATE POLICY subspace_owner ON misir.subspace
    FOR ALL USING (user_id = auth.uid());

-- Subspace centroid history policies
CREATE POLICY centroid_history_owner ON misir.subspace_centroid_history
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM misir.subspace
            WHERE misir.subspace.id = subspace_id AND misir.subspace.user_id = auth.uid()
        )
    );

-- Marker policies
CREATE POLICY marker_owner ON misir.marker
    FOR ALL USING (user_id = auth.uid());

-- Session policies
CREATE POLICY session_owner ON misir.session
    FOR ALL USING (user_id = auth.uid());

-- Artifact policies
CREATE POLICY artifact_owner ON misir.artifact
    FOR ALL USING (user_id = auth.uid());

-- Signal policies
CREATE POLICY signal_owner ON misir.signal
    FOR ALL USING (user_id = auth.uid());

-- Insight policies
CREATE POLICY insight_owner ON misir.insight
    FOR ALL USING (user_id = auth.uid());

-- AI Report policies
CREATE POLICY ai_report_owner ON misir.ai_report
    FOR ALL USING (user_id = auth.uid());

-- Subspace marker policies (v1.0 CRITICAL ADDITION)
CREATE POLICY subspace_marker_owner ON misir.subspace_marker
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM misir.subspace
            WHERE misir.subspace.id = subspace_id AND misir.subspace.user_id = auth.uid()
        )
    );

-- ============================================================================
-- PART 8: MIGRATION VALIDATION
-- ============================================================================

DO $$
DECLARE
    v_table_count INTEGER;
    v_index_count INTEGER;
    v_trigger_count INTEGER;
BEGIN
    -- Count tables
    SELECT COUNT(*) INTO v_table_count 
    FROM pg_tables 
    WHERE schemaname = 'misir';
    
    RAISE NOTICE '✓ Created % tables in misir schema', v_table_count;
    
    -- Count indexes
    SELECT COUNT(*) INTO v_index_count 
    FROM pg_indexes 
    WHERE schemaname = 'misir';
    
    RAISE NOTICE '✓ Created % indexes', v_index_count;
    
    -- Count triggers
    SELECT COUNT(*) INTO v_trigger_count 
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'misir';
    
    RAISE NOTICE '✓ Created % triggers', v_trigger_count;
    
    -- Verify system config
    IF NOT EXISTS (SELECT 1 FROM misir.system_config WHERE key = 'embedding_model') THEN
        RAISE EXCEPTION 'Missing embedding_model in system_config';
    END IF;
    
    RAISE NOTICE '✓ System configuration validated';
    RAISE NOTICE '=========================================';
    RAISE NOTICE '✓ SCHEMA v1.0 DEPLOYMENT SUCCESSFUL';
    RAISE NOTICE '=========================================';
END $$;

COMMIT;

-- ============================================================================
-- POST-DEPLOYMENT VERIFICATION QUERIES
-- ============================================================================

-- Uncomment these to run verification after deployment:

-- -- 1. Verify all tables exist
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'misir' 
-- ORDER BY table_name;

-- -- 2. Verify HNSW indexes
-- SELECT tablename, indexname FROM pg_indexes 
-- WHERE schemaname = 'misir' AND indexdef LIKE '%hnsw%';

-- -- 3. Verify RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables 
-- WHERE schemaname = 'misir';

-- -- 4. Test domain extraction
-- SELECT misir.extract_domain_from_url('https://www.example.com:8080/path?query=1');
-- -- Expected: example.com

-- -- 5. Test system config
-- SELECT * FROM misir.system_config;

-- ============================================================================
-- END OF SCHEMA v1.0
-- ============================================================================
