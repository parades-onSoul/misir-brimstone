-- ============================================================================
-- Supabase Signal Verification Script
-- Purpose: Verify PDFs are correctly saved as signals in the database
-- ============================================================================

-- Check recent PDF artifacts (last 24 hours)
SELECT 
  a.id as artifact_id,
  a.title,
  a.url,
  a.content_source,
  a.artifact_type,
  a.word_count,
  a.relevance,
  a.created_at,
  a.space_id,
  a.subspace_id,
  s.id as signal_id,
  s.magnitude,
  s.signal_type,
  vector_dims(s.vector) as embedding_dimension,
  s.created_at as signal_created_at
FROM artifacts a
LEFT JOIN signals s ON s.artifact_id = a.id
WHERE a.content_source = 'document'
  AND a.created_at > NOW() - INTERVAL '24 hours'
ORDER BY a.created_at DESC
LIMIT 20;

-- ============================================================================
-- Verify signal properties
-- ============================================================================

-- Check if signals have correct embedding dimensions (should be 384)
SELECT 
  s.id,
  s.artifact_id,
  vector_dims(s.vector) as dimension,
  s.magnitude,
  s.signal_type,
  s.source_type,
  s.model_version,
  s.embedding_dimension
FROM signals s
JOIN artifacts a ON a.id = s.artifact_id
WHERE a.content_source = 'document'
  AND s.created_at > NOW() - INTERVAL '24 hours'
ORDER BY s.created_at DESC;

-- ============================================================================
-- Check for any errors or missing signals
-- ============================================================================

-- Artifacts without signals (should be empty!)
SELECT 
  a.id,
  a.title,
  a.url,
  a.content_source,
  a.created_at
FROM artifacts a
LEFT JOIN signals s ON s.artifact_id = a.id
WHERE a.content_source = 'document'
  AND s.id IS NULL
  AND a.created_at > NOW() - INTERVAL '24 hours';

-- ============================================================================
-- Verify centroid history is being updated
-- ============================================================================

-- Check recent centroid updates for subspaces with PDF signals
SELECT 
  ch.id,
  ch.subspace_id,
  ss.name as subspace_name,
  ch.artifact_count,
  ch.signal_count,
  ch.confidence,
  vector_dims(ch.centroid) as centroid_dimension,
  ch.computed_at
FROM centroid_history ch
JOIN subspaces ss ON ss.id = ch.subspace_id
WHERE ch.computed_at > NOW() - INTERVAL '24 hours'
ORDER BY ch.computed_at DESC
LIMIT 10;

-- ============================================================================
-- Summary statistics
-- ============================================================================

-- PDF ingestion stats
SELECT 
  COUNT(DISTINCT a.id) as total_pdf_artifacts,
  COUNT(DISTINCT s.id) as total_pdf_signals,
  AVG(a.word_count) as avg_word_count,
  AVG(a.relevance) as avg_relevance,
  AVG(s.magnitude) as avg_signal_magnitude
FROM artifacts a
LEFT JOIN signals s ON s.artifact_id = a.id
WHERE a.content_source = 'document'
  AND a.created_at > NOW() - INTERVAL '7 days';
