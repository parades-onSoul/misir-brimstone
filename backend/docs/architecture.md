# Backend Architecture

> **Pattern:** Domain-Driven Design (DDD)  
> **Framework:** FastAPI  
> **Database:** PostgreSQL via Supabase

---

## Layer Overview

```
┌─────────────────────────────────────────────────────────┐
│                    INTERFACES                            │
│              (API Routes, DTOs)                          │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    APPLICATION                           │
│              (Command Handlers)                          │
└─────────────────────────┬───────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
┌─────────────────────┐     ┌─────────────────────────────┐
│       DOMAIN        │     │       INFRASTRUCTURE        │
│ (Entities, Commands,│     │  (Repositories, Services)   │
│   Value Objects)    │     │                             │
└─────────────────────┘     └─────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                       CORE                               │
│             (Config, Shared Utilities)                   │
└─────────────────────────────────────────────────────────┘
```

---

## Layer Responsibilities

### Domain Layer (`domain/`)

**Purpose:** Pure business logic, no external dependencies.

| Folder | Contents | Example |
|--------|----------|---------|
| `entities/` | Domain aggregates | `Artifact`, `Signal`, `Subspace` |
| `value_objects/` | Immutable types | `EngagementLevel`, `EmbeddingVector` |
| `commands/` | Request DTOs | `CaptureArtifactCommand` |

**Rules:**
- No imports from `infrastructure/` or `interfaces/`
- No database logic
- Pure Python, easily testable

---

### Application Layer (`application/`)

**Purpose:** Orchestrate use cases, coordinate domain and infrastructure.

| Folder | Contents | Example |
|--------|----------|---------|
| `handlers/` | Command handlers | `CaptureHandler` |

**Rules:**
- Receives commands from interfaces
- Validates, logs, delegates to repositories
- Never computes (DB is arbiter)

---

### Infrastructure Layer (`infrastructure/`)

**Purpose:** External systems integration.

| Folder | Contents | Example |
|--------|----------|---------|
| `repositories/` | Database access | `ArtifactRepository` |
| `services/` | External APIs | `AssignmentMarginService` |

**Rules:**
- RPC-based writes (atomic transactions)
- Command-shaped operations (no generic `.save()`)
- Supabase client management

---

### Interfaces Layer (`interfaces/`)

**Purpose:** Entry points for external communication.

| Folder | Contents | Example |
|--------|----------|---------|
| `api/` | FastAPI routes | `capture.py` |
| `dto/` | Request/Response DTOs | (future) |

**Rules:**
- Thin layer (parse request, call handler, return response)
- HTTP-specific logic only
- Auth handling (future)

---

### Core Layer (`core/`)

**Purpose:** Shared utilities used across all layers.

| File | Purpose |
|------|---------|
| `config.py` | Environment variables via pydantic-settings |
| `config_cache.py` | `SystemConfigCache` with TTL and fail-soft |

---

## Design Decisions

### 1. DB is Arbiter

The backend validates **shape** (types, ranges), but the database enforces **constraints** and performs **computation**.

```python
# Backend: validate range
if not 0.0 <= reading_depth <= 1.5:
    raise ValueError("reading_depth out of range")

# Database: enforce semantics
CASE WHEN new_level > old_level THEN new_level ELSE old_level END
```

**Why:**
- Algorithm changes don't require backend redeploy
- Replay works correctly
- Single source of truth

### 2. Command-Shaped Writes

No generic `repository.save(entity)`. Instead:

```python
# ✅ Explicit
repository.ingest_with_signal(command)

# ❌ Generic
repository.save(artifact)
```

**Why:**
- Intentional operations
- Easier to audit
- Maps to RPC functions

### 3. Fail-Soft Config

```python
class SystemConfigCache:
    def get(self, key: str, default: Any) -> Any:
        try:
            return self._fetch_from_db(key)
        except:
            return default  # Never crash, use default
```

**Why:**
- Config unavailability shouldn't crash app
- Sensible defaults always available
- Graceful degradation

### 4. Immutable Commands

```python
@dataclass(frozen=True)  # ← Immutable
class CaptureArtifactCommand:
    user_id: str
    embedding: list[float]
    # ...
```

**Why:**
- Thread-safe
- Hashable (can be cached)
- Clear contract

---

## File Locations

| Concern | File |
|---------|------|
| API entry | `interfaces/api/capture.py` |
| Command handler | `application/handlers/capture_handler.py` |
| Repository | `infrastructure/repositories/artifact_repo.py` |
| Margin service | `infrastructure/services/margin_service.py` |
| Config | `core/config.py` |
| Config cache | `core/config_cache.py` |
| Entities | `domain/entities/models.py` |
| Commands | `domain/commands/capture.py` |
| Value objects | `domain/value_objects/types.py` |
