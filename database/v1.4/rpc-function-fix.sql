-- RPC Function for v1.4 Schema Compatibility
-- This recreates the insert_artifact_with_signal function with updated enum types
-- after v1.2 migration changes

CREATE OR REPLACE FUNCTION misir.insert_artifact_with_signal(
    p_user_id UUID,
    p_space_id BIGINT,
    p_url TEXT,
    p_embedding vector(768),
    p_subspace_id BIGINT DEFAULT NULL,
    p_session_id BIGINT DEFAULT NULL,
    p_title TEXT DEFAULT NULL,
    p_content TEXT DEFAULT NULL,
    p_engagement_level misir.engagement_level DEFAULT 'latent',
    p_content_source misir.content_source DEFAULT 'web',
    p_dwell_time_ms INTEGER DEFAULT 0,
    p_scroll_depth FLOAT DEFAULT 0.0,
    p_reading_depth FLOAT DEFAULT 0.0,
    p_word_count INTEGER DEFAULT 0,
    p_signal_magnitude FLOAT DEFAULT 1.0,
    p_signal_type misir.signal_type DEFAULT 'semantic',
    p_matched_marker_ids BIGINT[] DEFAULT '{}',
    p_captured_at TIMESTAMPTZ DEFAULT NOW(),
    -- v1.1 Assignment Margin parameters
    p_margin FLOAT DEFAULT NULL,
    p_updates_centroid BOOLEAN DEFAULT TRUE
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
    
    -- Get embedding model and dimension from system_config
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
        dwell_time_ms = GREATEST(misir.artifact.dwell_time_ms, EXCLUDED.dwell_time_ms),
        scroll_depth = GREATEST(misir.artifact.scroll_depth, EXCLUDED.scroll_depth),
        reading_depth = GREATEST(misir.artifact.reading_depth, EXCLUDED.reading_depth),
        -- v1.2 UPDATED: Semantic ordering with new enum values
        engagement_level = CASE 
            WHEN EXCLUDED.engagement_level = 'saturated' THEN 'saturated'
            WHEN EXCLUDED.engagement_level = 'engaged' AND misir.artifact.engagement_level IN ('latent', 'discovered') THEN 'engaged'
            WHEN EXCLUDED.engagement_level = 'discovered' AND misir.artifact.engagement_level = 'latent' THEN 'discovered'
            WHEN misir.artifact.engagement_level = 'saturated' THEN 'saturated'
            WHEN misir.artifact.engagement_level = 'engaged' AND EXCLUDED.engagement_level IN ('latent', 'discovered') THEN 'engaged'
            WHEN misir.artifact.engagement_level = 'discovered' AND EXCLUDED.engagement_level = 'latent' THEN 'discovered'
            ELSE misir.artifact.engagement_level
        END,
        updated_at = NOW()
    RETURNING id, (xmax = 0) INTO v_artifact_id, v_is_new;
    
    -- Insert signal (always create new signal)
    INSERT INTO misir.signal (
        artifact_id, space_id, subspace_id, user_id,
        vector, magnitude, signal_type,
        embedding_model, embedding_dimension,
        -- v1.1 Assignment Margin columns
        margin, updates_centroid,
        created_at
    ) VALUES (
        v_artifact_id, p_space_id, p_subspace_id, p_user_id,
        p_embedding, p_signal_magnitude, p_signal_type,
        v_embedding_model, v_embedding_dimension,
        p_margin, p_updates_centroid,
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