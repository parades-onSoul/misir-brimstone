"""
Analytics Entities — Domain objects for system analytics.
Mapped to analytics tables (or computed on fly in v1).
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict


@dataclass
class SubspaceVelocity:
    """
    Represents the velocity of a subspace centroid over time.
    Calculated as distance moved per time unit.
    """
    subspace_id: int
    space_id: int
    velocity: float  # Scalar speed
    displacement: List[float]  # Vector direction
    measured_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class SubspaceDrift:
    """
    Represents a significant drift event in a subspace.
    """
    id: Optional[int]
    subspace_id: int
    space_id: int
    drift_magnitude: float  # 1 - cosine_similarity
    previous_centroid: List[float]
    new_centroid: List[float]
    trigger_signal_id: int
    occurred_at: datetime = field(default_factory=datetime.utcnow)
