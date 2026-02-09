# Database v1.2 - SourceType Alignment

**Date:** February 4, 2026  
**Status:** Ready to Apply

## Summary

Aligns the `misir.content_source` enum with the backend `SourceType` definition.

## Changes

### Engagement Level Enum

| Old Value | New Value | Reason |
| :--- | :--- | :--- |
| `ambient` | `latent` | Better terminology (passive exposure) |
| `engaged` | `engaged` | Unchanged |
| `committed` | `saturated` | More precise (deep immersion) |
| - | `discovered` | New level (active awareness) |

**Final Values:** `latent`, `discovered`, `engaged`, `saturated`

### Content Source Enum

| Old Value | New Value | Reason |
| :--- | :--- | :--- |
| `ai` | `chat` | More specific (AI Chat logs) |
| `document` | `pdf` | More specific (PDF files) |
| `web` | `web` | Unchanged |
| `video` | `video` | Unchanged |
| `note` | `note` | Unchanged |
| - | `other` | Added fallback type |

**Final Values:** `web`, `pdf`, `video`, `chat`, `note`, `other`

## Migration Steps

**Part 1: Engagement Level**
1.  Create new enum type `engagement_level_v2`.
2.  Convert artifact column to text.
3.  Transform `ambient` → `latent`, `committed` → `saturated`.
4.  Convert column to new enum.

**Part 2: Content Source**
5.  Create new enum type `content_source_v2`.
6.  Convert artifact column to text.
7.  Transform `ai` → `chat`, `document` → `pdf`.
8.  Convert column to new enum.

**Part 3: Cleanup**
9.  Drop old RPC function(s).
10. Drop old enum types.
11. Rename new enums to original names.
12. Restore default constraints.
13. Recreate `insert_artifact_with_signal` RPC function.

## How to Apply

```bash
# Connect to Supabase and run
psql -h <host> -U postgres -d postgres -f database/v1.2/migration.sql
```

Or use Supabase SQL Editor to paste and execute.

## Verification

After applying, run:
```sql
-- Check engagement_level enum
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'misir.engagement_level'::regtype ORDER BY enumsortorder;

-- Check content_source enum
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'misir.content_source'::regtype ORDER BY enumsortorder;
```

**Expected Output:**

**engagement_level:**
```
latent
discovered
engaged
saturated
```

**content_source:**
```
web
pdf
video
chat
note
other
```

## Status

✅ **Applied:** February 4, 2026  
✅ **Tests Passing:** All 26 backend tests pass  
✅ **Production Ready**
