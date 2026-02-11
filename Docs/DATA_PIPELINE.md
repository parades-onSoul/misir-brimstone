# Misir Data Pipeline & Architecture Documentation

## 1. Executive Summary

This document details the end-to-end data flow in the Misir application, linking the Frontend (Next.js), Backend (FastAPI/Python), and Database (Supabase/PostgreSQL). It serves as the source of truth for how data is ingested, processed, stored, and retrieved.

### Core Architecture

*   **Frontend**: Next.js 16 (App Router) + TypeScript + React Query. Acts as the presentation layer and command initiator.
*   **Backend**: Python 3.12 + FastAPI. Implements Clean Architecture (Interfaces -> Application -> Domain -> Infrastructure).
*   **Database**: PostgreSQL (via Supabase). Handles persistence, vector operations (pgvector), and atomic transactions via RPC.

---

## 2. Entity-Relationship Data Model

The data model is hierarchical, moving from broad organization to specific content content.

### A. The Hierarchy

1.  **User**: Root entity (Auth via Supabase Auth).
2.  **Space**: Top-level knowledge container (e.g., "Machine Learning", "Cooking").
    *   *Properties*: `name`, `layout` (Coordinate state), `evidence` (0-100%).
3.  **Subspace**: Dynamic semantic cluster within a Space. Created/Updated automatically by the backend based on content similarity.
    *   *Properties*: `centroid_embedding`, `learning_rate` (EMA), `confidence`.
4.  **Artifact**: The actual content captured (URL, Text, PDF).
    *   *Properties*: `title`, `url`, `content_embedding`, `word_count`, `engagement_level` (Ambient/Active/Flow).
5.  **Signal**: A normalized vector representation of an Artifact used for clustering.
    *   *Relation*: 1 Artifact = 1 Signal.

---

## 3. The "Write" Pipeline: Capture & Ingestion

When a user saves a URL or uploads a file, data flows through the following stages:

### Step 1: Frontend Request
**Source**: `frontend/lib/api/client.ts` -> `capture()`
**Payload** (`CaptureRequest`):
```json
{
  "url": "https://example.com/article",
  "title": "Deep Learning Guide",
  "extracted_text": "...",
  "space_id": 12,
  "user_id": "uuid-..."
}
```

### Step 2: Backend Handling
**Entry Point**: `backend/interfaces/api/capture_router.py`
**Handler**: `backend/application/handlers/capture_handler.py`

*   **Validation**: checks ranges, URL validity.
*   **Command**: Wraps data in `CaptureArtifactCommand`.

### Step 3: Intelligence & Processing
**Service**: `backend/infrastructure/services/embedding_service.py`

1.  **Vectorization**: The `extracted_text` and `title` are converted into a 768-dimensional vector using a Transformer model (local or API).
2.  **Classification**: `margin_service.py` (v1.1) calculates the **Assignment Margin**:
    *   Calculates distance to *best* Subspace centroid ($d_1$).
    *   Calculates distance to *second-best* Subspace centroid ($d_2$).
    *   *Margin* = $d_2 - d_1$. (Low margin = ambiguous classification).

### Step 4: Persistence (Atomic/RPC)
**Repository**: `backend/infrastructure/repositories/artifact_repo.py`

The backend calls a PostgreSQL RPC function (likely `insert_artifact_with_signal`) to ensure atomicity:
1.  Insert `misir.artifact` row.
2.  Insert `misir.signal` row.
3.  **Update Centroid**: If `margin > threshold` (defined in `system_config`), the assigned Subspace's centroid is updated using Exponential Moving Average (EMA).

---

## 4. The "Read" Pipeline: Analytics & Retrieval

How data is surfaced back to the user (e.g., The Global Analytics Dashboard).

### Step 1: Frontend Query
**Source**: `frontend/app/(dashboard)/dashboard/analytics/page.tsx`
**Hook**: `useQuery(['analytics', 'global'])`

### Step 2: Backend Aggregation
**Handler**: `backend/application/handlers/analytics_handler.py`

The handler performs "Read-Time Aggregation" (currently; planned move to SQL View).
1.  **Fetch Raw Data**: Selects `margin`, `word_count`, `created_at`, `space_id` from `misir.artifact`.
    *   *Constraint*: Limit 2000 rows (V1 safeguard).
2.  **Compute Metrics**:
    *   **Time Allocation**: Sums `word_count / 200` grouped by `space_id`.
    *   **Focus Score**: `Avg(margin)`.
    *   **Health**: Derived from Focus score.
    *   **Heatmap**: Date histogram of `created_at`.

### Step 3: Response DTO
**Contract**: `backend/domain/value_objects/analytics.py` <-> `frontend/types/api.ts`

Returns a `GlobalAnalyticsResult` object:
```json
{
  "overview": { "overall_focus": 0.85, "system_health": "Optimized" },
  "time_allocation": [ { "space_name": "AI", "minutes": 120 } ],
  "activity_heatmap": [ { "date": "2026-02-11", "count": 5 } ]
}
```

---

## 5. Database Schema Reference

### `misir.space`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | BIGINT | PK |
| `layout` | JSONB | Stores 2D/3D visual coordinates |
| `settings` | JSONB | Stores UI prefs (color, sort order) |

### `misir.subspace`
| Column | Type | Description |
| :--- | :--- | :--- |
| `centroid_embedding` | VECTOR(768) | The mathematical center of this cluster |
| `learning_rate` | FLOAT | How fast the centroid moves (v1.0 feature) |

### `misir.artifact`
| Column | Type | Description |
| :--- | :--- | :--- |
| `content_embedding` | VECTOR(768) | Content vector |
| `margin` | FLOAT | Classification confidence (v1.1) |
| `word_count` | INTEGER | Used for Reading Time proxy |
| `reading_depth` | FLOAT | 0.0 - 1.5 (Scroll/Interact metric) |
| `engagement_level` | ENUM | `ambient`, `active`, `flow` |

---

## 6. Known Limitations & Future Roadmap

1.  **Reading Time**: Currently a proxy based on `word_count / 200`. Future: Real `dwell_time_ms` tracking via client beacons.
2.  **Performance**: Analytics aggregation occurs in Python. Future: Move to `MATERIALIZED VIEW` in Postgres.
3.  **Vector Search**: Currently exact KNN. Future: HNSW Indexing for scale > 100k items.
