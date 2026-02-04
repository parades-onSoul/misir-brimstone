# Domain Model

This document details the domain entities, value objects, and commands that form the core business logic of Misir.

## Core Entities

### Artifact
*A captured piece of content with engagement metrics.*

```python
@dataclass
class Artifact:
    id: int
    user_id: str
    space_id: int
    url: str
    normalized_url: str  # Auto-computed by DB
    domain: str          # Auto-extracted by DB
    
    # Content
    title: Optional[str]
    extracted_text: Optional[str]
    word_count: int
    
    # Engagement (client-provided, DB-validated)
    engagement_level: EngagementLevel
    content_source: SourceType
    dwell_time_ms: int
    scroll_depth: float      # 0.0 - 1.0
    reading_depth: float     # 0.0 - 1.5
    
    # Relationships
    subspace_id: Optional[int]
    session_id: Optional[int]
    
    # Timestamps
    created_at: datetime
    updated_at: datetime
    captured_at: Optional[datetime]
```

**Key Properties:**
- **URL Normalization**: Handled by DB trigger (removes tracking params)
- **Domain Extraction**: Auto-computed from URL
- **Reading Depth**: Client-computed using formula: `(time_ratio * 0.6) + (scroll_depth * 0.4)`
- **Engagement Ordering**: Semantic (latent < discovered < engaged < saturated)

### Signal
*An atomic semantic event tied to an artifact.*

```python
@dataclass
class Signal:
    id: int
    artifact_id: int
    space_id: int
    user_id: str
    
    # Vector data
    vector: list[float]           # 768-dim embedding
    magnitude: float              # Signal strength
    signal_type: SignalType       # semantic, temporal, behavioral
    
    # v1.4 Metadata
    embedding_model: str          # Track model used
    embedding_dimension: int      # Typically 768
    
    # v1.1 Assignment Margin
    margin: Optional[float]       # d2 - d1 (closest vs second-closest)
    updates_centroid: bool        # False if margin too low
    
    # Relationships
    subspace_id: Optional[int]
    
    # Timestamps
    created_at: datetime
```

**Key Properties:**
- **Immutable**: Signals are never updated, only created
- **Assignment Margin**: Prevents centroid pollution from ambiguous signals
- **Model Tracking**: Each signal knows which embedding model generated it

### Space
*A top-level container for knowledge.*

```python
@dataclass
class Space:
    id: int
    user_id: str
    name: str
    description: Optional[str]
    
    # Optional semantic center
    embedding: Optional[list[float]]
    
    # Confidence metrics
    evidence: float  # 0.0 - 100.0
    
    # Layout state (for UI)
    layout: dict  # JSONB
    
    # Timestamps
    created_at: datetime
    updated_at: datetime
```

### Subspace
*A semantic cluster within a space.*

```python
@dataclass
class Subspace:
    id: int
    space_id: int
    user_id: str
    name: str
    description: Optional[str]
    
    # OSCL Algorithm State
    centroid_embedding: Optional[list[float]]
    centroid_updated_at: Optional[datetime]
    learning_rate: float = 0.1    # EMA parameter
    
    # Metrics
    artifact_count: int
    confidence: float             # Based on signal count
    
    # Timestamps
    created_at: datetime
    updated_at: datetime
```

**OSCL (Online Semantic Centroid Learning):**
- **Formula**: `C_t = (1-α)C_{t-1} + αx_t` where α = learning_rate
- **Auto-Update**: Triggered by DB when new signals arrive
- **History Logging**: Only when centroid moves beyond threshold distance

## Value Objects

### EngagementLevel
*Semantic ordering of user engagement.*

```python
class EngagementLevel(str, Enum):
    LATENT = 'latent'           # Passive exposure
    DISCOVERED = 'discovered'   # Active awareness  
    ENGAGED = 'engaged'         # Intentional interaction
    SATURATED = 'saturated'     # Deep immersion
```

**Rules:**
- Never downgrade engagement (DB enforces)
- Semantic ordering: latent < discovered < engaged < saturated

### SourceType
*Classification of content source.*

```python
class SourceType(str, Enum):
    WEB = 'web'       # Web pages
    PDF = 'pdf'       # PDF documents
    VIDEO = 'video'   # YouTube, Vimeo, etc.
    CHAT = 'chat'     # AI conversations
    NOTE = 'note'     # User notes
    OTHER = 'other'   # Fallback
```

### EmbeddingVector
*Immutable embedding with dimension tracking.*

```python
@dataclass(frozen=True)
class EmbeddingVector:
    values: tuple[float, ...]  # Immutable
    model: str                 # e.g., 'nomic-ai/nomic-embed-text-v1.5'
    
    @property
    def dimension(self) -> int:
        return len(self.values)
    
    def truncate(self, dim: int) -> 'EmbeddingVector':
        """Matryoshka truncation."""
        return EmbeddingVector(
            values=self.values[:dim],
            model=self.model
        )
```

### ReadingMetrics
*Reading engagement metrics.*

```python
@dataclass(frozen=True)
class ReadingMetrics:
    dwell_time_ms: int    # Time spent on page
    scroll_depth: float   # 0.0 - 1.0 (how far scrolled)
    reading_depth: float  # 0.0 - 1.5 (engagement intensity)
    word_count: int       # Estimated words
```

**Reading Depth Formula:**
```python
expected_time_ms = (word_count * 60000) / 200  # 200 WPM
time_ratio = min(1.5, dwell_time_ms / expected_time_ms)
reading_depth = (time_ratio * 0.6) + (scroll_depth * 0.4)
```

## Commands

### CaptureArtifactCommand
*Primary write command for artifact ingestion.*

```python
@dataclass(frozen=True)
class CaptureArtifactCommand:
    # Required
    user_id: str
    space_id: int
    url: str
    embedding: list[float]
    
    # Engagement metrics
    reading_depth: float
    scroll_depth: float
    dwell_time_ms: int
    word_count: int
    engagement_level: str
    content_source: str
    
    # Optional
    subspace_id: Optional[int] = None
    session_id: Optional[int] = None
    title: Optional[str] = None
    content: Optional[str] = None
    signal_magnitude: float = 1.0
    signal_type: str = 'semantic'
    matched_marker_ids: tuple[int, ...] = ()
    
    # v1.1 Assignment Margin
    margin: Optional[float] = None
    updates_centroid: bool = True
    
    # Timestamps
    captured_at: Optional[datetime] = None
```

**Processing Flow:**
1. Handler validates command shape
2. Repository calls `insert_artifact_with_signal` RPC
3. DB triggers handle normalization and centroid updates
4. Webhooks dispatched (fire-and-forget)

### UpdateArtifactCommand
*Command for artifact updates.*

```python
@dataclass(frozen=True)
class UpdateArtifactCommand:
    artifact_id: int
    user_id: str
    
    # Updateable fields
    title: Optional[str] = None
    content: Optional[str] = None
    engagement_level: Optional[str] = None
    reading_depth: Optional[float] = None
```

**Rules:**
- Only specific fields can be updated
- Engagement level can only be upgraded (never downgraded)
- Updates trigger `updated_at` timestamp

## Domain Services

### MarginService
*Calculates assignment margins for signals.*

```python
class MarginService:
    async def calculate_margin(
        self, 
        signal_vector: list[float],
        user_id: str,
        space_id: int
    ) -> Optional[float]:
        """Calculate d2 - d1 margin for signal assignment."""
```

**Algorithm:**
1. Find 2 closest subspace centroids to signal
2. Calculate distances: d1 (closest), d2 (second closest)
3. Return margin = d2 - d1
4. Signal updates centroid only if margin > threshold

## Invariants

### Domain Invariants
1. **User Isolation**: All entities are user-scoped
2. **Engagement Monotonicity**: Engagement levels only increase
3. **Signal Immutability**: Signals are never modified after creation
4. **URL Uniqueness**: Each user can have only one artifact per normalized URL

### Database Constraints
1. **Vector Dimensions**: All embeddings must be 768-dimensional
2. **Range Constraints**: scroll_depth ∈ [0,1], reading_depth ∈ [0,1.5]
3. **Foreign Key Integrity**: All references properly constrained
4. **RLS Policies**: Row-level security enforces user isolation

## Evolution Patterns

### Adding New Engagement Levels
1. Update `EngagementLevel` enum in `domain/value_objects/types.py`
2. Create database migration to add enum value
3. Update semantic ordering in RPC functions
4. Update validation logic

### Adding New Signal Types
1. Update `SignalType` enum
2. Add processing logic in relevant handlers
3. Update centroid computation if needed
4. Add tests for new signal type

This domain model provides the foundation for all business logic in Misir, ensuring consistency and maintainability across the system.