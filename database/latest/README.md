# Misir Database Schema — Latest

> **Current Version:** v1.4 (with v1.0 as base)  
> **Codename:** shiro.exe  
> **Date:** February 2026

---

## Quick Links

| Version | Description | Status |
|---------|-------------|--------|
| [**v1.4**](../v1.4/) | Analytics Support | ✅ Latest |
| [v1.3](../v1.3/) | Webhook Support | 📦 Stable |
| [v1.2](../v1.2/) | Enum Alignment | 📦 Stable |
| [v1.1](../v1.1/) | Assignment Margin | 📦 Stable |
| [v1.0](../v1.0/) | Production base | 📦 Stable |

---

## Getting Started

### Fresh Install

Deploy v1.0 base schema, then apply v1.1 migration:

```bash
# Deploy base schema
psql misir -f ../v1.0/schema.sql

# Apply security fixes
psql misir -f ../v1.0/security-fixes.sql

# Apply all migrations
psql misir -f ../v1.1/migration.sql
psql misir -f ../v1.2/migration.sql
psql misir -f ../v1.3/migration.sql
psql misir -f ../v1.4/migration.sql
```

### Upgrade from v1.3

```bash
# Backup first
pg_dump misir > backup_pre_v1.4.sql

# Apply v1.4 migration
psql misir -f ../v1.4/migration.sql
```

### Upgrade from v1.0

```bash
# Backup first
pg_dump misir > backup_pre_upgrades.sql

# Apply all missing migrations
psql misir -f ../v1.1/migration.sql
psql misir -f ../v1.2/migration.sql
psql misir -f ../v1.3/migration.sql
psql misir -f ../v1.4/migration.sql
```

---

## Schema Overview

### Tables (12)

| Table | Purpose |
|-------|---------|
| `user` | User accounts |
| `space` | Knowledge spaces |
| `subspace` | Semantic clusters within spaces |
| `artifact` | Captured content |
| `signal` | Embedding + engagement signals |
| `marker` | User-defined semantic anchors |
| `session` | Browsing sessions |
| `subspace_centroid_history` | Centroid evolution tracking |
| `insight` | Generated insights |
| `insight_evidence` | Evidence linking insights |
| `system_config` | Runtime configuration |
| `system_event_log` | System events |

### Enums (6)

| Enum | Values |
|------|--------|
| `engagement_level` | latent, discovered, engaged, saturated |
| `content_source` | web, pdf, video, chat, note, other |
| `signal_type` | semantic, marker, hybrid |
| `insight_type` | pattern, anomaly, recommendation |
| `event_type` | schema_change, config_change, etc. |
| `event_severity` | info, warning, error |

### Key Algorithms

| Algorithm | Description |
|-----------|-------------|
| **OSCL** | Online Semantic Centroid Learning (EMA) |
| **WESA** | Weighted Engagement Signal Accumulation |
| **SDD** | Semantic Drift Detection |
| **ISS** | Implicit Semantic Search (HNSW) |
| **Assignment Margin** | Prevents centroid pollution (v1.1) |

---

## Configuration

Key settings in `system_config`:

| Key | Description |
|-----|-------------|
| `embedding_model` | Model name + dimension (768) |
| `reading_depth_constants` | Formula weights |
| `centroid_history_threshold` | Drift logging thresholds |
| `vector_index_params` | HNSW parameters |
| `assignment_margin_threshold` | Margin for centroid updates (v1.1) |

---

## Version History

### v1.1 — Assignment Margin
- Added `margin` and `updates_centroid` columns to signal
- Modified centroid trigger to skip low-margin signals
- Added `calculate_assignment_margin()` RPC

### v1.0 — Production Base
- 12 tables, 6 enums, 8 functions, 5 triggers
- Full RLS policies
- Vector search with HNSW indexing
- Centroid auto-update triggers
