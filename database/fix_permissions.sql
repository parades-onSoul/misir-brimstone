-- ============================================================================
-- FIX: Grant service_role permissions on misir schema tables
-- ============================================================================
-- This grants service_role full access to bypass RLS for backend operations
-- Run this in your Supabase SQL Editor
-- ============================================================================

BEGIN;

-- Grant all privileges on all tables in misir schema to service_role
GRANT ALL ON ALL TABLES IN SCHEMA misir TO service_role;

-- Grant all privileges on all sequences in misir schema to service_role
GRANT ALL ON ALL SEQUENCES IN SCHEMA misir TO service_role;

-- Grant execute on all functions in misir schema to service_role
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA misir TO service_role;

-- Make these grants apply to future tables/sequences/functions as well
ALTER DEFAULT PRIVILEGES IN SCHEMA misir GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA misir GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA misir GRANT EXECUTE ON FUNCTIONS TO service_role;

COMMIT;

-- Verify grants
SELECT 
    grantee, 
    table_schema, 
    table_name, 
    privilege_type 
FROM information_schema.table_privileges 
WHERE table_schema = 'misir' AND grantee = 'service_role'
ORDER BY table_name, privilege_type;
