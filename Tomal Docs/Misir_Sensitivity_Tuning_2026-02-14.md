# Misir Sensitivity Tuning (2026-02-14)

## Why this tuning was needed
- Real captures were marked relevant by users but did not consistently update topic progress.
- Assignment margin frequently came in low (`margin < 0.1`), causing `updates_centroid = false`.
- Auto-capture gate was too strict for many article pages because classifier confidence often stays below `0.7`.

## What was changed

### 1. Assignment margin sensitivity (backend + DB)
- Target: allow earlier centroid updates in young/overlapping spaces.
- Change:
  - `assignment_margin_threshold` tuned from `0.10` to `0.05`.
  - Backend fallback default aligned to `0.05` in `backend/infrastructure/services/margin_service.py`.
  - Added SQL script: `database/v1.5/sensitivity-tuning.sql`.

### 2. Auto-capture relevance gate (extension)
- Target: reduce false negatives for relevant article captures.
- Change:
  - `autoCaptureConfidenceThreshold` default tuned from `0.70` to `0.55`.
  - Updated in:
    - `extension/src/types.ts`
    - `extension/src/api/client.ts` (fallback normalization)
    - `extension/src/background/index.ts` (install defaults)
    - `extension/src/settings/App.tsx` (UI fallback)

### 3. Search threshold sensitivity (API + frontend defaults)
- Target: increase recall for semantic search in sparse/early datasets.
- Change:
  - Backend default query threshold from `0.70` to `0.55`:
    - `backend/interfaces/api/search.py`
    - `backend/application/handlers/search_handler.py`
  - Frontend default search filter threshold from `0.70` to `0.55`:
    - `frontend/lib/stores/search.ts`
    - `frontend/app/(dashboard)/dashboard/search/page.tsx`

### 4. Analytics bug fix affecting model behavior interpretation
- File: `backend/infrastructure/services/subspace_analytics.py`
- Fixes:
  - Removed drift-threshold overwrite bug (`self.drift_threshold` was being overwritten with `None`).
  - Added missing `timezone` import for UTC timestamps in drift/velocity event creation.

### 5. Frontend focus-band normalization
- Target: keep UI interpretation aligned with tuned backend/extension thresholds.
- Change:
  - Added shared focus constants in `frontend/lib/focus-thresholds.ts`.
  - Replaced duplicated confidence cutoffs in:
    - `frontend/lib/colors.ts`
    - `frontend/lib/formatters.ts`
    - `frontend/components/space/coverage-analysis.tsx`
    - `frontend/components/space/knowledge-map.tsx`
    - `frontend/app/(dashboard)/dashboard/analytics/page.tsx`

## DB actions required
Run:

```sql
-- v1.5 Matryoshka migration (if not already applied)
-- database/v1.5/matryoshka-search-migration.sql

-- Sensitivity tuning
-- database/v1.5/sensitivity-tuning.sql
```

## Expected impact
- More captures should contribute to subspace progression.
- Fewer “stuck at zero progress” cases in Topic Areas / Focus history for active reading.
- Better semantic search recall at default settings.

## Monitoring checklist (first 72 hours)
- `updates_centroid` rate should rise (not necessarily near 100%).
- Average margin should remain > 0, with fewer near-zero blocks.
- Auto-capture success rate should increase without obvious noise spikes.
- Search result counts for normal queries should improve with acceptable relevance.

## Rollback knobs (if over-sensitive)
- Raise `assignment_margin_threshold` from `0.05` toward `0.08` or `0.10`.
- Raise extension auto-capture threshold from `0.55` toward `0.60` or `0.65`.
- Raise search default threshold from `0.55` toward `0.65`.
