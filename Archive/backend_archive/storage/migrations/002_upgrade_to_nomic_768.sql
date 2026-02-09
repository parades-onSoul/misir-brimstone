-- ============================================================================
-- MIGRATION 002: Upgrade Vector Dimensions from 384 to 768
-- ============================================================================
-- Reason: Switching from BGE-small-en-v1.5 (384-dim) to Nomic-embed-text-v1.5 (768-dim)
-- 
-- Benefits of Nomic:
--   - 8192 token context window (vs 512 for BGE)
--   - Better long-document handling
--   - Matryoshka dimensionality support
--
-- WARNING: This migration will DROP existing embeddings!
-- All artifacts must be re-embedded after this migration.
-- ============================================================================

-- 1. Drop indexes that depend on vector columns
DROP INDEX IF EXISTS idx_signals_vector;
DROP INDEX IF EXISTS idx_spaces_centroid;
DROP INDEX IF EXISTS idx_artifacts_embedding;

-- 2. Alter spaces.centroid from vector(384) to vector(768)
ALTER TABLE public.spaces 
  ALTER COLUMN centroid TYPE vector(768) 
  USING NULL;  -- Set existing centroids to NULL (must be recomputed)

-- 3. Alter signals.vector from vector(384) to vector(768)
ALTER TABLE public.signals 
  ALTER COLUMN vector TYPE vector(768) 
  USING NULL;  -- Set existing vectors to NULL

-- 4. If artifacts table has content_embedding, update it too
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'artifacts' 
    AND column_name = 'content_embedding'
  ) THEN
    ALTER TABLE public.artifacts 
      ALTER COLUMN content_embedding TYPE vector(768) 
      USING NULL;
  END IF;
END $$;

-- 5. If centroid_history exists, update it
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'centroid_history'
  ) THEN
    ALTER TABLE public.centroid_history 
      ALTER COLUMN centroid TYPE vector(768) 
      USING NULL;
  END IF;
END $$;

-- 6. If drift_events exists, update drift_vector
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'drift_events'
  ) THEN
    ALTER TABLE public.drift_events 
      ALTER COLUMN drift_vector TYPE vector(768) 
      USING NULL;
  END IF;
END $$;

-- 7. Recreate HNSW indexes for vector similarity search
CREATE INDEX idx_signals_vector 
  ON public.signals 
  USING hnsw (vector vector_cosine_ops);

-- 8. Update column comments to reflect new model
COMMENT ON COLUMN public.spaces.centroid IS 'Space centroid embedding (768-dim from nomic-embed-text-v1.5)';
COMMENT ON COLUMN public.signals.vector IS 'Signal embedding vector (768-dim from nomic-embed-text-v1.5)';

-- 9. Update embedding_dimension defaults if column exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'signals' 
    AND column_name = 'embedding_dimension'
  ) THEN
    ALTER TABLE public.signals 
      ALTER COLUMN embedding_dimension SET DEFAULT 768;
    
    COMMENT ON COLUMN public.signals.embedding_dimension IS 'Dimensionality of vector (768 for nomic-embed-text-v1.5)';
  END IF;
END $$;

-- ============================================================================
-- POST-MIGRATION STEPS (must be run from application):
-- ============================================================================
-- 1. Re-embed all artifacts using Nomic model:
--    python scripts/reembed_all_artifacts.py
--
-- 2. Recompute all space centroids:
--    python scripts/recompute_centroids.py
--
-- 3. Verify dimensions:
--    SELECT array_length(vector, 1) FROM signals LIMIT 1;  -- Should return 768
-- ============================================================================
