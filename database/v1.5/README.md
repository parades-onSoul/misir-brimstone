# MISIR v1.5 — Matryoshka Coarse-to-Fine

This version adds a two-tier vector strategy and sensitivity tuning:

- `768d` remains canonical for storage/rerank (`signal.vector`, `subspace.centroid_embedding`)
- `384d` shadow vectors are added for fast prefilter (`signal.vector_384`, `subspace.centroid_embedding_384`)

## File

- `matryoshka-search-migration.sql`
- `sensitivity-tuning.sql`

## What It Adds

- New 384d columns + backfill
- HNSW indexes for 384d vectors
- Sync triggers to keep 384d columns consistent
- RPC: `misir.search_signals_by_vector_matryoshka(...)`
- RPC: `misir.calculate_assignment_margin_matryoshka(...)`

## Apply

```bash
psql misir -f database/v1.5/matryoshka-search-migration.sql
psql misir -f database/v1.5/sensitivity-tuning.sql
```
