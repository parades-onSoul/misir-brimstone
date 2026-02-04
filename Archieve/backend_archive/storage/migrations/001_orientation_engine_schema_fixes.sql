-- ============================================================================
-- Migration: Orientation Engine Schema Fixes
-- Purpose: Add centroid history, drift tracking, signal metadata
-- Date: 2026-01-24
-- pgvector: Required
-- Supabase: Compatible
-- ============================================================================

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 1. CENTROID HISTORY TABLE
-- ============================================================================
-- Stores historical centroid positions to track drift over time
-- Critical for orientation engine's "reproducible drift" principle

CREATE TABLE IF NOT EXISTS public.centroid_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subspace_id uuid NOT NULL REFERENCES public.subspaces(id) ON DELETE CASCADE,
  centroid vector(384) NOT NULL,  -- Matches bge-small-en-v1.5
  artifact_count integer NOT NULL DEFAULT 0,
  signal_count integer NOT NULL DEFAULT 0,
  confidence double precision DEFAULT 0.0,  -- 0-1, quality of centroid
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.centroid_history IS 'Historical centroid positions for tracking drift over time';
COMMENT ON COLUMN public.centroid_history.centroid IS 'Computed center of mass at this point in time (384-dim from bge-small-en-v1.5)';
COMMENT ON COLUMN public.centroid_history.artifact_count IS 'Number of artifacts used to compute this centroid';
COMMENT ON COLUMN public.centroid_history.confidence IS 'Quality metric: higher = more coherent cluster';

-- Index for time-series queries
CREATE INDEX idx_centroid_history_subspace_time ON public.centroid_history(subspace_id, computed_at DESC);
CREATE INDEX idx_centroid_history_computed_at ON public.centroid_history(computed_at DESC);

-- ============================================================================
-- 2. DRIFT MEASUREMENTS TABLE
-- ============================================================================
-- Stores calculated drift between centroid positions
-- Enables "mathematically grounded reports" on orientation changes

CREATE TABLE IF NOT EXISTS public.drift_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subspace_id uuid NOT NULL REFERENCES public.subspaces(id) ON DELETE CASCADE,
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  drift_magnitude double precision NOT NULL,  -- ||current - previous||
  drift_vector vector(384) NOT NULL,  -- Direction of movement
  previous_centroid_id uuid REFERENCES public.centroid_history(id),
  current_centroid_id uuid REFERENCES public.centroid_history(id),
  signal_count integer NOT NULL DEFAULT 0,  -- Signals in this period
  artifact_count integer NOT NULL DEFAULT 0,  -- Artifacts in this period
  velocity double precision,  -- Drift per day
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.drift_measurements IS 'Calculated drift between centroid positions over time';
COMMENT ON COLUMN public.drift_measurements.drift_magnitude IS 'Euclidean distance between previous and current centroid';
COMMENT ON COLUMN public.drift_measurements.drift_vector IS 'Vector representing direction and magnitude of change';
COMMENT ON COLUMN public.drift_measurements.velocity IS 'Drift magnitude normalized by time period (drift per day)';

-- Indexes for report generation
CREATE INDEX idx_drift_measurements_subspace_time ON public.drift_measurements(subspace_id, period_end DESC);
CREATE INDEX idx_drift_measurements_space_time ON public.drift_measurements(space_id, period_end DESC);
CREATE INDEX idx_drift_measurements_period ON public.drift_measurements(period_start, period_end);

-- ============================================================================
-- 3. ADD SIGNAL METADATA COLUMNS
-- ============================================================================
-- Adds auditability to signals: track where they came from and how generated

ALTER TABLE public.signals 
  ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'extension' 
    CHECK (source_type IN ('extension', 'backend', 'batch', 'reprocessing')),
  ADD COLUMN IF NOT EXISTS model_version text DEFAULT 'bge-small-en-v1.5',
  ADD COLUMN IF NOT EXISTS embedding_dimension integer DEFAULT 384,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.signals.source_type IS 'Where signal originated: extension (client-side), backend, batch job, etc.';
COMMENT ON COLUMN public.signals.model_version IS 'Embedding model used to generate vector (e.g., bge-small-en-v1.5)';
COMMENT ON COLUMN public.signals.embedding_dimension IS 'Dimensionality of vector (384 for bge-small, 1024 for bge-large)';
COMMENT ON COLUMN public.signals.metadata IS 'Flexible JSON field for additional signal context';

-- ============================================================================
-- 4. CLARIFY EXISTING COLUMNS WITH COMMENTS
-- ============================================================================

-- Artifacts table clarifications
COMMENT ON COLUMN public.artifacts.content_embedding IS 'Extension-computed embedding of the content user read (384-dim from bge-small-en-v1.5)';
COMMENT ON COLUMN public.artifacts.relevance IS 'Cosine similarity score from extension AI matching (0-1)';
COMMENT ON COLUMN public.artifacts.reading_depth IS 'Engagement multiplier: 0=bounce, 0.5=skim, 1.0=browse, 1.5=deep read';
COMMENT ON COLUMN public.artifacts.base_weight IS 'Artifact type weight: 0.2=ambient, 1.0=engaged, 2.0=committed';

-- Subspaces table clarifications
COMMENT ON COLUMN public.subspaces.embedding IS 'Initial subspace embedding from name + markers (for matching)';
COMMENT ON COLUMN public.subspaces.centroid_embedding IS 'CURRENT computed centroid from artifact signals (updates over time)';
COMMENT ON COLUMN public.subspaces.centroid_artifact_count IS 'Number of artifacts used to compute current centroid';

-- Space states clarifications
COMMENT ON COLUMN public.space_states.evidence IS 'Total accumulated signal magnitude (sum of all signal.magnitude values)';

-- Signals table clarifications
COMMENT ON COLUMN public.signals.vector IS 'Embedding vector for centroid calculation (384-dim from extension or backend)';
COMMENT ON COLUMN public.signals.magnitude IS 'Signal weight for orientation engine: base_weight × relevance × reading_depth';
COMMENT ON COLUMN public.signals.signal_type IS 'Signal category: semantic, temporal, behavioral, structural';

-- ============================================================================
-- 5. ADD PERFORMANCE INDEXES
-- ============================================================================

-- Signals indexes for centroid computation
CREATE INDEX IF NOT EXISTS idx_signals_space_id ON public.signals(space_id);
CREATE INDEX IF NOT EXISTS idx_signals_subspace_id ON public.signals(subspace_id);
CREATE INDEX IF NOT EXISTS idx_signals_created_at ON public.signals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_artifact_id ON public.signals(artifact_id);

-- Artifacts indexes for report generation
CREATE INDEX IF NOT EXISTS idx_artifacts_space_id ON public.artifacts(space_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_subspace_id ON public.artifacts(subspace_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_created_at ON public.artifacts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifacts_user_space ON public.artifacts(user_id, space_id);

-- Subspaces indexes
CREATE INDEX IF NOT EXISTS idx_subspaces_space_id ON public.subspaces(space_id);
CREATE INDEX IF NOT EXISTS idx_subspaces_user_id ON public.subspaces(user_id);

-- ============================================================================
-- 6. ADD PROCESSING JOBS TABLE (for batch operations)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL CHECK (job_type IN (
    'compute_centroids', 
    'calculate_drift', 
    'generate_report',
    'reprocess_artifacts',
    'cleanup'
  )),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  space_id uuid REFERENCES public.spaces(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 
    'running', 
    'completed', 
    'failed', 
    'cancelled'
  )),
  progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  started_at timestamptz,
  completed_at timestamptz,
  result jsonb DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.processing_jobs IS 'Tracks long-running backend batch jobs (centroid computation, drift calculation, etc.)';
COMMENT ON COLUMN public.processing_jobs.progress IS 'Job completion percentage (0-100)';

CREATE INDEX idx_processing_jobs_user_status ON public.processing_jobs(user_id, status);
CREATE INDEX idx_processing_jobs_created_at ON public.processing_jobs(created_at DESC);

-- ============================================================================
-- 7. HELPER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to processing_jobs
DROP TRIGGER IF EXISTS update_processing_jobs_updated_at ON public.processing_jobs;
CREATE TRIGGER update_processing_jobs_updated_at
  BEFORE UPDATE ON public.processing_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE public.centroid_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drift_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;

-- Centroid History: Users can only see history for their subspaces
CREATE POLICY "Users can view their own centroid history" ON public.centroid_history
  FOR SELECT USING (
    subspace_id IN (
      SELECT id FROM public.subspaces WHERE user_id = auth.uid()
    )
  );

-- Drift Measurements: Users can only see drift for their spaces
CREATE POLICY "Users can view their own drift measurements" ON public.drift_measurements
  FOR SELECT USING (
    space_id IN (
      SELECT id FROM public.spaces WHERE user_id = auth.uid()
    )
  );

-- Processing Jobs: Users can view and update their own jobs
CREATE POLICY "Users can view their own jobs" ON public.processing_jobs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own jobs" ON public.processing_jobs
  FOR UPDATE USING (user_id = auth.uid());

-- ============================================================================
-- 9. MIGRATION VERIFICATION
-- ============================================================================

-- Insert a test record to verify vector columns work
DO $$
BEGIN
  -- This will fail if pgvector is not properly configured
  PERFORM vector_dims(ARRAY[0.1, 0.2, 0.3]::vector);
  RAISE NOTICE 'pgvector is properly configured';
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'pgvector is NOT properly configured: %', SQLERRM;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 001_orientation_engine_schema_fixes completed successfully';
  RAISE NOTICE '   - Added centroid_history table';
  RAISE NOTICE '   - Added drift_measurements table';
  RAISE NOTICE '   - Added signal metadata columns';
  RAISE NOTICE '   - Added processing_jobs table';
  RAISE NOTICE '   - Added performance indexes';
  RAISE NOTICE '   - Added RLS policies';
END $$;
