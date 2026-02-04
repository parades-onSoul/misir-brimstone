"""
Domain Commands — Immutable request objects.

Commands are the "verbs" of the system:
- Typed
- Validated
- Versionable
- Easy to test
"""
from dataclasses import dataclass
from typing import Optional
from datetime import datetime


@dataclass(frozen=True)
class CaptureArtifactCommand:
    """
    Command to capture an artifact with its signal.
    
    This is the primary write command for the system.
    Maps directly to the insert_artifact_with_signal RPC.
    """
    # Required (RPC required params)
    user_id: str
    space_id: int
    url: str
    embedding: list[float]
    
    # Client-provided, DB-validated (never computed by backend)
    reading_depth: float
    scroll_depth: float
    dwell_time_ms: int
    word_count: int
    engagement_level: str  # latent | discovered | engaged | saturated
    content_source: str    # web | pdf | video | ebook | other
    
    # Optional
    subspace_id: Optional[int] = None
    session_id: Optional[int] = None
    title: Optional[str] = None
    content: Optional[str] = None
    signal_magnitude: float = 1.0
    signal_type: str = 'semantic'
    matched_marker_ids: tuple[int, ...] = ()
    captured_at: Optional[datetime] = None
    
    # Assignment Margin (v1.1) — prevents centroid pollution
    margin: Optional[float] = None  # d2 - d1
    updates_centroid: bool = True   # False if margin < threshold
    
    def __post_init__(self):
        """Validate command on creation."""
        if not self.user_id:
            raise ValueError("user_id is required")
        if not self.url:
            raise ValueError("url is required")
        if not self.embedding:
            raise ValueError("embedding is required")
        if not 0.0 <= self.scroll_depth <= 1.0:
            raise ValueError(f"scroll_depth must be 0-1, got {self.scroll_depth}")
        if not 0.0 <= self.reading_depth <= 1.5:
            raise ValueError(f"reading_depth must be 0-1.5, got {self.reading_depth}")
        if self.dwell_time_ms < 0:
            raise ValueError(f"dwell_time_ms must be non-negative")
        if self.word_count < 0:
            raise ValueError(f"word_count must be non-negative")


@dataclass(frozen=True)
class SearchSignalsCommand:
    """Command to search signals by vector similarity."""
    user_id: str
    query_embedding: list[float]
    space_id: Optional[int] = None
    subspace_id: Optional[int] = None
    limit: int = 20
    threshold: float = 0.7


@dataclass(frozen=True)
class CreateSpaceCommand:
    """Command to create a new space."""
    user_id: str
    name: str
    description: Optional[str] = None


@dataclass(frozen=True)
class CreateSubspaceCommand:
    """Command to create a new subspace within a space."""
    user_id: str
    space_id: int
    name: str
    description: Optional[str] = None
    initial_centroid: Optional[list[float]] = None
    learning_rate: float = 0.1


@dataclass(frozen=True)
class UpdateArtifactCommand:
    """Command to update an existing artifact."""
    artifact_id: int
    user_id: str
    
    # Updateable fields (all optional)
    title: Optional[str] = None
    content: Optional[str] = None
    engagement_level: Optional[str] = None  # semantics enforced by repo
    reading_depth: Optional[float] = None
    
    def __post_init__(self):
        """Validate command."""
        if self.reading_depth is not None and not 0.0 <= self.reading_depth <= 1.5:
            raise ValueError(f"reading_depth must be 0-1.5, got {self.reading_depth}")


@dataclass(frozen=True)
class DeleteArtifactCommand:
    """Command to soft-delete an artifact."""
    artifact_id: int
    user_id: str

