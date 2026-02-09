-- Migration: Simplify content_source to 4 values
-- Date: 2026-01-27
-- Description: Change content_source from ('blog', 'video', 'ai', 'document', 'note') 
--              to simplified ('web', 'ai', 'video', 'pdf')

-- ============================================================================
-- STEP 1: Migrate existing data to new values
-- ============================================================================

-- Map old values to new values
UPDATE public.artifacts
SET content_source = CASE content_source
    WHEN 'blog' THEN 'web'
    WHEN 'document' THEN 'web'
    WHEN 'note' THEN 'web'
    WHEN 'video' THEN 'video'
    WHEN 'ai' THEN 'ai'
    ELSE 'web'
END
WHERE content_source NOT IN ('web', 'ai', 'video', 'pdf');

-- ============================================================================
-- STEP 2: Drop old constraint and add new one
-- ============================================================================

-- Drop the existing CHECK constraint (actual name from database)
ALTER TABLE public.artifacts
DROP CONSTRAINT IF EXISTS check_content_source;

-- Also try the other possible name
ALTER TABLE public.artifacts
DROP CONSTRAINT IF EXISTS artifacts_content_source_check;

-- Add new simplified CHECK constraint
ALTER TABLE public.artifacts
ADD CONSTRAINT check_content_source 
CHECK (content_source = ANY (ARRAY['web'::text, 'ai'::text, 'video'::text, 'pdf'::text]));

-- ============================================================================
-- STEP 3: Update default value
-- ============================================================================

ALTER TABLE public.artifacts
ALTER COLUMN content_source SET DEFAULT 'web'::text;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check the constraint is applied
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.artifacts'::regclass
AND conname = 'artifacts_content_source_check';

-- Check distribution of content_source values
SELECT content_source, COUNT(*) as count
FROM public.artifacts
GROUP BY content_source
ORDER BY count DESC;
