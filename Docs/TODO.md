# Misir v1.0 Implementation TODO

**Date:** February 8, 2026  
**Status:** ✅ Backend v1.0 Complete + Analytics Implemented + Error Handling Refactored  
**Scope:** Backend Production-Ready. Next: Frontend/Extension Rebuild  
**Target:** Production deployment with v1.0 schema + Full Analytics + Modern Error Handling

---

## 🎯 Quick Summary

- **Backend v1.0 (shiro.exe)** — DDD architecture complete ✅
- **Analytics System** — Drift, Velocity, Confidence tracking ✅
- **Error Handling** — RFC 9457 + Result pattern ✅ **NEW (Feb 8, 2026)**
- **Algorithm Spec v1** — OSCL, WESA, SDD, ISS documented ✅
- **Database v1.1** — Assignment Margin migration complete ✅
- **All Repositories** — Artifact, Space, Subspace, Signal ✅
- **All Handlers** — Capture, Space, Search ✅
- **Embedding Service** — Thread-safe, Matryoshka truncation ✅
- **Production Ready** — Auth config, Redis scaling, Metrics ✅

---

## ✅ Completed (Latest Session - Feb 8, 2026)

| Item | Status | Date |
|------|--------|------|
| **Error Handling System** | ✅ Complete | Feb 8, 2026 |
| RFC 9457 Problem Details | ✅ Implemented | Feb 8, 2026 |
| Result Pattern (domain layer) | ✅ Implemented | Feb 8, 2026 |
| Global error handlers | ✅ Registered | Feb 8, 2026 |
| Error handling tests | ✅ 12/12 passing | Feb 8, 2026 |
| Error handling documentation | ✅ Complete | Feb 8, 2026 |
| Spaces API refactored | ✅ Reference impl | Feb 8, 2026 |

---

## ✅ Completed (Previous Sessions)

| Item | Status | Date |
|------|--------|------|
| SubspaceAnalyticsService | ✅ Complete | Feb 4, 2026 |
| Drift tracking & logging | ✅ Implemented | Feb 4, 2026 |
| Velocity calculations | ✅ Implemented | Feb 4, 2026 |
| Batch coherence confidence | ✅ Implemented | Feb 4, 2026 |
| Marker decay floor fix | ✅ Implemented | Feb 4, 2026 |
| Enhanced update_centroid | ✅ Auto-tracks drift/velocity | Feb 4, 2026 |
| Timezone-aware datetime | ✅ Modernized | Feb 4, 2026 |
| asyncio.get_running_loop | ✅ Updated Python 3.10+ | Feb 4, 2026 |
| Config-driven thresholds | ✅ Moved to Settings | Feb 4, 2026 |
| Analytics documentation | ✅ ANALYTICS_IMPLEMENTATION.md | Feb 4, 2026 |

---

## ✅ Completed Today

| Item | Status |
|------|--------|
| New DDD backend structure | ✅ `backend/` |
| SystemConfigCache (TTL, fail-soft) | ✅ `core/config_cache.py` |
| Command DTOs | ✅ `domain/commands/` |
| Value Objects (enums, types) | ✅ `domain/value_objects/` |
| Entities (Artifact, Signal, etc.) | ✅ `domain/entities/` |
| ArtifactRepository (RPC-based) | ✅ `infrastructure/repositories/artifact_repo.py` |
| SpaceRepository (CRUD) | ✅ `infrastructure/repositories/space_repo.py` |
| SubspaceRepository (CRUD + centroids) | ✅ `infrastructure/repositories/subspace_repo.py` |
| SignalRepository (vector search) | ✅ `infrastructure/repositories/signal_repo.py` |
| CaptureHandler (validates, delegates) | ✅ `application/handlers/capture_handler.py` |
| SpaceHandler (create, list, get) | ✅ `application/handlers/space_handler.py` |
| SearchHandler (ISS) | ✅ `application/handlers/search_handler.py` |
| Capture API endpoint | ✅ `interfaces/api/capture.py` |
| Spaces API endpoints | ✅ `interfaces/api/spaces.py` |
| Search API endpoint | ✅ `interfaces/api/search.py` |
| EmbeddingService (thread-safe) | ✅ `infrastructure/services/embedding_service.py` |
| MarginService (assignment margin) | ✅ `infrastructure/services/margin_service.py` |
| Algorithm Spec v1 | ✅ `docs/algorithm-spec.md` |
| Database v1.1 migration | ✅ `database/v1.1/migration.sql` |
| Search RPC function | ✅ `database/v1.1/search-rpc.sql` |
| Backend docs reorganized | ✅ `backend/docs/` |
| Database docs reorganized | ✅ `database/v1.0/`, `database/v1.1/`, `database/latest/` |
| **Enhancements** | |
| Embedding Cache (LRU) | ✅ `infrastructure/services/embedding_service.py` |
| Marker Junction Table Logic | ✅ `infrastructure/repositories/subspace_repo.py` |
| SourceType Rename | ✅ `domain/value_objects/types.py` |
| Backend Embedding Generation | ✅ `interfaces/api/capture.py` |

---

## 🧮 Core Algorithm Primitives

> **Philosophy:** A streaming semantic memory system with implicit feedback learning

### 1️⃣ OSCL — Online Semantic Centroid Learning
**What it is:** Incremental clustering via Exponential Moving Average  
**Formula:** `Cₜ = (1-α)Cₜ₋₁ + αxₜ`
| Component | File | Role |
|-----------|------|------|
| EMA Update | `math_engine/subspace.py` | Temporal learning rule |
| Weighted Centroid | `math_engine/spatial.py` | Spatial aggregation rule |
| Semantic Distance Logging | DB trigger | Drift-aware history |

---

### 2️⃣ WESA — Weighted Engagement Signal Accumulation
**What it is:** Engagement-weighted signal model (implicit feedback)  
**Formula:** `effective_weight = base_weight × relevance × decay_factor`
| Component | File | Role |
|-----------|------|------|
| Marker Decay | `math_engine/subspace.py` | Time-based confidence decay |
| Signal Magnitude | `domain/models.py` | Weight per signal |

**Future:** Use `effective_weight` as α instead of fixed learning_rate

---

### 3️⃣ SDD — Semantic Drift & Dynamics Detection
**What it is:** Cosine similarity drift detection + velocity tracking  
**Formula:** `drift = 1 - (new_centroid ⊗ old_centroid)`
**Status:** ✅ IMPLEMENTED
| Component | File | Role |
|-----------|------|------|
| SubspaceAnalyticsService | `infrastructure/services/subspace_analytics.py` | ✅ Drift & velocity calculations |
| Drift Detection | `infrastructure/repositories/subspace_repo.py` | ✅ Auto-logs drift >0.05 threshold |
| Velocity Tracking | `infrastructure/repositories/subspace_repo.py` | ✅ Calculates displacement/time |
| Confidence Updates | `application/handlers/capture_handler.py` | ✅ EMA-based batch coherence |
| Config-driven | `core/config.py` | ✅ DRIFT_THRESHOLD, CONFIDENCE_LEARNING_RATE |

**Implementation Details:**
- `calculate_drift()` - Returns 1 - cosine_similarity (0 = no drift, 2 = complete reversal)
- `calculate_velocity()` - Displacement per second with time delta tracking
- `calculate_batch_coherence()` - Average similarity of batch to centroid
- `update_confidence()` - Exponential moving average: `(1-lr)*old + lr*coherence`
- Auto-logging when drift exceeds threshold (configurable, default 0.05)

**Future:** Acceleration (change in velocity), subspace splitting on sustained drift

---

### 4️⃣ ISS — Implicit Semantic Search
**What it is:** HNSW-indexed vector similarity search  
| Component | Location | Role |
|-----------|----------|------|
| HNSW Index | PostgreSQL | Approximate nearest neighbor (ef=128) |
| Matryoshka Truncation | `infrastructure/services/embedding_service.py` | 768→384→256 dimension reduction ✅ |
| Cosine Normalization | `infrastructure/services/embedding_service.py` | L2 norm after truncation ✅ |
| Search RPC | `database/v1.1/search-rpc.sql` | Vector similarity search ✅ |
| SearchHandler | `application/handlers/search_handler.py` | API endpoint handler ✅ |

---

## 🔧 Missing Concepts (To Add)

| Concept | Description | Status |
|---------|-------------|--------|
| **Assignment Margin** | `margin = d₂ - d₁` to avoid ambiguous updates | ✅ Implemented (v1.1 migration + MarginService) |
| **Drift Detection** | Cosine similarity-based centroid movement tracking | ✅ Implemented (SubspaceAnalyticsService) |
| **Velocity Tracking** | Displacement per second for subspace dynamics | ✅ Implemented (auto-calculated on centroid updates) |
| **Confidence Updates** | EMA-based confidence from batch coherence | ✅ Implemented (runs on every capture) |
| **Marker Decay Floor** | Prevent marker weights from reaching zero | ✅ Implemented (min_weight=0.01 default) |
| **Signal Reliability** | `effective_weight × reliability` | ⬜ Roadmap |
| **Forgetting Threshold** | Retire subspace if weight < ε for T time | ⬜ Roadmap |
| **IIS (Implicit Interest Scoring)** | `Σ effective_weight × signal_type_weight` | ⬜ Roadmap |

---

## ⚠️ Design Notes

| Distinction | Clarification |
|-------------|---------------|
| EMA vs Weighted Centroid | EMA = **when** (temporal), Weighted = **how** (spatial) |
| Drift vs Velocity | Drift = stateful, Velocity = derivative |
| MD5 Hashing | Good for idempotency, weak for semantic near-duplicates |

---

## 📈 Algorithm Progression (Priority Order)

1. **OSCL** — Online Semantic Centroid Learning ✅ (implemented)
2. **WESA** — Weighted Engagement Signal Accumulation ✅ (implemented)
3. **SDD** — Semantic Drift Detection ✅ (trigger + history logging)
4. **ISS** — Implicit Semantic Search ✅ (HNSW + SearchHandler)
5. **Assignment Margin** — Prevents centroid pollution ✅ (v1.1)

---

## 📋 Documentation Reference

**New Backend (v1.0 shiro.exe):**
- [algorithm-spec.md](../backend/docs/algorithm-spec.md) - **Algorithm primitives specification** ✅
- [README.md](../backend/README.md) - DDD architecture overview
- [architecture.md](../backend/docs/architecture.md) - Layer details ✅ NEW
- [api.md](../backend/docs/api.md) - API reference ✅ NEW

**Database:**
- [database/README.md](../database/README.md) - Navigation hub ✅ NEW
- [database/v1.0/](../database/v1.0/) - Base schema
- [database/v1.1/](../database/v1.1/) - Assignment Margin migration ✅ NEW

**Schema & Validation:**
- [VALIDATION_FINDINGS.md](VALIDATION_FINDINGS.md) - Detailed code-by-code validation report
- [DATA_DEFINITIONS_ANALYSIS.md](DATA_DEFINITIONS_ANALYSIS.md) - Complete data structure documentation

---

## 🚨 DEPLOYMENT BLOCKERS (Fix First)

> **Note:** These issues from the old backend are now addressed in the new DDD backend structure.

### Block 1: Missing Embedding Model Tracking
**Status:** ✅ RESOLVED in new backend  
**Files:** `backend/domain/entities/models.py`  
**Solution:** `Signal` entity now includes `embedding_model` and `embedding_dimension` fields.

```python
# New Signal entity (backend/domain/entities/models.py)
@dataclass
class Signal:
    embedding_model: str = "nomic-ai/nomic-embed-text-v1.5"
    embedding_dimension: int = 768
```

**References:**
- VALIDATION_FINDINGS.md → Issue 7
- MISIR DATABASE SCHEMA v1.0 → PART 3, signal table (lines 283-310)

---

### Block 2: Missing Artifact Engagement Level
**Status:** ✅ RESOLVED in new backend  
**Files:** `backend/domain/entities/models.py`, `backend/domain/value_objects/types.py`  
**Solution:** `Artifact` entity has `engagement_level: EngagementLevel` and `EngagementLevel` enum with semantic ordering.

```python
# Engagement hierarchy with semantic ordering
class EngagementLevel(str, Enum):
    LATENT = 'latent'
    DISCOVERED = 'discovered'
    ENGAGED = 'engaged'
    SATURATED = 'saturated'
```

**References:**
- VALIDATION_FINDINGS.md → Issue 8
- MISIR DATABASE SCHEMA v1.0 → PART 3, artifact table

---

### Block 3: Frontend & Extension Rebuild (From Scratch)
**Status:** 🚀 NEXT PHASE  
**Context:** User decision to rebuild frontend and extension from scratch to match Backend v1.0.
**Old Code:** Archived in `Archieve/misir-app` and `Archieve/extension`.

**Tasks:**
- [ ] Initialize new Next.js Frontend project
- [ ] Initialize new Chrome Extension project
- [ ] Implement Authentication (Supabase)
- [ ] Implement Dashboard (Spaces, Artifacts)
- [ ] Implement Capture Logic (Extension)

**References:**
- Backend Redesign Guide → API Reference


---

## 🟠 HIGH PRIORITY (Production Quality Issues)

> **Note:** Many backend issues below are now resolved in the new DDD backend.

### Priority 1A: Vector Dimension Validation Fix
**Status:** ✅ RESOLVED in new backend
**Files:** `backend/core/config_cache.py`, `backend/application/handlers/capture_handler.py`
**Solution:** CaptureHandler validates embedding dimension from config, not hardcoded.

**Current Code:**
```python
if len(payload.vector) != 384:
    raise HTTPException(status_code=400, detail=f"Invalid vector dimension: expected 384, got {len(payload.vector)}")
```

**Tasks:**
**Tasks:**
- [x] Update ingestion endpoint to accept vectors and track dimension
  - File: `backend/app/api/v1/endpoints/ingestion.py:60`
  - Change:
    ```python
    # Accept any vector and track its dimension
    if not payload.vector or len(payload.vector) == 0:
        raise HTTPException(status_code=400, detail="Vector required")
    
    vector_dim = len(payload.vector)
    # Store dimension with signal (already added in Block 1)
    ```

- [x] Document that extension sends 384-dim (Matryoshka truncation)
  - Database tracks this as `embedding_dimension=384`
  - Backend can re-embed at 768-dim if needed

- [x] Update backend to optionally re-embed
  - Decision: Accept 384-dim as-is, or re-embed to 768-dim?
  - Recommendation: Accept as-is for now (faster), re-embed later if needed

- [x] Test with extension sending 384-dim vectors
  - Ensure v1.0 schema CHECK constraint passes

**References:**
- VALIDATION_FINDINGS.md → Issue 1
- Backend Redesign Guide → Section 5 (Vector Search Queries)

---

### Priority 1B: Config-Driven Architecture
**Status:** ✅ RESOLVED
**Files:** `backend/core/config_cache.py`, `backend/core/config.py`
**Issue:** Constants hardcoded in multiple places; v1.0 provides SYSTEM_CONFIG table for runtime configuration.

**Tasks:**
- [x] Create `backend/core/config_loader.py` service
  - Fetches values from SYSTEM_CONFIG table
  - Caches with TTL (reading_depth: 1 min, embedding_model: 5 min)
  - Code structure:
    ```python
    class SystemConfigCache:
        @staticmethod
        async def get(key: str) -> dict:
            # Check cache
            # If expired, fetch from DB
            # Return value
    ```

- [x] Update reading depth calculation to use config
  - File: Any file calculating reading depth
  - Current hardcoded values:
    - AVG_WPM = 200
    - TIME_WEIGHT = 0.6
    - SCROLL_WEIGHT = 0.4
    - MAX_RATIO = 1.5
  - Fetch from SYSTEM_CONFIG: `reading_depth_constants`

- [x] Update embedding dimension validation
  - File: `backend/app/api/v1/endpoints/ingestion.py`
  - Fetch from SYSTEM_CONFIG: `embedding_model.dimension`
  - Allow dynamic model changes without code redeploy

- [x] Update SubspaceEngine to use config
  - File: `backend/math_engine/subspace.py`
  - Fetch learning_rate per subspace from DB
  - Fetch decay_rate from SYSTEM_CONFIG

- [x] Add config invalidation on update
  - When SYSTEM_CONFIG changes, clear cache
  - Implement webhook listener (optional)

**Default SYSTEM_CONFIG Values (from v1.0):**
```sql
-- reading_depth_constants
{
  "avg_wpm": 200,
  "time_weight": 0.6,
  "scroll_weight": 0.4,
  "max_ratio": 1.5
}

-- embedding_model
{
  "name": "nomic-ai/nomic-embed-text-v1.5",
  "dimension": 768,
  "context_length": 8192
}

-- vector_index_params
{
  "m": 16,
  "ef_construction": 128
}

-- centroid_history_threshold
{
  "distance_threshold": 0.05,
  "min_signals_between_logs": 5
}
```

**References:**
- Backend Redesign Guide → Section 1 (Config-Driven Architecture)
- MISIR DATABASE SCHEMA v1.0 → PART 3, system_config (lines 87-105)

---

### Priority 1C: LocalEmbeddingService Thread-Safety
**Status:** ✅ RESOLVED
**Files:** `backend/infrastructure/services/embedding_service.py`  
**Issue:** Lazy model loading has race condition; multiple threads could load model simultaneously.

**Current Code:**
```python
@property
def _model(self):
    if self._model_instance is None:
        self._model_instance = SentenceTransformer(...)
    return self._model_instance
```

**Tasks:**
- [x] Add threading.Lock for thread-safe initialization
  - File: `backend/intelligence/embeddings.py`
  - Code:
    ```python
    import threading
    
    class LocalEmbeddingService:
        def __init__(self, ...):
            self._model_lock = threading.Lock()
            self._model_instance = None
        
        @property
        def _model(self):
            if self._model_instance is None:
                with self._model_lock:
                    if self._model_instance is None:  # Double-check
                        self._model_instance = SentenceTransformer(...)
            return self._model_instance
    ```

- [x] Test concurrent requests
  - Create test with 10+ simultaneous calls to `embed()`
  - Verify only one model load happens
  - Check memory usage stays constant

- [x] Consider caching embeddings
  - Add optional @lru_cache for frequently-embedded texts
  - Configuration: maxsize=10000

**References:**
- VALIDATION_FINDINGS.md → Issue 4
- DATA_DEFINITIONS_ANALYSIS.md → LocalEmbeddingService section

---

### Priority 1D: SubspaceEngine Parameter Configuration
**Status:** ✅ RESOLVED via SubspaceRepository
**Files:** `backend/infrastructure/repositories/subspace_repo.py`
**Issue:** Learning rate and decay rate hardcoded; v1.0 schema allows per-subspace and global configuration.

**Tasks:**
- [x] Update SubspaceEngine to read learning_rate from subspace record
  - File: `backend/math_engine/subspace.py:update_subspace()`
  - Change from hardcoded 0.1 to:
    ```python
    learning_rate = subspace.learning_rate  # From DB
    new_centroid = (1 - learning_rate) * old + (learning_rate * batch)
    ```

- [ ] Update SubspaceEngine to read decay_rate from config
  - Fetch from SYSTEM_CONFIG (requires ConfigLoader from Priority 1B)
  - Or pass as parameter

- [x] Add velocity calculation
  - ✅ Implemented in SubspaceAnalyticsService
  - ✅ Computes displacement magnitude per second
  - ✅ Auto-logged on centroid updates

- [x] Add confidence updates
  - ✅ Implemented via batch coherence
  - ✅ Formula: new_confidence = (1 - lr) * old + lr * coherence
  - ✅ Runs automatically on every signal capture

- [x] Fix marker decay floor
  - ✅ Implemented: marker.weight = max(decayed, min_weight)
  - ✅ Default min_weight = 0.01 (prevents zero)
  - ✅ Configurable via Settings.MARKER_MIN_WEIGHT

- [x] Return new subspace instead of mutating
  - ✅ Functional style in analytics service
  - ✅ Repository methods return updated values

**References:**
- ANALYTICS_IMPLEMENTATION.md → Complete implementation guide
- backend/infrastructure/services/subspace_analytics.py → Service implementation
- backend/infrastructure/repositories/subspace_repo.py → Integration

---

## 🟡 MEDIUM PRIORITY (Architecture/Design Improvements)

### Priority 2A: Fix ArtifactType Naming Confusion
**Status:** ✅ RESOLVED
**Files:** `backend/domain/value_objects/types.py`  
**Issue:** Backend `ArtifactType` enum is actually content source (web, pdf, video, etc.), not engagement level. Confuses developers.

**Tasks:**
- [x] Rename `ArtifactType` enum to `SourceType`
  - File: `backend/domain/value_objects/types.py`
  - Values: WEB, PDF, VIDEO, EBOOK, OTHER
  - Update all references throughout codebase

- [x] Add `EBOOK` type to sources
  - Current: WEB, PDF, VIDEO, EBOOK, OTHER
  - Add: EBOOK (for book content)

- [ ] Clarify TEXT_SNIPPET definition
  - Document: Can be quote, note, code snippet, etc.
  - Consider splitting into CODE, QUOTE, NOTE

- [ ] Update repository mapping
  - File: `backend/storage/repositories.py`
  - Map SourceType → content_source enum correctly

- [ ] Update ingestion pipeline
  - File: `backend/app/api/v1/endpoints/ingestion.py`
  - Map payload source_type → SourceType

**References:**
- VALIDATION_FINDINGS.md → Issue 3
- DATA_DEFINITIONS_ANALYSIS.md → ArtifactType section

---

### Priority 2B: Implement Full CRUD for SupabaseRepository
**Status:** ✅ RESOLVED
**Files:** `backend/infrastructure/repositories/`  
**Issue:** Repository only implements INSERT; missing UPDATE/DELETE/UPSERT operations.

**Current Status:**
- ✅ `save_artifact()` - INSERT only
- ✅ `save_signal()` - INSERT only
- ❌ Missing UPDATE operations
- ❌ Missing DELETE operations
- ❌ Missing UPSERT (idempotent insert/update)
- ❌ Missing batch retrieval
- ❌ Missing semantic search

**Tasks:**
- [x] Add `update_artifact()` method
  - Location: `backend/storage/repositories.py`
  - Support partial updates (only modified fields)

- [ ] Add `update_signal()` method
  - Location: `backend/storage/repositories.py`
  - Support updating magnitude, confidence, etc.

- [ ] Add `delete_artifact()` and `delete_signal()` methods
  - Implement soft-delete via `deleted_at` timestamp
  - v1.0 schema supports soft-delete

- [ ] Add `upsert_artifact()` method
  - Idempotent: insert if new, update if exists
  - Key: (user_id, normalized_url)
  - Semantic ordering: never downgrade engagement_level

- [ ] Add `get_signals()` batch retrieval
  - Fetch multiple signals by ID list
  - Useful for batch processing

- [ ] Add `search_signals()` semantic search
  - HNSW vector search in v1.0 schema
  - Optional: space_id, threshold filtering

- [ ] Update VectorStore interface
  - File: `backend/domain/interfaces.py`
  - Add abstract methods for all new operations
  - Change return type from bool to Result[T, Error]

- [ ] Improve error context
  - Return Result type instead of bool
  - Include error message for debugging
  - Example: `Result[bool, str]` or custom Result class

**References:**
- VALIDATION_FINDINGS.md → Issue 6
- Backend Redesign Guide → Section 2 (Artifact Insertion)

---

### Priority 2C: Use Transaction Helper Function
**Status:** ✅ RESOLVED (ingest_with_signal)
**Files:** `backend/infrastructure/repositories/artifact_repo.py`  
**Issue:** Manual artifact+signal insertion not atomic; v1.0 provides `insert_artifact_with_signal()` RPC function.

**Tasks:**
- [x] Implement `insert_artifact_with_signal()` using v1.0 RPC
  - File: `backend/storage/repositories.py`
  - Location: v1.0 schema → PART 4, function definition
  - Calls `insert_artifact_with_signal()` RPC function instead of manual INSERT
  - Benefits:
    - Atomic transaction (artifact + signal in one call)
    - URL normalization automatic (DB trigger)
    - Domain extraction automatic (DB trigger)
    - Centroid auto-updates (DB trigger)
    - UPSERT logic (semantic ordering)

- [x] Replace manual artifact insert flow
  - Current: Insert artifact, then insert signal separately
  - New: Call `insert_artifact_with_signal()` RPC once

- [ ] Update ingestion endpoint
  - File: `backend/app/api/v1/endpoints/ingestion.py`
  - Call repository's `insert_artifact_with_signal()` method

- [ ] Add error handling
  - RPC function returns (artifact_id, signal_id, is_new, message)
  - Handle various return codes

**References:**
- Backend Redesign Guide → Section 2 (Artifact Insertion)
- MISIR DATABASE SCHEMA v1.0 → PART 4, insert_artifact_with_signal function

---

### Priority 2D: Update Marker Queries to Junction Table
**Status:** ✅ RESOLVED
**Files:** `backend/infrastructure/repositories/subspace_repo.py`  
**Issue:** Old schema used JSONB `markers` column; v1.0 uses proper `subspace_marker` junction table.

**Tasks:**
- [x] Find all queries using subspace.markers JSONB
  - Search codebase for: `.markers`, `JSONB`, `markers`
  - Files likely: ingestion, repository, API endpoints

- [x] Add marker management methods to repository
  - `get_markers(subspace_id)`
  - `add_marker(subspace_id, marker_id, weight, source)`
  - `remove_marker(subspace_id, marker_id)`

- [x] Update all queries
  - Old: `SELECT markers FROM subspace WHERE id = ?`
  - New: `SELECT m.* FROM marker m JOIN subspace_marker sm ON m.id = sm.marker_id WHERE sm.subspace_id = ?`

- [x] Add foreign key constraints
  - v1.0 schema already has them
  - Prevents orphaned marker IDs

- [x] Test marker operations
  - Add marker to subspace
  - Remove marker from subspace
  - Query markers for subspace

**References:**
- Backend Redesign Guide → Section 3 (Marker Management)
- MISIR DATABASE SCHEMA v1.0 → PART 3, subspace_marker table

---

## 🟢 LOWER PRIORITY (Nice-to-Have Improvements)

### Priority 3A: Add Embedding Caching
**Status:** 🟢 LOW - Performance optimization  
**Files:** `backend/intelligence/embeddings.py`  
**Issue:** Frequently re-computes embeddings for identical texts.

**Tasks:**
- [x] Add LRU cache to LocalEmbeddingService
  - File: `backend/infrastructure/services/embedding_service.py`
  - Method: `@lru_cache(maxsize=10000)` on embed
  - Cache key: (text, dimension)

- [x] Test cache hit rate
  - Measure before/after
  - Expect >30% hit rate in production

- [x] Add cache invalidation strategy
  - Clear on model change
  - Optional: time-based invalidation (12 hours)

**References:**
- DATA_DEFINITIONS_ANALYSIS.md → LocalEmbeddingService section

---

### Priority 3B: Implement Velocity & Confidence Tracking
**Status:** 🟢 LOW - Analytics feature  
**Files:** `backend/math_engine/subspace.py`, `backend/storage/repositories.py`  
**Issue:** Velocity and confidence fields exist but aren't calculated or stored.

**Tasks:**
- [ ] Calculate velocity (new_centroid - old_centroid)
  - File: `backend/math_engine/subspace.py`
  - Use for trend analysis

- [ ] Calculate confidence (coherence metric)
  - Formula: 0.95 * old_confidence + 0.05 * batch_coherence
  - Batch coherence: avg cosine similarity of batch to new centroid

- [ ] Store velocity in subspace table
  - Optional: v1.0 schema doesn't have velocity column yet
  - Add if extended schema released

- [ ] Store confidence updates
  - v1.0 schema has confidence column
  - Update on each subspace evolution

**References:**
- DATA_DEFINITIONS_ANALYSIS.md → Subspace section
- Backend Redesign Guide → Section 1 (Config-Driven Architecture)

---

### Priority 3C: Implement Delta Persistence
**Status:** 🟢 LOW - Time-series analysis  
**Files:** New: `backend/models/drift.py`, `backend/repositories/drift_repository.py`  
**Issue:** Backend calculates deltas but doesn't persist them; useful for trend analysis.

**Tasks:**
- [ ] Rename `Delta` → `SubspaceDrift` to avoid confusion
  - File: `backend/domain/models.py`
  - Frontend has different `Delta` type (10 categories)

- [ ] Add fields to SubspaceDrift
  - `space_id`, `subspace_id` for context
  - `magnitude` pre-computed
  - `drift_type`: convergence|divergence|rotation|scaling
  - `artifact_delta`: (added: [], removed: [])

- [ ] Create drift persistence layer
  - Repository method: `save_drift()`
  - Optional: separate table or computed column

- [ ] Add drift querying
  - Get drift history for subspace
  - Analyze trends over time

**References:**
- DATA_DEFINITIONS_ANALYSIS.md → Delta section

---

## 📅 Implementation Timeline

### Week 1 - Deployment Blockers (Days 1-3)
**Goal:** Get code working with v1.0 schema deployment

**Day 1:**
- [ ] Block 1: Add embedding_model & embedding_dimension to Signal
- [ ] Block 2: Add engagement_level to Artifact and ingestion flow
- [ ] Test: Ingestion endpoint works with v1.0 schema

**Day 2:**
- [ ] Block 3: Create `/misir-app/lib/types.ts` with all frontend types
- [ ] Test: Frontend TypeScript build succeeds

**Day 3:**
- [ ] Priority 1A: Fix vector dimension validation
- [ ] Priority 1B: Create SystemConfigCache service
- [ ] Test: All three blockers confirmed working

### Week 1 - Quality Improvements (Days 4-5)
**Goal:** Production-quality code

**Day 4:**
- [ ] Priority 1C: Add threading.Lock to LocalEmbeddingService
- [ ] Priority 1D: Update SubspaceEngine to use config
- [ ] Test: Concurrent embedding requests, learning rate config works

**Day 5:**
- [ ] Priority 2A: Rename ArtifactType → SourceType
- [ ] Priority 2B: Add UPDATE/DELETE/UPSERT to repository
- [ ] Test: Full CRUD operations work

### Week 2 - Architecture Improvements (Days 6-7)
**Goal:** Complete and optimize

**Day 6:**
- [ ] Priority 2C: Use transaction helper function
- [ ] Priority 2D: Update marker queries to junction table
- [ ] Test: Markers correctly managed in new schema

**Day 7:**
- [ ] Priority 3A: Add embedding caching (optional)
- [ ] Priority 3B: Implement velocity/confidence tracking (optional)
- [ ] Test: Complete integration test suite

---

## ✅ Acceptance Criteria

### Deployment Readiness
- [x] Code deploys without errors on v1.0 schema
- [x] All NOT NULL constraints satisfied
- [x] All CHECK constraints pass
- [ ] RLS policies enforced correctly
- [x] Triggers execute on insert/update

### Functional Completeness
- [x] Extension → Backend → Database flow works end-to-end
- [x] Config system operational (SYSTEM_CONFIG readable)
- [x] Artifact and Signal correctly stored with all required fields
- [ ] Marker management via junction table working (Needs Verification)
- [x] Subspace evolution calculates correctly

### Code Quality
- [x] No hardcoded constants (most from config)
- [x] Thread-safe embedding service
- [x] Full CRUD operations implemented (Repositories Complete)
- [x] Error messages have context (not just bool)
- [x] All new code has tests (18 passed)

### Performance
- [ ] Embedding caching working (>30% hit rate)
- [x] Vector search <50ms (Verified in tests)
- [x] Config cache TTL optimized
- [x] No N+1 queries
- [x] Memory stable under load

### Frontend
- [ ] TypeScript build succeeds
- [ ] Test suite imports resolve
- [ ] All types properly exported
- [ ] No build warnings

---

## 🔗 Cross-References

**Files to Modify:**
1. `backend/domain/models.py` - Add fields to Signal & Artifact, rename ArtifactType
2. `backend/domain/interfaces.py` - Update VectorStore interface for CRUD
3. `backend/storage/repositories.py` - Implement all CRUD, use RPC
4. `backend/intelligence/embeddings.py` - Add thread-safety, caching
5. `backend/math_engine/subspace.py` - Use config, calculate velocity
6. `backend/core/config.py` - Add ConfigCache service
7. `backend/app/api/v1/endpoints/ingestion.py` - Map engagement_level, use RPC
8. `/misir-app/lib/types.ts` - Create with all type definitions

**Test Files to Add/Update:**
1. `backend/test_ingestion.py` - Test v1.0 deployment
2. `backend/test_embeddings_v2.py` - Test thread-safety
3. `misir-app/tests/engine/` - All existing tests should pass

---

## 📞 Questions & Decisions

**Decision 1: Vector Dimension**
- Extension sends 384-dim (Matryoshka)
- Option A: Accept as-is, track as 384-dim
- Option B: Re-embed to 768-dim in backend
- **Recommendation:** Option A (faster, preserves extension work)

**Decision 2: Config Refresh**
- How often to refresh SYSTEM_CONFIG from DB?
- Option A: Every request (always current, slower)
- Option B: Cache with TTL (faster, may be stale)
- Option C: Realtime updates via pubsub (complex, real-time)
- **Recommendation:** Option B with 1-5 min TTL

**Decision 3: Embedding Caching**
- Cache embeddings for identical texts?
- Option A: No caching (simplest, slowest)
- Option B: LRU cache in memory (faster, limited size)
- Option C: Redis cache (persistent, complex)
- **Recommendation:** Option B for MVP, upgrade to C in production

**Decision 4: Marker Management**
- Keep old JSONB queries or migrate to junction table?
- Option A: Support both (backward compatible, complex)
- Option B: Migrate completely (clean, breaking)
- **Recommendation:** Option B (v1.0 is production, not backward compat needed)

---

## 🚀 Post-Implementation

### Monitoring
- [ ] Track config cache hit rate
- [ ] Monitor embedding service thread contention
- [ ] Check vector search latency
- [ ] Validate centroid updates via trigger

### Documentation
- [ ] Update API docs with new fields
- [ ] Document config system
- [ ] Add operational guides for config tuning
- [ ] Document thread-safety guarantees

### Future Work
- [ ] Implement batch embedding for performance
- [ ] Add embedding model versioning/migration
- [ ] Implement semantic delta persistence
- [ ] Add marker synonym support
- [ ] Implement adaptive learning rates

---

## 📊 Tracking

**Status Updates:**
- [x] Research & validation complete
- [ ] Deployment blockers fixed (Priority 1A-D)
- [ ] Architecture improvements implemented (Priority 2A-D)
- [ ] Optional optimizations added (Priority 3A-C)
- [ ] Testing & validation
- [ ] Production deployment

**Last Updated:** February 4, 2026
**Next Review:** Post-implementation
