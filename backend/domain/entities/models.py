"""
Domain Entities — Core business objects.

Entities have identity and can change over time.
These map to database tables but contain no DB logic.
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from domain.value_objects import EngagementLevel, SourceType, SignalType


@dataclass
class Artifact:
    """
    A captured piece of content with engagement metrics.
    Maps to misir.artifact table.
    """
    id: int
    user_id: str
    space_id: int
    url: str
    normalized_url: str
    domain: str
    
    # Content
    title: Optional[str] = None
    extracted_text: Optional[str] = None
    word_count: int = 0
    
    # Engagement (client-provided, DB-validated)
    engagement_level: EngagementLevel = EngagementLevel.LATENT
    content_source: SourceType = SourceType.WEB
    dwell_time_ms: int = 0
    scroll_depth: float = 0.0
    reading_depth: float = 0.0
    
    # Foreign keys
    subspace_id: Optional[int] = None
    session_id: Optional[int] = None
    
    # Timestamps
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    captured_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None


@dataclass
class Signal:
    """
    An atomic semantic event tied to an artifact.
    Maps to misir.signal table.
    
    Signals are time-series data that feed centroid learning.
    """
    id: int
    artifact_id: int
    space_id: int
    user_id: str
    
    # Vector
    vector: list[float] = field(default_factory=list)
    magnitude: float = 1.0
    signal_type: SignalType = SignalType.SEMANTIC
    
    # Embedding metadata (required by v1.0 schema)
    embedding_model: str = "nomic-ai/nomic-embed-text-v1.5"
    embedding_dimension: int = 768
    
    # Foreign keys
    subspace_id: Optional[int] = None
    
    # Timestamps
    created_at: datetime = field(default_factory=datetime.now)
    deleted_at: Optional[datetime] = None


@dataclass
class Space:
    """
    A top-level container for knowledge.
    Maps to misir.space table.
    """
    id: int
    user_id: str
    name: str
    description: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class Subspace:
    """
    A semantic cluster within a space.
    Has centroid (center of gravity) and learning rate.
    Maps to misir.subspace table.
    """
    id: int
    space_id: int
    user_id: str
    name: str
    description: Optional[str] = None
    
    # OSCL algorithm state
    centroid_embedding: Optional[list[float]] = None
    centroid_updated_at: Optional[datetime] = None
    learning_rate: float = 0.1
    artifact_count: int = 0
    confidence: float = 0.0
    
    # Timestamps
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class Marker:
    """
    A semantic anchor/tag for subspaces.
    Maps to misir.marker table.
    """
    id: int
    user_id: str
    term: str
    embedding: Optional[list[float]] = None
    
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
