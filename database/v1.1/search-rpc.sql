-- =============================================================================
-- MISIR v1.1 HELPER: search_signals_by_vector RPC
-- =============================================================================
-- This function enables ISS (Implicit Semantic Search) via HNSW index
-- Run this after the main v1.1 migration
-- =============================================================================

-- Drop if exists for idempotency
DROP FUNCTION IF EXISTS misir.search_signals_by_vector(vector(768), UUID, INT, INT, INT, FLOAT);

CREATE OR REPLACE FUNCTION misir.search_signals_by_vector(
    p_query_vector vector(768),
    p_user_id UUID,
    p_limit INT DEFAULT 20,
    p_space_id INT DEFAULT NULL,
    p_subspace_id INT DEFAULT NULL,
    p_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    signal_id BIGINT,
    artifact_id BIGINT,
    space_id BIGINT,
    subspace_id BIGINT,
    distance FLOAT,
    title TEXT,
    url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id AS signal_id,
        s.artifact_id,
        s.space_id,
        s.subspace_id,
        (s.vector <=> p_query_vector)::FLOAT AS distance,
        a.title,
        a.url
    FROM misir.signal s
    JOIN misir.artifact a ON a.id = s.artifact_id
    WHERE s.user_id = p_user_id
      AND s.deleted_at IS NULL
      AND a.deleted_at IS NULL
      -- Optional space filter
      AND (p_space_id IS NULL OR s.space_id = p_space_id)
      -- Optional subspace filter
      AND (p_subspace_id IS NULL OR s.subspace_id = p_subspace_id)
      -- Similarity threshold (distance < 1 - threshold)
      AND (s.vector <=> p_query_vector) < (1 - p_threshold)
    ORDER BY s.vector <=> p_query_vector
    LIMIT p_limit;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION misir.search_signals_by_vector TO authenticated;

-- Add comment
COMMENT ON FUNCTION misir.search_signals_by_vector IS 
'ISS (Implicit Semantic Search) - Vector similarity search using HNSW index.
Parameters:
  - p_query_vector: Query embedding (768 dimensions)
  - p_user_id: User ID for RLS
  - p_limit: Max results (default 20)
  - p_space_id: Optional space filter
  - p_subspace_id: Optional subspace filter
  - p_threshold: Min similarity 0-1 (default 0.7)
Returns: signal_id, artifact_id, space_id, subspace_id, distance, title, url';

-- =============================================================================
-- VERIFICATION
-- =============================================================================
-- Test the function exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'search_signals_by_vector' 
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'misir')
    ) THEN
        RAISE EXCEPTION 'Function search_signals_by_vector was not created';
    END IF;
    
    RAISE NOTICE '✓ search_signals_by_vector RPC created successfully';
END $$;
