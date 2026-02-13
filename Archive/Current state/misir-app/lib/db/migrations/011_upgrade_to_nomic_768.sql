-- ============================================================================
-- Migration: Upgrade Vector Embeddings from 384-dim to 768-dim (Nomic)
-- ============================================================================
-- Purpose: Upgrade from BGE-small-en (384 dimensions) to Nomic-embed-text-v1.5 (768 dimensions)
-- 
-- IMPORTANT: Run this AFTER deleting all existing spaces/subspaces/markers
-- since their embeddings are the wrong dimension.
-- ============================================================================

-- Step 1: Drop existing vector indexes
DROP INDEX IF EXISTS spaces_embedding_idx;
DROP INDEX IF EXISTS markers_embedding_idx;
DROP INDEX IF EXISTS subspaces_centroid_embedding_idx;
DROP INDEX IF EXISTS artifacts_content_embedding_idx;

-- Step 2: Alter vector columns from 384 to 768 dimensions
-- Spaces
ALTER TABLE spaces 
ALTER COLUMN embedding TYPE vector(768);

-- Markers
ALTER TABLE markers 
ALTER COLUMN embedding TYPE vector(768);

-- Subspaces (centroid embedding)
ALTER TABLE subspaces 
ALTER COLUMN centroid_embedding TYPE vector(768);

-- Artifacts (content embedding)
ALTER TABLE artifacts 
ALTER COLUMN content_embedding TYPE vector(768);

-- Step 3: Recreate HNSW indexes for fast similarity search
-- HNSW is faster than IVFFlat for our use case
CREATE INDEX spaces_embedding_idx ON spaces 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX markers_embedding_idx ON markers 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX subspaces_centroid_embedding_idx ON subspaces 
USING hnsw (centroid_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX artifacts_content_embedding_idx ON artifacts 
USING hnsw (content_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Step 4: Update metadata (optional - for tracking)
COMMENT ON COLUMN spaces.embedding IS 'Nomic-embed-text-v1.5 768-dim embedding';
COMMENT ON COLUMN markers.embedding IS 'Nomic-embed-text-v1.5 768-dim embedding';
COMMENT ON COLUMN subspaces.centroid_embedding IS 'Nomic-embed-text-v1.5 768-dim centroid';
COMMENT ON COLUMN artifacts.content_embedding IS 'Nomic-embed-text-v1.5 768-dim content embedding';
