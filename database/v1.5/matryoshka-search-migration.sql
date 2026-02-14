-- ============================================================
-- MISIR SCHEMA v1.5 MIGRATION — Matryoshka Coarse-to-Fine Search
-- ============================================================
-- Version: 1.5.0
-- Date: February 2026
-- Purpose:
--   1) Keep 768d as canonical storage/ranking
--   2) Add 384d tier for fast candidate retrieval
--   3) Add Matryoshka RPCs for search + assignment margin
-- ============================================================

BEGIN;

-- ============================================================
-- PART 1: Add 384d shadow vectors
-- ============================================================

ALTER TABLE misir.signal
ADD COLUMN IF NOT EXISTS vector_384 vector(384);

ALTER TABLE misir.subspace
ADD COLUMN IF NOT EXISTS centroid_embedding_384 vector(384);

-- Helper: convert a vector to its first 384 dimensions.
-- Compatible with pgvector builds that do not support vector subscripting.
CREATE OR REPLACE FUNCTION misir.vector_prefix_384(p_vec vector)
RETURNS vector(384)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_out vector(384);
BEGIN
    IF p_vec IS NULL THEN
        RETURN NULL;
    END IF;

    IF vector_dims(p_vec) < 384 THEN
        RAISE EXCEPTION 'vector_prefix_384 expects >=384 dims, got %', vector_dims(p_vec);
    END IF;

    -- Preferred path for newer pgvector versions.
    BEGIN
        EXECUTE 'SELECT subvector($1, 1, 384)::vector(384)'
        INTO v_out
        USING p_vec;
        RETURN v_out;
    EXCEPTION
        WHEN undefined_function THEN
            -- Fallback path for older pgvector versions.
            RETURN (
                '[' || array_to_string(
                    (string_to_array(trim(both '[]' FROM p_vec::text), ','))[1:384],
                    ','
                ) || ']'
            )::vector(384);
    END;
END;
$$;

-- Backfill existing rows (idempotent)
UPDATE misir.signal s
SET vector_384 = misir.vector_prefix_384(s.vector)
WHERE s.vector IS NOT NULL
  AND s.vector_384 IS NULL;

UPDATE misir.subspace ss
SET centroid_embedding_384 = misir.vector_prefix_384(ss.centroid_embedding)
WHERE ss.centroid_embedding IS NOT NULL
  AND ss.centroid_embedding_384 IS NULL;

-- Fast ANN indexes for coarse stage
CREATE INDEX IF NOT EXISTS idx_signal_vector_384_hnsw
ON misir.signal USING hnsw (vector_384 vector_cosine_ops)
WHERE deleted_at IS NULL AND vector_384 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subspace_centroid_384_hnsw
ON misir.subspace USING hnsw (centroid_embedding_384 vector_cosine_ops)
WHERE centroid_embedding_384 IS NOT NULL;

-- ============================================================
-- PART 2: Keep 384d vectors in sync
-- ============================================================

CREATE OR REPLACE FUNCTION misir.sync_signal_vector_384()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.vector IS NULL THEN
        NEW.vector_384 := NULL;
    ELSE
        NEW.vector_384 := misir.vector_prefix_384(NEW.vector);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = misir, pg_catalog, public;

DROP TRIGGER IF EXISTS trg_sync_signal_vector_384 ON misir.signal;
CREATE TRIGGER trg_sync_signal_vector_384
    BEFORE INSERT OR UPDATE OF vector
    ON misir.signal
    FOR EACH ROW
    EXECUTE FUNCTION misir.sync_signal_vector_384();

CREATE OR REPLACE FUNCTION misir.sync_subspace_centroid_384()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.centroid_embedding IS NULL THEN
        NEW.centroid_embedding_384 := NULL;
    ELSE
        NEW.centroid_embedding_384 := misir.vector_prefix_384(NEW.centroid_embedding);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = misir, pg_catalog, public;

DROP TRIGGER IF EXISTS trg_sync_subspace_centroid_384 ON misir.subspace;
CREATE TRIGGER trg_sync_subspace_centroid_384
    BEFORE INSERT OR UPDATE OF centroid_embedding
    ON misir.subspace
    FOR EACH ROW
    EXECUTE FUNCTION misir.sync_subspace_centroid_384();

-- ============================================================
-- PART 3: Matryoshka coarse-to-fine search RPC
-- ============================================================

DROP FUNCTION IF EXISTS misir.search_signals_by_vector_matryoshka(
    vector(384), vector(768), UUID, INT, INT, INT, INT, FLOAT
);

CREATE OR REPLACE FUNCTION misir.search_signals_by_vector_matryoshka(
    p_query_vector_384 vector(384),
    p_query_vector_768 vector(768),
    p_user_id UUID,
    p_limit INT DEFAULT 20,
    p_prefilter_limit INT DEFAULT 200,
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
    url TEXT,
    content_preview TEXT,
    engagement_level TEXT,
    dwell_time_ms BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH coarse_candidates AS (
        SELECT
            s.id,
            s.artifact_id,
            s.space_id,
            s.subspace_id,
            s.vector
        FROM misir.signal s
        WHERE s.user_id = p_user_id
          AND s.deleted_at IS NULL
          AND s.vector IS NOT NULL
          AND s.vector_384 IS NOT NULL
          AND (p_space_id IS NULL OR s.space_id = p_space_id)
          AND (p_subspace_id IS NULL OR s.subspace_id = p_subspace_id)
        ORDER BY s.vector_384 <=> p_query_vector_384
        LIMIT GREATEST(p_limit, p_prefilter_limit)
    ),
    reranked AS (
        SELECT
            c.id AS signal_id,
            c.artifact_id,
            c.space_id,
            c.subspace_id,
            (c.vector <=> p_query_vector_768)::FLOAT AS distance
        FROM coarse_candidates c
        WHERE (c.vector <=> p_query_vector_768) < (1 - p_threshold)
        ORDER BY c.vector <=> p_query_vector_768
        LIMIT p_limit
    )
    SELECT
        r.signal_id,
        r.artifact_id,
        r.space_id,
        r.subspace_id,
        r.distance,
        a.title,
        a.url,
        LEFT(COALESCE(a.extracted_text, ''), 200) AS content_preview,
        a.engagement_level::TEXT,
        a.dwell_time_ms::BIGINT
    FROM reranked r
    JOIN misir.artifact a ON a.id = r.artifact_id
    WHERE a.deleted_at IS NULL
    ORDER BY r.distance;
END;
$$;

GRANT EXECUTE ON FUNCTION misir.search_signals_by_vector_matryoshka TO authenticated;

COMMENT ON FUNCTION misir.search_signals_by_vector_matryoshka IS
'Matryoshka coarse-to-fine semantic search:
 - Stage 1 (384d): fast ANN candidate retrieval
 - Stage 2 (768d): precise rerank and threshold filtering';

-- ============================================================
-- PART 4: Matryoshka assignment margin RPC
-- ============================================================

DROP FUNCTION IF EXISTS misir.calculate_assignment_margin_matryoshka(
    vector(384), vector(768), UUID, BIGINT
);

CREATE OR REPLACE FUNCTION misir.calculate_assignment_margin_matryoshka(
    p_signal_vector_384 vector(384),
    p_signal_vector_768 vector(768),
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
    SELECT COALESCE((value)::FLOAT, 0.05)
    INTO v_threshold
    FROM misir.system_config
    WHERE key = 'assignment_margin_threshold';

    IF v_threshold IS NULL THEN
        v_threshold := 0.05;
    END IF;

    RETURN QUERY
    WITH coarse_candidates AS (
        SELECT
            s.id,
            s.centroid_embedding
        FROM misir.subspace s
        WHERE s.user_id = p_user_id
          AND s.space_id = p_space_id
          AND s.centroid_embedding IS NOT NULL
        ORDER BY
            CASE
                WHEN s.centroid_embedding_384 IS NULL THEN 2.0
                ELSE (s.centroid_embedding_384 <=> p_signal_vector_384)
            END
        LIMIT 8
    ),
    top_2 AS (
        SELECT
            c.id,
            (c.centroid_embedding <=> p_signal_vector_768) AS distance
        FROM coarse_candidates c
        ORDER BY c.centroid_embedding <=> p_signal_vector_768
        LIMIT 2
    ),
    nearest AS (
        SELECT id, distance FROM top_2 ORDER BY distance LIMIT 1
    ),
    second AS (
        SELECT distance FROM top_2 ORDER BY distance OFFSET 1 LIMIT 1
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

GRANT EXECUTE ON FUNCTION misir.calculate_assignment_margin_matryoshka TO authenticated;

COMMENT ON FUNCTION misir.calculate_assignment_margin_matryoshka IS
'Matryoshka coarse-to-fine assignment margin:
 - Stage 1 (384d): shortlist nearest subspaces
 - Stage 2 (768d): final nearest/second distances and margin';

-- ============================================================
-- PART 5: Validation
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'misir'
          AND table_name = 'signal'
          AND column_name = 'vector_384'
    ) THEN
        RAISE EXCEPTION 'signal.vector_384 not found';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'misir'
          AND table_name = 'subspace'
          AND column_name = 'centroid_embedding_384'
    ) THEN
        RAISE EXCEPTION 'subspace.centroid_embedding_384 not found';
    END IF;
END $$;

COMMIT;
