# Security Fixes for Schema v1.0

> **Source:** Supabase Database Linter  
> **Severity:** WARN (Security)  
> **Status:** Action Required

---

## 🚨 Security Issues Detected

### 1. Function Search Path Mutable (8 functions)

**Risk:** Search path injection attacks - malicious users could create functions in earlier search paths

**Affected Functions:**
- `misir.update_subspace_centroid`
- `misir.insert_artifact_with_signal`
- `misir.update_updated_at`
- `misir.validate_reading_depth`
- `misir.normalize_url`
- `misir.extract_domain_from_url`
- `misir.set_normalized_url`
- `misir.set_domain_from_url`

---

### 2. Extensions in Public Schema (2 extensions)

**Risk:** Extensions in `public` schema can be accessed/modified by any user

**Affected Extensions:**
- `vector`
- `pg_trgm`

---

## ✅ Solution 1: Fix Function Search Path

Add `SET search_path = misir, pg_catalog, public` to all function definitions.

### Quick Fix SQL

Run this SQL to recreate all functions with secure search_path:

```sql
-- ============================================================================
-- SECURITY FIX: Add search_path to all functions
-- ============================================================================

-- 1. Update updated_at trigger function
CREATE OR REPLACE FUNCTION misir.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = misir, pg_catalog, public;

-- 2. URL Normalization
CREATE OR REPLACE FUNCTION misir.normalize_url(url TEXT)
RETURNS TEXT AS $$
DECLARE
    normalized TEXT;
BEGIN
    IF url IS NULL OR url = '' THEN
        RETURN url;
    END IF;
    
    normalized := url;
    
    -- Remove tracking parameters (utm_*, fbclid, gclid, msclkid, ref)
    normalized := regexp_replace(normalized, '[?&](utm_[^&]*|fbclid=[^&]*|gclid=[^&]*|msclkid=[^&]*|ref=[^&]*)', '', 'g');
    
    -- Clean up trailing ? or & if all params removed
    normalized := regexp_replace(normalized, '[?&]$', '');
    
    RETURN normalized;
END;
$$ LANGUAGE plpgsql IMMUTABLE
SET search_path = misir, pg_catalog, public;

-- 3. Domain Extraction
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
        RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE
SET search_path = misir, pg_catalog, public;

-- 4. Set Normalized URL (trigger function)
CREATE OR REPLACE FUNCTION misir.set_normalized_url()
RETURNS TRIGGER AS $$
BEGIN
    NEW.normalized_url := misir.normalize_url(NEW.url);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = misir, pg_catalog, public;

-- 5. Set Domain from URL (trigger function)
CREATE OR REPLACE FUNCTION misir.set_domain_from_url()
RETURNS TRIGGER AS $$
BEGIN
    NEW.domain := misir.extract_domain_from_url(NEW.url);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = misir, pg_catalog, public;

-- 6. Validate Reading Depth
CREATE OR REPLACE FUNCTION misir.validate_reading_depth()
RETURNS TRIGGER AS $$
DECLARE
    avg_wpm INTEGER;
    time_weight FLOAT;
    scroll_weight FLOAT;
    max_ratio FLOAT;
    
    expected_time_ms FLOAT;
    time_ratio FLOAT;
    calculated_depth FLOAT;
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
    
    -- Calculate expected reading depth
    IF NEW.word_count > 0 AND NEW.dwell_time_ms > 0 THEN
        expected_time_ms := (NEW.word_count * 60000.0) / avg_wpm;
        time_ratio := LEAST(max_ratio, NEW.dwell_time_ms / expected_time_ms);
        calculated_depth := (time_ratio * time_weight) + (NEW.scroll_depth * scroll_weight);
        
        -- Warn if mismatch (don't error, just log)
        IF ABS(calculated_depth - NEW.reading_depth) > tolerance THEN
            RAISE WARNING 'Reading depth mismatch: expected %, got %, diff %',
                calculated_depth, NEW.reading_depth, ABS(calculated_depth - NEW.reading_depth);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = misir, pg_catalog, public;

-- 7. Update Subspace Centroid (CRITICAL - most complex function)
CREATE OR REPLACE FUNCTION misir.update_subspace_centroid()
RETURNS TRIGGER AS $$
DECLARE
    v_subspace_id BIGINT;
    v_signal_count INTEGER;
    v_new_centroid vector(768);
    v_learning_rate FLOAT;
    v_old_centroid vector(768);
    v_distance_threshold FLOAT;
    v_min_signals_between_logs INTEGER;
    v_last_logged_centroid vector(768);
    v_centroid_distance FLOAT;
    v_signals_since_last_log INTEGER;
BEGIN
    v_subspace_id := NEW.subspace_id;
    
    IF v_subspace_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Load centroid history thresholds from system_config
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
    
    -- Get learning rate for this subspace
    SELECT learning_rate INTO v_learning_rate
    FROM misir.subspace
    WHERE id = v_subspace_id;
    
    IF v_learning_rate IS NULL THEN
        v_learning_rate := 0.1;
    END IF;
    
    -- Count active signals (exclude soft-deleted)
    SELECT COUNT(*) INTO v_signal_count
    FROM misir.signal
    WHERE subspace_id = v_subspace_id AND deleted_at IS NULL;
    
    -- Get old centroid
    SELECT centroid_embedding INTO v_old_centroid
    FROM misir.subspace
    WHERE id = v_subspace_id;
    
    -- Calculate new centroid using EMA
    IF v_old_centroid IS NOT NULL THEN
        v_new_centroid := (v_old_centroid * (1.0 - v_learning_rate)::float4 + NEW.vector * v_learning_rate::float4)::vector(768);
    ELSE
        v_new_centroid := NEW.vector;
    END IF;
    
    -- Update subspace with new centroid
    UPDATE misir.subspace
    SET 
        centroid_embedding = v_new_centroid,
        centroid_updated_at = NOW(),
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
$$ LANGUAGE plpgsql
SET search_path = misir, pg_catalog, public;

-- 8. Insert Artifact with Signal (transaction helper)
-- (This is a very long function - adding SET search_path at the end before $$ LANGUAGE)

CREATE OR REPLACE FUNCTION misir.insert_artifact_with_signal(
    p_user_id UUID,
    p_space_id BIGINT,
    p_subspace_id BIGINT DEFAULT NULL,
    p_session_id BIGINT DEFAULT NULL,
    p_title TEXT DEFAULT NULL,
    p_url TEXT,
    p_content TEXT DEFAULT NULL,
    p_embedding vector(768),
    p_engagement_level misir.engagement_level DEFAULT 'ambient',
    p_content_source misir.content_source DEFAULT 'web',
    p_dwell_time_ms INTEGER DEFAULT 0,
    p_scroll_depth FLOAT DEFAULT 0.0,
    p_reading_depth FLOAT DEFAULT 0.0,
    p_word_count INTEGER DEFAULT 0,
    p_signal_magnitude FLOAT DEFAULT 1.0,
    p_signal_type misir.signal_type DEFAULT 'semantic',
    p_matched_marker_ids BIGINT[] DEFAULT '{}',
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
    IF array_length(p_embedding, 1) != v_embedding_dimension THEN
        RAISE EXCEPTION 'embedding dimension mismatch: expected % (from system_config), got %', 
            v_embedding_dimension, array_length(p_embedding, 1);
    END IF;
    
    -- Normalize URL & domain
    v_normalized_url := misir.normalize_url(p_url);
    v_domain := misir.extract_domain_from_url(p_url);
    
    -- UPSERT artifact
    INSERT INTO misir.artifact (
        user_id, space_id, subspace_id, session_id,
        title, url, normalized_url, domain,
        extracted_text, word_count, content_embedding,
        content_source, engagement_level,
        dwell_time_ms, scroll_depth, reading_depth,
        matched_marker_ids,
        captured_at
    ) VALUES (
        p_user_id, p_space_id, p_subspace_id, p_session_id,
        p_title, p_url, v_normalized_url, v_domain,
        p_content, p_word_count, p_embedding,
        p_content_source, p_engagement_level,
        p_dwell_time_ms, p_scroll_depth, p_reading_depth,
        p_matched_marker_ids,
        p_captured_at
    )
    ON CONFLICT (user_id, normalized_url) DO UPDATE
    SET
        title = COALESCE(EXCLUDED.title, misir.artifact.title),
        extracted_text = COALESCE(EXCLUDED.extracted_text, misir.artifact.extracted_text),
        word_count = GREATEST(EXCLUDED.word_count, misir.artifact.word_count),
        content_embedding = COALESCE(EXCLUDED.content_embedding, misir.artifact.content_embedding),
        engagement_level = (
            CASE 
                WHEN EXCLUDED.engagement_level::text > misir.artifact.engagement_level::text THEN EXCLUDED.engagement_level
                ELSE misir.artifact.engagement_level
            END
        ),
        dwell_time_ms = misir.artifact.dwell_time_ms + EXCLUDED.dwell_time_ms,
        scroll_depth = GREATEST(EXCLUDED.scroll_depth, misir.artifact.scroll_depth),
        reading_depth = GREATEST(EXCLUDED.reading_depth, misir.artifact.reading_depth),
        updated_at = NOW()
    RETURNING id, (xmax = 0) INTO v_artifact_id, v_is_new;
    
    -- Always create NEW signal (time-series)
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
$$ LANGUAGE plpgsql
SET search_path = misir, pg_catalog, public;
```

---

## 📝 Solution 2: Extensions Schema (Optional)

**Note:** Moving extensions requires `superuser` access. Supabase manages this automatically - you typically don't need to fix this manually.

If you have superuser access:

```sql
-- Move vector extension to extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION vector SET SCHEMA extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- Grant usage
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
```

**For Supabase users:** This is handled automatically by Supabase's infrastructure. You can safely ignore the "extension_in_public" warning.

---

## ✅ Deployment

### Option 1: Apply Security Fix (Recommended)

```bash
# Run the security fix SQL
psql -h <host> -U postgres -d postgres -f security-fix-search-path.sql
```

### Option 2: Redeploy Full Schema

The full schema file already needs to be updated with these fixes. I'll create an updated version.

---

## 🔒 Why This Matters

### Search Path Injection Attack Example:

```sql
-- Attacker creates malicious function in public schema
CREATE FUNCTION public.now() RETURNS timestamptz AS $$
BEGIN
  -- Log all function calls to attacker's table
  INSERT INTO attacker_logs VALUES (current_user);
  RETURN pg_catalog.now();
END;
$$ LANGUAGE plpgsql;

-- When your function calls now(), it uses the attacker's version!
-- With SET search_path = misir, pg_catalog, public, 
-- it will use pg_catalog.now() instead (safe)
```

---

## ✅ Verification

After applying fixes, re-run Supabase linter:

```sql
-- Should return 0 rows for function_search_path_mutable
SELECT * FROM supabase_linter()
WHERE name = 'function_search_path_mutable';
```

---

**Status:** Security fixes ready to deploy  
**Priority:** HIGH (should fix before production)  
**Estimated Time:** 5 minutes to deploy SQL
