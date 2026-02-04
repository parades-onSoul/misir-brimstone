"""
Domain Value Objects — Immutable domain primitives.

Value objects are identified by their values, not identity.
They are immutable and comparable by value.
"""
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class EngagementLevel(str, Enum):
    """
    Semantic ordering of user engagement.
    IMPORTANT: Never downgrade (DB enforces via semantic comparison).
    """
    LATENT = 'latent'           # Passive exposure
    DISCOVERED = 'discovered'   # Active awareness
    ENGAGED = 'engaged'         # Intentional interaction  
    SATURATED = 'saturated'     # Deep immersion
    
    @classmethod
    def from_str(cls, value: str) -> 'EngagementLevel':
        return cls(value.lower())
    
    def __gt__(self, other: 'EngagementLevel') -> bool:
        order = ['latent', 'discovered', 'engaged', 'saturated']
        return order.index(self.value) > order.index(other.value)


class ContentSource(str, Enum):
    """Source type for artifacts."""
    WEB = 'web'
    PDF = 'pdf'
    VIDEO = 'video'
    EBOOK = 'ebook'
    OTHER = 'other'


class SignalType(str, Enum):
    """Type of signal emitted."""
    SEMANTIC = 'semantic'     # Content-based
    TEMPORAL = 'temporal'     # Time-based patterns
    BEHAVIORAL = 'behavioral' # User actions


@dataclass(frozen=True)
class EmbeddingVector:
    """
    Immutable embedding vector with dimension tracking.
    Supports Matryoshka truncation.
    """
    values: tuple[float, ...]
    model: str
    
    @property
    def dimension(self) -> int:
        return len(self.values)
    
    def truncate(self, dim: int) -> 'EmbeddingVector':
        """Truncate to lower dimension (Matryoshka)."""
        if dim >= self.dimension:
            return self
        return EmbeddingVector(
            values=self.values[:dim],
            model=self.model
        )
    
    def to_list(self) -> list[float]:
        return list(self.values)


@dataclass(frozen=True)
class NormalizedUrl:
    """
    URL with tracking parameters removed.
    Backend doesn't compute this — DB does via trigger.
    This is for type safety when reading from DB.
    """
    raw: str
    normalized: str
    domain: str


@dataclass(frozen=True)
class ReadingMetrics:
    """
    Reading engagement metrics.
    All values are client-provided, DB-validated.
    """
    dwell_time_ms: int
    scroll_depth: float  # 0.0 - 1.0
    reading_depth: float  # 0.0 - 1.5
    word_count: int
    
    def __post_init__(self):
        if not 0.0 <= self.scroll_depth <= 1.0:
            raise ValueError(f"scroll_depth must be 0-1")
        if not 0.0 <= self.reading_depth <= 1.5:
            raise ValueError(f"reading_depth must be 0-1.5")
