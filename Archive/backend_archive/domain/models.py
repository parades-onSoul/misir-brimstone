from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Any, Dict
import numpy as np
import uuid

class SignalType(Enum):
    """
    Categorizes the nature of the information.
    """
    SEMANTIC = "semantic"       # Derived from content embeddings
    TEMPORAL = "temporal"       # Time-based decay or specific interaction times
    BEHAVIORAL = "behavioral"   # User actions (clicks, dwells)
    STRUCTURAL = "structural"   # Relationships between items

class ArtifactType(Enum):
    WEB_PAGE = "web_page"
    PDF = "pdf"
    VIDEO = "video"
    CHAT_LOG = "chat_log"
    TEXT_SNIPPET = "text_snippet"

@dataclass
class Artifact:
    """
    A raw item ingested from the world.
    Normalized schema for all input types.
    """
    id: uuid.UUID
    content: str              # Raw text content (transcript, body, etc.)
    source_url: Optional[str]
    artifact_type: ArtifactType
    created_at: datetime
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    # Idempotency check
    content_hash: Optional[str] = None 

@dataclass
class Signal:
    """
    The atomic unit of mathematical processing.
    """
    id: uuid.UUID
    artifact_id: uuid.UUID
    space_id: uuid.UUID
    vector: np.ndarray        # High-dimensional position
    magnitude: float          # Weight/Importance (0.0 to 1.0)
    signal_type: SignalType
    timestamp: datetime
    
    def __post_init__(self):
        if not isinstance(self.vector, np.ndarray):
            self.vector = np.array(self.vector)

@dataclass
class Marker:
    """
    A linguistic or concept anchor for a Subspace.
    """
    term: str
    weight: float
    confidence: float
    source_artifact_ids: List[uuid.UUID] = field(default_factory=list)

@dataclass
class Subspace:
    """
    A dynamic cluster of knowledge.
    Defined by a Centroid (mathematical center) and Markers (semantic labels).
    """
    id: uuid.UUID
    name: str
    centroid: np.ndarray      # The "Center of Gravity"
    markers: List[Marker]
    confidence: float         # Overall health/coherence of the subspace
    last_updated: datetime
    
    # Evolution tracking
    velocity: np.ndarray = field(default_factory=lambda: np.zeros(0))
    
    def __post_init__(self):
        if not isinstance(self.centroid, np.ndarray):
            self.centroid = np.array(self.centroid)

@dataclass
class Delta:
    """
    Represents movement between states.
    """
    previous_centroid: np.ndarray
    current_centroid: np.ndarray
    timestamp: datetime
    
    @property
    def vector(self) -> np.ndarray:
        return self.current_centroid - self.previous_centroid
