# Database Reference

> **Current Version:** 1.4 | **Schema:** PostgreSQL 14+ with pgvector | **Status:** Production Ready

## Quick Navigation

- [🏗️ Schema Overview](#schema-overview) - High-level architecture
- [📋 Table Reference](#core-tables) - Essential tables and columns  
- [🔧 Operations Guide](#common-operations) - Frequently used queries
- [📊 Analytics Tables](#analytics-tables-v14) - v1.4 analytics features
- [🔗 Webhooks](#webhook-tables-v13) - v1.3 webhook system
- [⚡ Performance](#indexes) - Indexes and optimization
- [🔒 Security](#security) - RLS policies and permissions

## Schema Overview

### Version History
| Version | Date | Key Changes |
|---------|------|-----------  |
| **v1.4** | 2026-02-04 | Analytics tables (velocity, drift detection) |
| **v1.3** | 2026-02-04 | Webhook system with retry logic |
| **v1.2** | 2026-02-04 | Engagement level enum alignment |
| **v1.1** | 2026-02-02 | Assignment margin for centroid updates |
| **v1.0** | 2026-02-01 | Production baseline |

### Architecture Diagram
```
┌─────────────────────────────────────────────────────────────┐
│                    MISIR DATABASE v1.4                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │    CORE      │    │  ANALYTICS   │    │   WEBHOOKS   │  │
│  │   TABLES     │    │   TABLES     │    │   TABLES     │  │
│  │              │    │              │    │              │  │
│  │ • profile    │    │ • velocity   │    │ • webhook_   │  │
│  │ • space      │    │ • drift      │    │   subscription│  │
│  │ • subspace   │    │ • centroid_  │    │ • webhook_   │  │
│  │ • artifact   │    │   history    │    │   event      │  │
│  │ • signal     │    │              │    │              │  │
│  │ • marker     │    │              │    │              │  │
│  │ • session    │    │              │    │              │  │
│  │ • insight    │    │              │    │              │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Core Tables

### Primary Tables

| Table | Purpose | Key Columns |
|-------|---------|------------|
| `profile` | User profiles | `id`, `display_name`, `settings` |
| `space` | Knowledge containers | `id`, `user_id`, `name`, `embedding` |
| `subspace` | Semantic clusters | `id`, `space_id`, `centroid_embedding` |
| `artifact` | Captured content | `id`, `url`, `content_embedding`, `engagement_level` |
| `signal` | Vector emissions | `id`, `artifact_id`, `vector`, `magnitude` |

### Key Relationships
```sql
profile (1) → (∞) space → (∞) subspace
space (1) → (∞) artifact → (∞) signal
space (1) → (∞) marker
```

## Common Operations

### Capture Artifact
```sql
SELECT * FROM misir.insert_artifact_with_signal(
    p_user_id := 'user-uuid',
    p_space_id := 1,
    p_url := 'https://example.com/article',
    p_embedding := '[0.1, 0.2, ...]'::vector(768),
    p_title := 'Article Title',
    p_engagement_level := 'engaged'
);
```

### Search Similar Content
```sql
SELECT a.title, a.url, a.engagement_level,
       a.content_embedding <=> $1 as similarity
FROM misir.artifact a
WHERE a.user_id = $2 
  AND a.deleted_at IS NULL
ORDER BY similarity ASC
LIMIT 10;
```

### Get Space Analytics
```sql
SELECT s.name, s.artifact_count, s.confidence,
       sv.velocity, sd.drift_magnitude
FROM misir.subspace s
LEFT JOIN misir.subspace_velocity sv ON sv.subspace_id = s.id
LEFT JOIN misir.subspace_drift sd ON sd.subspace_id = s.id
WHERE s.user_id = $1;
```

## Analytics Tables (v1.4)

### `subspace_velocity`
Tracks how fast centroids are moving.

| Column | Type | Description |
|--------|------|-------------|
| `subspace_id` | BIGINT | Target subspace |
| `velocity` | FLOAT | Movement speed |
| `displacement` | FLOAT[] | Direction vector |
| `measured_at` | TIMESTAMPTZ | Measurement time |

### `subspace_drift` 
Logs significant semantic drift events.

| Column | Type | Description |
|--------|------|-------------|
| `subspace_id` | BIGINT | Target subspace |
| `drift_magnitude` | FLOAT | Distance moved |
| `trigger_signal_id` | BIGINT | Causing signal |
| `occurred_at` | TIMESTAMPTZ | When drift occurred |

## Webhook Tables (v1.3)

### `webhook_subscription`
User webhook registrations.

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | UUID | Owner |
| `url` | TEXT | Endpoint URL |
| `events` | TEXT[] | Subscribed events |
| `secret` | TEXT | HMAC key |

### `webhook_event`
Delivery tracking with retry logic.

| Column | Type | Description |
|--------|------|-------------|
| `subscription_id` | BIGINT | Target webhook |
| `event_type` | TEXT | Event name |
| `status` | TEXT | pending/success/failed |
| `attempts` | INTEGER | Retry count |

## Enums

| Enum | Values | Usage |
|------|--------|-------|
| `engagement_level` | `latent`, `discovered`, `engaged`, `saturated` | Artifact engagement intensity |
| `content_source` | `web`, `pdf`, `video`, `chat`, `note`, `other` | Content type classification |
| `signal_type` | `semantic`, `temporal`, `behavioral`, `structural` | Signal categorization |
| `decay_rate` | `high`, `medium`, `low` | Signal decay speed |

## Indexes

### Vector Indexes (HNSW)
```sql
-- Primary search indexes
idx_artifact_content_embedding_hnsw    -- Artifact similarity search
idx_subspace_centroid_hnsw            -- Centroid comparisons  
idx_signal_vector_hnsw                -- Signal search
```

### Performance Indexes
```sql
-- User data access
idx_artifact_user_id
idx_space_user_id  
idx_signal_user_id

-- Time-based queries
idx_artifact_captured_at
idx_signal_created_at

-- Soft delete optimization  
idx_artifact_active (WHERE deleted_at IS NULL)
idx_signal_active (WHERE deleted_at IS NULL)
```

## Security

### Row Level Security (RLS)
All tables enforce user-scoped access:

```sql
-- Example: Users can only access their own artifacts
CREATE POLICY "Users can manage own artifacts"
ON misir.artifact FOR ALL
USING (auth.uid() = user_id);
```

### Service Role Access
System tables allow service role access for admin operations.

## Migration Guide

### Applying Migrations
```bash
# Apply all migrations to latest version
./scripts/database/migrate.sh misir latest

# Apply specific version
./scripts/database/migrate.sh misir 1.3
```

### Version-specific Notes

**v1.4**: Adds analytics tables for velocity and drift tracking
**v1.3**: Introduces webhook system with retry logic  
**v1.2**: Aligns engagement_level enum with backend
**v1.1**: Adds assignment margin for centroid quality
**v1.0**: Production baseline with all core functionality

## Performance Tips

1. **Vector Search**: Use cosine distance `<=>` for similarity
2. **Pagination**: Always use LIMIT/OFFSET for large result sets
3. **User Filtering**: Include `user_id` in WHERE clauses for RLS optimization
4. **Soft Deletes**: Filter `WHERE deleted_at IS NULL` for active records

## Configuration

System settings stored in `misir.system_config`:

| Setting | Default | Purpose |
|---------|---------|---------|
| `embedding_model` | Nomic v1.5 | Current embedding model |
| `assignment_margin_threshold` | 0.1 | Centroid update threshold |
| `centroid_history_threshold` | 0.05 | Drift detection sensitivity |

For detailed table schemas and complete SQL definitions, see the versioned migration files in [database/](../../database/).

---

📖 **Related Documentation**: [API Reference](../api/README.md) | [Architecture Overview](../architecture/system-overview.md) | [Getting Started](../getting-started.md)