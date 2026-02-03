# Misir - Supabase Setup Guide

## Quick Setup

1. **Create Supabase Project**
   - Go to https://supabase.com
   - Click "New Project"
   - Choose a name and database password
   - Wait for setup to complete (~2 minutes)

2. **Get Your Credentials**
   - Go to Project Settings → API
   - Copy:
     - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
     - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. **Add to .env**
   ```bash
   NEXT_PUBLIC_SUPABASE_URL="https://xxxxx.supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGc..."
   ```

4. **Run Database Schema**
   - Go to Supabase Dashboard → SQL Editor
   - Click "New Query"
   - Copy contents of `lib/db/schema.sql`
   - Run it

5. **Enable Authentication (Optional for MVP)**
   - Go to Authentication → Providers
   - Enable Email provider
   - Configure settings

## Schema Overview

The schema creates:
- ✅ 5 tables (profiles, spaces, subspaces, artifacts, snapshots)
- ✅ Row Level Security (RLS) policies
- ✅ Proper indexes
- ✅ Auto-updating timestamps
- ✅ UUID primary keys

## Test Database Connection

```bash
npm run dev
```

Visit http://localhost:3000 - you should see the login page.

## Next Steps

- [x] Create a test user
- [x] Test API endpoints with Postman/Thunder Client
- [x] Implement auth integration
- [ ] Build browser extension

## Troubleshooting

**Error: Missing Supabase environment variables**
- Make sure `.env` file exists
- Check variable names match exactly
- Restart dev server after changing .env

**Error: relation "spaces" does not exist**
- Run the schema.sql in Supabase SQL Editor
- Check the query executed successfully

**RLS Policy Errors**
- For MVP without auth, you can disable RLS temporarily
- Run: `ALTER TABLE tablename DISABLE ROW LEVEL SECURITY;`
- Re-enable when implementing auth
