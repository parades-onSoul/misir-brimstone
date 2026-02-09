# Misir Database Schema v1.1 — Assignment Margin

> **Version:** 1.1.0  
> **Date:** February 2026  
> **Upgrade From:** v1.0  
> **Backward Compatible:** ✅ Yes

---

## Overview

v1.1 introduces **Assignment Margin** — a critical algorithm upgrade that prevents centroid pollution from ambiguous signals at scale.

### The Problem (v1.0)

In v1.0, every signal updates the centroid of its assigned subspace. When a signal is equidistant from multiple subspaces (e.g., an article about "React Native" between "React" and "Mobile Dev"), it pollutes both centroids with ambiguous meaning.

**Impact at scale:**
- < 100 signals: Minimal impact
- 100-1000 signals: Noticeable drift
- 1000+ signals: Chaotic centroid behavior

### The Solution (v1.1)

**Assignment Margin Rule:**
```
margin = d₂ − d₁
```
- `d₁` = distance to nearest centroid
- `d₂` = distance to second-nearest centroid
- If `margin < threshold` → signal does NOT update centroid

---

## Schema Changes

### New Columns on `signal`

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `margin` | FLOAT | NULL | Assignment margin (d₂ - d₁) |
| `updates_centroid` | BOOLEAN | TRUE | Whether signal updated centroid |

### New Config Key

| Key | Value | Description |
|-----|-------|-------------|
| `assignment_margin_threshold` | `0.1` | Minimum margin for centroid update |

### New Indexes

| Index | Purpose |
|-------|---------|
| `idx_signal_updates_centroid` | Filter by centroid-updating signals |
| `idx_signal_margin` | Query by margin value |
| `idx_signal_subspace_margin` | Per-subspace margin analysis |

---

## Modified Functions

### `update_subspace_centroid()` Trigger

**New behavior:**
1. Check `updates_centroid` flag first
2. If `FALSE` → skip centroid update, return early
3. If `TRUE` → proceed with EMA update

**Signal count semantics:**
- `v_total_signal_count` → Total signals (for history)
- `v_centroid_signal_count` → Signals that update centroid (for confidence)

### `calculate_assignment_margin()` RPC

New helper function to calculate margin before signal insertion.

**Input:**
- `p_signal_vector` — The embedding vector
- `p_user_id` — User ID
- `p_space_id` — Space ID

**Output:**
| Column | Type | Description |
|--------|------|-------------|
| `nearest_subspace_id` | BIGINT | ID of nearest subspace |
| `nearest_distance` | FLOAT | d₁ |
| `second_distance` | FLOAT | d₂ |
| `margin` | FLOAT | d₂ - d₁ |
| `updates_centroid` | BOOLEAN | margin ≥ threshold |

---

## Migration Guide

### Pre-Migration Checklist

- [ ] Backup database
- [ ] Verify v1.0 is deployed
- [ ] Review application code compatibility

### Run Migration

```bash
# 1. Backup
pg_dump misir > backup_pre_v1.1_$(date +%Y%m%d).sql

# 2. Deploy
psql misir -f v1.1-assignment-margin-migration.sql

# 3. Verify
psql misir -c "SELECT column_name FROM information_schema.columns 
WHERE table_schema = 'misir' AND table_name = 'signal' 
AND column_name IN ('margin', 'updates_centroid');"
```

### Post-Migration

Existing signals have `updates_centroid = TRUE` by default (no historical data loss).

---

## Application Integration

### Backend Changes Required

1. **Before inserting signal:**
   ```python
   result = margin_service.calculate_margin(
       signal_vector, user_id, space_id
   )
   ```

2. **Include in signal insert:**
   ```python
   params = {
       'p_margin': result.margin,
       'p_updates_centroid': result.updates_centroid,
       # ... other params
   }
   ```

### Extension Changes (Optional)

No changes required — extension sends signals as before. Backend calculates margin.

---

## Monitoring

### Margin Distribution Query

```sql
SELECT 
    CASE 
        WHEN margin < 0.1 THEN 'ambiguous'
        WHEN margin < 0.2 THEN 'low'
        WHEN margin < 0.5 THEN 'medium'
        ELSE 'high'
    END AS category,
    COUNT(*) as count,
    ROUND(AVG(margin)::NUMERIC, 3) as avg_margin
FROM misir.signal
WHERE margin IS NOT NULL
GROUP BY category
ORDER BY avg_margin;
```

### Centroid Update Rate

```sql
SELECT 
    subspace_id,
    COUNT(*) as total,
    SUM(CASE WHEN updates_centroid THEN 1 ELSE 0 END) as updated,
    ROUND((SUM(CASE WHEN updates_centroid THEN 1 ELSE 0 END)::FLOAT / COUNT(*)) * 100, 1) as rate
FROM misir.signal
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY subspace_id
ORDER BY total DESC;
```

---

## Tuning

### If update rate < 50%
Too restrictive — lower threshold:
```sql
UPDATE misir.system_config
SET value = '0.05'
WHERE key = 'assignment_margin_threshold';
```

### If update rate > 95%
Too permissive — raise threshold:
```sql
UPDATE misir.system_config
SET value = '0.15'
WHERE key = 'assignment_margin_threshold';
```

---

## Technical Details

### Why Element-Wise Vector Arithmetic?

PostgreSQL pgvector doesn't support `scalar * vector` operations directly:
```sql
-- ❌ This fails
v_new := (1 - α) * v_old + α * v_new;

-- ✅ This works
v_new := (
    SELECT ARRAY_AGG(
        (1 - α) * v_old[i] + α * v_new[i]
    )::vector(768)
    FROM generate_series(1, 768) AS i
);
```

### Why Two Signal Counts?

| Count | Used For | Meaning |
|-------|----------|---------|
| `v_total_signal_count` | History logging | All signals received |
| `v_centroid_signal_count` | Confidence calculation | Signals that influenced centroid |

This preserves the semantic distinction between "information received" and "information used."

---

## Files

| File | Purpose |
|------|---------|
| [`migration.sql`](migration.sql) | Migration script |
| [`../../backend/infrastructure/services/margin_service.py`](../../backend/infrastructure/services/margin_service.py) | Margin calculation service |
| [`../../backend/domain/commands/capture.py`](../../backend/domain/commands/capture.py) | Command with margin fields |

---

## Rollback

If issues occur, rollback columns only:

```sql
ALTER TABLE misir.signal DROP COLUMN IF EXISTS margin;
ALTER TABLE misir.signal DROP COLUMN IF EXISTS updates_centroid;
DELETE FROM misir.system_config WHERE key = 'assignment_margin_threshold';
```

> **Note:** Rollback does not restore original trigger function. Keep backup.
