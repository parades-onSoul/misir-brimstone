# Misir Backend - Technical Documentation

> **Version:** 0.1.0  
> **Codename:** Brimstone  
> **Framework:** FastAPI + Supabase  
> **Last Updated:** January 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Domain Models](#domain-models)
4. [API Endpoints](#api-endpoints)
5. [Embedding Service](#embedding-service)
6. [Math Engine](#math-engine)
7. [Ingestion Pipeline](#ingestion-pipeline)
8. [Storage Layer](#storage-layer)
9. [Database Schema](#database-schema)
10. [Configuration](#configuration)
11. [File Structure](#file-structure)

---

## Overview

The Misir Backend is the **Orientation Engine** - the mathematical brain that processes semantic signals, computes space centroids, and manages the knowledge graph. It receives artifacts from the browser extension and web app, generates embeddings, and evolves subspaces over time.

### Design Philosophy: "Orientation Layer"

- **Semantic-First**: Everything becomes vectors for mathematical manipulation
- **Incremental Learning**: Centroids evolve with new evidence (EMA)
- **Separation of Concerns**: Domain logic decoupled from persistence
- **Extension-Friendly**: Dedicated endpoints for browser extension sync

### Key Capabilities

| Capability | Description |
|------------|-------------|
| **Embedding Generation** | Nomic-embed-text-v1.5 (768-dim, 8k context) for semantic vectors |
| **Artifact Sync** | Batch upsert from extension with session tracking |
| **Centroid Computation** | Weighted mean of signal vectors |
| **Subspace Evolution** | Exponential moving average updates |
| **User Map API** | Download spaces/markers/centroids for local matching |

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MISIR BACKEND ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │  EXTENSION  │    │   WEB APP   │    │   FASTAPI   │    │  SUPABASE   │  │
│  │   (Sensor)  │───►│  (Next.js)  │───►│  (Backend)  │───►│  (Postgres) │  │
│  └─────────────┘    └─────────────┘    └──────┬──────┘    └─────────────┘  │
│                                               │                             │
│                                        ┌──────┴──────┐                      │
│                                        │             │                      │
│                           ┌────────────┴─┐    ┌──────┴────────┐            │
│                           │  EMBEDDING   │    │  MATH ENGINE  │            │
│                           │   SERVICE    │    │   (Spatial)   │            │
│                           │  (BGE-small) │    │   (Dynamics)  │            │
│                           └──────────────┘    └───────────────┘            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                       │
│                   app/api/v1/endpoints/                                      │
│            extension.py │ ingestion.py                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                           DOMAIN LAYER                                       │
│                        domain/                                               │
│              models.py │ interfaces.py                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                         SERVICE LAYER                                        │
│            ┌─────────────────────┬─────────────────────┐                    │
│            │   intelligence/     │   math_engine/      │                    │
│            │   embeddings.py     │   spatial.py        │                    │
│            │                     │   dynamics.py       │                    │
│            │                     │   subspace.py       │                    │
│            └─────────────────────┴─────────────────────┘                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                        INGESTION LAYER                                       │
│                       ingestion/                                             │
│              pipeline.py │ processors.py                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                        STORAGE LAYER                                         │
│                        storage/                                              │
│           repositories.py │ schema.sql                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Domain Models

### Core Types

**File:** `domain/models.py`

#### Signal Types

```python
class SignalType(Enum):
    SEMANTIC = "semantic"       # Derived from content embeddings
    TEMPORAL = "temporal"       # Time-based decay
    BEHAVIORAL = "behavioral"   # User actions (clicks, dwells)
    STRUCTURAL = "structural"   # Relationships between items
```

#### Artifact Types

```python
class ArtifactType(Enum):
    WEB_PAGE = "web_page"
    PDF = "pdf"
    VIDEO = "video"
    CHAT_LOG = "chat_log"
    TEXT_SNIPPET = "text_snippet"
```

### Domain Entities

#### Artifact

The raw item ingested from the world:

```python
@dataclass
class Artifact:
    id: uuid.UUID
    content: str              # Raw text content
    source_url: Optional[str]
    artifact_type: ArtifactType
    created_at: datetime
    metadata: Dict[str, Any]
    content_hash: Optional[str]  # Idempotency
```

#### Signal

The atomic unit of mathematical processing:

```python
@dataclass
class Signal:
    id: uuid.UUID
    artifact_id: uuid.UUID
    space_id: uuid.UUID
    vector: np.ndarray        # 768-dim embedding (Nomic)
    magnitude: float          # Weight (0.0 to 1.0)
    signal_type: SignalType
    timestamp: datetime
```

#### Marker

A semantic anchor for subspaces:

```python
@dataclass
class Marker:
    term: str
    weight: float
    confidence: float
    source_artifact_ids: List[uuid.UUID]
```

#### Subspace

A dynamic cluster of knowledge:

```python
@dataclass
class Subspace:
    id: uuid.UUID
    name: str
    centroid: np.ndarray      # Center of Gravity
    markers: List[Marker]
    confidence: float         # Coherence score
    last_updated: datetime
    velocity: np.ndarray      # Drift tracking
```

### Interfaces

**File:** `domain/interfaces.py`

```python
class VectorStore(ABC):
    """Abstract interface for vector persistence."""
    
    @abstractmethod
    def add_signals(self, signals: List[Signal]) -> bool: ...
    
    @abstractmethod
    def search(self, query_vector, space_id, limit, threshold) -> List[Tuple[Signal, float]]: ...
    
    @abstractmethod
    def get_space_centroid(self, space_id: UUID) -> Optional[np.ndarray]: ...

class EmbeddingProvider(ABC):
    """Abstract interface for embeddings."""
    
    @property
    def model_name(self) -> str: ...
    
    @property
    def dimension(self) -> int: ...
    
    @abstractmethod
    def embed(self, text: str) -> np.ndarray: ...
    
    @abstractmethod
    def embed_batch(self, texts: List[str]) -> List[np.ndarray]: ...
```

---

## API Endpoints

### Router Structure

**File:** `app/api/v1/api.py`

```python
api_router = APIRouter()
api_router.include_router(ingestion.router, prefix="/ingestion", tags=["ingestion"])
api_router.include_router(extension.router, prefix="/extension", tags=["extension"])
```

**Base URL:** `/api/v1`

### Extension Endpoints

**File:** `app/api/v1/endpoints/extension.py`

#### GET `/extension/map`

Download user's mental map for local matching.

**Auth Required:** ✅ Bearer token

**Response:** `UserMapResponse`

```python
{
    "userId": "uuid",
    "spaces": [...],         # List of SpaceResponse
    "subspaces": [...],      # List of SubspaceResponse
    "markers": [...],        # List of MarkerResponse
    "centroids": [...],      # List of CentroidResponse
    "lastUpdated": 1706000000000  # Unix ms
}
```

**Centroid Format** (for extension's TF-IDF matching):

```python
{
    "spaceId": "engineering",
    "spaceName": "Engineering",
    "vector": {
        "react": 0.9,
        "typescript": 0.8,
        "component": 0.7,
        ...
    },
    "threshold": 0.15,
    "lastUpdated": 1706000000000
}
```

#### POST `/extension/sync`

Batch artifact sync from extension.

**Auth Required:** ✅ Bearer token

**Request:** `BatchSyncRequest`

```python
{
    "artifacts": [
        {
            "url": "https://example.com/article",
            "title": "Article Title",
            "domain": "example.com",
            "captured_at": "2026-01-27T10:00:00Z",
            "artifact_type": "engaged",
            "content_source": "web",
            "base_weight": 1.0,
            "decay_rate": "medium",
            "dwell_time_ms": 45000,
            "scroll_depth": 0.85,
            "reading_depth": 0.72,
            "extracted_text": "...",
            "word_count": 1200,
            "relevance": 0.65,
            "suggested_space_ids": ["uuid1"],
            "matched_marker_ids": ["m1", "m2"],
            "session_id": "20260127-100000-abc123"
        }
    ]
}
```

**Response:** `BatchSyncResponse`

```python
{
    "success": true,
    "synced_count": 5,
    "failed_urls": [],
    "errors": []
}
```

**Processing Steps:**

1. Look up space owner from `suggested_space_ids`
2. Match markers to find best subspace
3. Generate embedding from `extracted_text`
4. Create session if new `session_id`
5. **Upsert** artifact (handles final pulse updates)

#### GET `/extension/health`

Quick connectivity check.

```python
{
    "status": "healthy",
    "service": "extension-api",
    "timestamp": "2026-01-27T10:00:00Z"
}
```

### Ingestion Endpoints

**File:** `app/api/v1/endpoints/ingestion.py`

#### POST `/ingestion/test`

Ingest raw artifact with pre-computed embedding.

**Request:**

```python
{
    "content": "Raw text content...",
    "source_type": "text_snippet",
    "source_url": "https://example.com",
    "metadata": {},
    "vector": [0.1, 0.2, ...],  # 768-dim required (Nomic)
    "user_id": "uuid",
    "space_id": "uuid"
}
```

**Type Mapping:**

| Input | DB Value |
|-------|----------|
| `web_page` | `blog` |
| `pdf` | `document` |
| `video` | `video` |
| `chat_log` | `ai` |
| `text_snippet` | `note` |

---

## Embedding Service

**File:** `intelligence/embeddings.py`

### Model Configuration

```python
MODELS = {
    'default': 'nomic-ai/nomic-embed-text-v1.5',  # 768-dim, 8k context
    'lightweight': 'BAAI/bge-small-en-v1.5',      # 384-dim, extension fallback
    'performance': 'nomic-ai/nomic-embed-text-v1',  # 768-dim, original Nomic
    'multilingual': 'paraphrase-multilingual-MiniLM-L12-v2'
}
```

### Why Nomic Embed?

| Feature | BGE-small (old) | Nomic v1.5 (new) |
|---------|-----------------|------------------|
| **Dimensions** | 384 | 768 |
| **Context Window** | 512 tokens | 8,192 tokens |
| **Long Documents** | Truncates | Full page capture |
| **Matryoshka** | No | Yes (can truncate to 256/512) |

### Matryoshka Dimensionality

Nomic v1.5 uses **Matryoshka representation learning** - the most important semantic information is packed into the first dimensions. You can truncate vectors without re-training:

| Dimension | Quality | Use Case |
|-----------|---------|----------|
| **768** | 100% | Database storage, centroid calculation |
| **512** | ~99% | Faster similarity search |
| **384** | ~98% | Extension-compatible dimension |
| **256** | ~96% | Ultra-fast local matching |
| **128** | ~92% | Coarse filtering only |

```python
# Full fidelity (default)
vector = embedding_service.embed("Machine learning is fascinating")
# → (768,)

# Truncated for extension
compact = embedding_service.embed("Machine learning is fascinating", dim=384)
# → (384,) - ready for extension storage

# Convenience methods
ext_vec = embedding_service.embed_for_extension("text")  # 384-dim
search_vec = embedding_service.embed_for_search("text")  # 256-dim
```

### LocalEmbeddingService

```python
class LocalEmbeddingService(EmbeddingProvider):
    
    @property
    def dimension(self) -> int:
        return self._model.get_sentence_embedding_dimension()  # 768
    
    def embed(self, text: str) -> np.ndarray:
        return self._model.encode(text, convert_to_numpy=True)
    
    def embed_batch(self, texts: List[str]) -> List[np.ndarray]:
        return list(self._model.encode(texts, convert_to_numpy=True))
```

### Usage

```python
from intelligence.embeddings import embedding_service

# Full fidelity (768-dim) - for database storage
vector = embedding_service.embed("Machine learning is fascinating")
# → np.ndarray shape (768,)

# Matryoshka truncation - for extension or fast search
compact = embedding_service.embed("Machine learning is fascinating", dim=384)
# → np.ndarray shape (384,)

# Batch with truncation
vectors = embedding_service.embed_batch(["text1", "text2"], dim=256)
# → List of np.ndarray, each (256,)

# Convenience methods
ext_vector = embedding_service.embed_for_extension("text")  # → (384,)
search_vector = embedding_service.embed_for_search("text")  # → (256,)
```

### Model Lazy Loading

The model is loaded on first use to avoid startup delay:

```python
@property
def _model(self):
    if self._model_instance is None:
        print(f"Loading model: {self._model_name}...")
        self._model_instance = SentenceTransformer(self._model_name)
    return self._model_instance
```

---

## Math Engine

The mathematical core that computes spatial relationships and tracks evolution.

### Spatial Operations

**File:** `math_engine/spatial.py`

#### Centroid Calculation

Weighted center of gravity:

```python
def calculate_centroid(signals: List[Signal]) -> np.ndarray:
    """
    Centroid = Σ(Vector_i × Magnitude_i) / Σ(Magnitude_i)
    """
    vectors = np.stack([s.vector for s in signals])
    weights = np.array([s.magnitude for s in signals])
    
    total_weight = np.sum(weights)
    if total_weight == 0:
        return np.mean(vectors, axis=0)
    
    weighted_sum = np.dot(weights, vectors)
    return weighted_sum / total_weight
```

#### Dispersion Calculation

Signal spread around centroid:

```python
def calculate_dispersion(signals: List[Signal], centroid: np.ndarray) -> float:
    """
    Weighted average distance from centroid.
    """
    distances = np.array([np.linalg.norm(s.vector - centroid) for s in signals])
    weights = np.array([s.magnitude for s in signals])
    
    return float(np.sum(distances * weights) / np.sum(weights))
```

### Dynamics (Movement Tracking)

**File:** `math_engine/dynamics.py`

```python
def calculate_drift(previous: SpaceState, current: SpaceState) -> Delta:
    """Vector difference between two states."""
    return Delta(previous_state=previous, current_state=current)

def calculate_velocity(delta: Delta) -> float:
    """Speed of drift: Magnitude / TimeDelta"""
    seconds = (delta.current_state.timestamp - delta.previous_state.timestamp).total_seconds()
    return delta.magnitude / seconds if seconds > 0 else 0.0
```

### Subspace Evolution

**File:** `math_engine/subspace.py`

#### SubspaceEngine

Manages incremental learning of subspaces:

```python
class SubspaceEngine:
    def __init__(self, learning_rate: float = 0.1, decay_rate: float = 0.05):
        self.learning_rate = learning_rate  # Alpha for EMA
        self.decay_rate = decay_rate
```

#### Update Algorithm (EMA)

```python
def update_subspace(self, subspace: Subspace, new_signals: List[Signal]) -> Subspace:
    # 1. Calculate batch centroid
    batch_vectors = np.stack([s.vector for s in new_signals])
    batch_weights = np.array([s.magnitude for s in new_signals])
    batch_centroid = np.average(batch_vectors, axis=0, weights=batch_weights)
    
    # 2. Exponential Moving Average
    # New = (1 - α) × Old + α × Batch
    old_centroid = subspace.centroid
    new_centroid = (1 - self.learning_rate) * old_centroid + (self.learning_rate * batch_centroid)
    
    # 3. Decay markers
    for marker in subspace.markers:
        marker.weight *= (1 - self.decay_rate)
    
    # 4. Track velocity
    subspace.velocity = new_centroid - old_centroid
    subspace.centroid = new_centroid
    
    return subspace
```

**Learning Rate Effect:**

| α | Behavior |
|---|----------|
| 0.1 | Slow, stable evolution |
| 0.3 | Moderate responsiveness |
| 0.5 | Fast adaptation (may be noisy) |

---

## Ingestion Pipeline

**File:** `ingestion/pipeline.py`

### Pipeline Flow

```
Raw Content
    │
    ▼
┌─────────────────┐
│ Empty Check     │ → Reject if empty
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generate Hash   │ → MD5 for dedup
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Dedup Check     │ → Reject if seen
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create Artifact │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Cache Hash      │
└─────────────────┘
```

### IngestionPipeline Class

```python
class IngestionPipeline:
    def __init__(self):
        self.text_processor = TextProcessor()
        self._seen_hashes = set()  # In-memory dedup

    def _generate_hash(self, content: str) -> str:
        return hashlib.md5(content.encode('utf-8')).hexdigest()

    def process(self, raw_content, source_type, source_url, metadata) -> Optional[Artifact]:
        # 1. Validate
        if not raw_content:
            return None
        
        # 2. Dedup
        content_hash = self._generate_hash(raw_content)
        if content_hash in self._seen_hashes:
            return None
        
        # 3. Create artifact
        artifact = Artifact(
            id=uuid.uuid4(),
            content=raw_content.strip(),
            source_url=source_url,
            artifact_type=source_type,
            created_at=datetime.utcnow(),
            metadata=metadata or {},
            content_hash=content_hash
        )
        
        # 4. Cache
        self._seen_hashes.add(content_hash)
        return artifact
```

### Processors

**File:** `ingestion/processors.py`

```python
class TextProcessor(BaseProcessor):
    def process(self, content: str, source_url=None, metadata=None) -> Artifact:
        cleaned_content = content.strip()
        
        return Artifact(
            id=uuid.uuid4(),
            content=cleaned_content,
            source_url=source_url,
            artifact_type=ArtifactType.TEXT_SNIPPET,
            created_at=datetime.utcnow(),
            metadata=metadata or {}
        )
```

---

## Storage Layer

### SupabaseRepository

**File:** `storage/repositories.py`

```python
class SupabaseRepository:
    def __init__(self):
        self.client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    
    def save_artifact(self, artifact, user_id, space_id) -> bool:
        # Map enum to DB constraint
        type_map = {
            "web_page": "blog",
            "pdf": "document",
            "video": "video",
            "chat_log": "ai",
            "text_snippet": "note"
        }
        
        data = {
            "id": str(artifact.id),
            "content_source": type_map.get(artifact.artifact_type.value, "note"),
            "extracted_text": artifact.content,
            "url": artifact.source_url or "https://manual.ingest",
            "title": artifact.metadata.get("title", "Untitled"),
            "user_id": str(user_id),
            "space_id": str(space_id),
            ...
        }
        
        self.client.table("artifacts").insert(data).execute()
        return True
    
    def save_signal(self, signal: Signal) -> bool:
        data = {
            "id": str(signal.id),
            "artifact_id": str(signal.artifact_id),
            "space_id": str(signal.space_id),
            "vector": signal.vector.tolist(),
            "magnitude": signal.magnitude,
            "signal_type": signal.signal_type.value,
            "created_at": signal.timestamp.isoformat()
        }
        
        self.client.table("signals").insert(data).execute()
        return True
```

### Upsert for Final Metrics

The extension sync uses upsert to handle re-synced artifacts:

```python
result = supabase.table("artifacts").upsert(
    artifact_data,
    on_conflict="url,user_id"
).execute()
```

---

## Database Schema

**File:** `storage/schema.sql`

### Core Tables

```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Artifacts (Source of Truth)
CREATE TABLE artifacts (
    id uuid PRIMARY KEY,
    content text NOT NULL,
    source_url text,
    artifact_type text NOT NULL,
    created_at timestamptz NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    content_hash text UNIQUE
);

-- Spaces
CREATE TABLE spaces (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    centroid vector(768),  -- Nomic Embed v1.5
    confidence float DEFAULT 1.0,
    last_updated timestamptz DEFAULT now(),
    user_id uuid
);

-- Markers (Keywords)
CREATE TABLE markers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id uuid REFERENCES spaces(id) ON DELETE CASCADE,
    term text NOT NULL,
    weight float NOT NULL,
    confidence float NOT NULL,
    source_artifact_ids uuid[] DEFAULT '{}'
);

-- Signals (Mathematical Events)
CREATE TABLE signals (
    id uuid PRIMARY KEY,
    artifact_id uuid REFERENCES artifacts(id),
    space_id uuid REFERENCES spaces(id),
    vector vector(768),  -- Nomic Embed v1.5 (8k context)
    magnitude float NOT NULL,
    signal_type text NOT NULL,
    created_at timestamptz NOT NULL
);

-- Indexes
CREATE INDEX ON signals USING hnsw (vector vector_cosine_ops);
CREATE INDEX ON artifacts (content_hash);
```

### Schema Constraints

| Table | Column | Constraint |
|-------|--------|------------|
| `artifacts` | `content_source` | `blog` \| `video` \| `ai` \| `document` \| `note` |
| `artifacts` | `artifact_type` | `ambient` \| `engaged` \| `committed` |
| `artifacts` | `decay_rate` | `high` \| `medium` \| `low` |
| `signals` | `signal_type` | `semantic` \| `temporal` \| `behavioral` \| `structural` |

### Vector Dimension

All embeddings use **768 dimensions** (Nomic-embed-text-v1.5):

- `spaces.centroid`: `vector(768)`
- `signals.vector`: `vector(768)`
- `artifacts.content_embedding`: `vector(768)`

> **Note:** The extension uses lightweight TF-IDF matching locally. Heavy embedding work happens on the backend with Nomic's 8k context window.

---

## Configuration

### Authentication

**File:** `app/main.py`

The backend uses Supabase JWT tokens for authentication:

```python
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

oauth2_scheme = HTTPBearer(auto_error=False)

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(oauth2_scheme)
) -> dict:
    """
    Decode Bearer token and return user info.
    Extension sends: Authorization: Bearer <supabase_access_token>
    """
    token = credentials.credentials
    user_response = supabase_auth.auth.get_user(token)
    
    if not user_response or not user_response.user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    return {
        "id": str(user_response.user.id),
        "email": user_response.user.email,
        "user_metadata": user_response.user.user_metadata or {}
    }
```

**Extension Header:**

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Settings

**File:** `app/core/config.py`

```python
class Settings(BaseSettings):
    PROJECT_NAME: str = "Misir Orientation Engine"
    VERSION: str = "0.1.0"
    CODENAME: str = "Brimstone"
    API_V1_STR: str = "/api/v1"
    
    # Supabase
    SUPABASE_URL: str
    SUPABASE_KEY: str  # Service Role Key
    
    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True
    )
```

### Environment Variables

**File:** `.env`

```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJhbG...  # Service Role Key
```

### CORS Configuration

Extension origins are allowed via regex:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"^(chrome|moz)-extension://.*$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## File Structure

```
backend/
├── VERSION                     # 0.1.0-brimstone
├── requirements.txt            # Python dependencies
├── .env                        # Environment variables
│
├── app/
│   ├── main.py                 # FastAPI entry point
│   ├── core/
│   │   └── config.py           # Settings (Pydantic)
│   └── api/
│       └── v1/
│           ├── api.py          # Router aggregation
│           └── endpoints/
│               ├── extension.py # Extension API (497 lines)
│               └── ingestion.py # Ingestion API (104 lines)
│
├── domain/
│   ├── models.py               # Artifact, Signal, Subspace, etc.
│   └── interfaces.py           # VectorStore, EmbeddingProvider
│
├── intelligence/
│   └── embeddings.py           # LocalEmbeddingService
│
├── math_engine/
│   ├── spatial.py              # Centroid, dispersion
│   ├── dynamics.py             # Drift, velocity
│   └── subspace.py             # SubspaceEngine (EMA)
│
├── ingestion/
│   ├── pipeline.py             # IngestionPipeline
│   ├── processors.py           # TextProcessor
│   └── loaders/                # PDF, web loaders
│
├── storage/
│   ├── repositories.py         # SupabaseRepository
│   ├── schema.sql              # DDL
│   └── migrations/             # Schema migrations
│
├── scripts/
│   └── seed_subspace.py        # Dev seeding
│
└── tests/
    ├── test_api.py
    ├── test_api_live.py
    ├── test_embeddings_v2.py
    ├── test_ingestion.py
    ├── test_math.py
    └── test_subspace.py
```

---

## Dependencies

### Runtime

| Package | Version | Purpose |
|---------|---------|---------|
| `fastapi` | ≥0.109.0 | API framework |
| `uvicorn` | ≥0.27.0 | ASGI server |
| `pydantic` | ≥2.6.0 | Data validation |
| `supabase` | ≥2.3.0 | Database client |
| `sentence-transformers` | ≥2.3.0 | Embedding models |
| `numpy` | ≥1.26.0 | Vector math |
| `scipy` | ≥1.12.0 | Scientific computing |

### Development

| Package | Version | Purpose |
|---------|---------|---------|
| `pytest` | ≥8.0.0 | Testing |
| `httpx` | ≥0.26.0 | Async HTTP client |

---

## Running the Server

### Development

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Verify

```bash
curl http://localhost:8000/
# → {"message": "Misir Orientation Engine Online", "version": "0.1.0", "codename": "Brimstone"}

curl http://localhost:8000/health
# → {"status": "healthy"}
```

### API Docs

- **Swagger UI:** http://localhost:8000/api/v1/openapi.json
- **ReDoc:** Auto-generated from OpenAPI spec

---

## Future Considerations

### Potential Improvements

1. ~~**Real UserMap API**: Currently returns mock data; needs DB integration~~ ✅ **DONE**
2. **Centroid Recalculation Job**: Background task to update space centroids
3. **Marker Extraction**: NLP to auto-generate markers from artifacts
4. **Rate Limiting**: Protect sync endpoint from abuse
5. ~~**JWT Auth**: Proper user authentication for extension~~ ✅ **DONE**
6. **Websocket Push**: Notify extension when centroids change

### Known Limitations

1. ~~**Mock UserMap**: `/extension/map` returns hardcoded test data~~ ✅ **FIXED**
2. **In-Memory Dedup**: IngestionPipeline cache resets on restart
3. **Single Model**: No dynamic model switching yet
4. ~~**No Auth**: Extension endpoints trust `suggested_space_ids`~~ ✅ **FIXED**

---

## Changelog

### 0.1.1-brimstone (January 2026)

- **BREAKING:** Upgraded embeddings from BGE-small (384-dim) to Nomic Embed v1.5 (768-dim)
- **Matryoshka support:** `embed(text, dim=384)` for dynamic dimension truncation
- Convenience methods: `embed_for_extension()` (384), `embed_for_search()` (256)
- Real UserMap API with Supabase queries (replaced mock)
- JWT Bearer token authentication for extension endpoints
- Schema updated to `vector(768)` for all embedding columns

### 0.1.0-brimstone (January 2026)

- Initial FastAPI setup
- Extension sync endpoint with upsert
- LocalEmbeddingService (initial BGE-small)
- SubspaceEngine with EMA updates
- Supabase repository adapter
- Math engine: centroid, dispersion, drift
- Session tracking for extension artifacts
