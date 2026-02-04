"""
Capture API Endpoint — Thin HTTP layer.

Only responsibilities:
- Parse request
- Auth
- Route to handler
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

from domain.commands import CaptureArtifactCommand
from application.handlers import CaptureHandler
from infrastructure.repositories import ArtifactRepository
from infrastructure.repositories.base import get_supabase_client

router = APIRouter()


# Request/Response DTOs
class CaptureRequest(BaseModel):
    """API request for artifact capture."""
    user_id: str
    space_id: int
    url: str
    embedding: list[float]
    
    # Metrics (client-provided)
    reading_depth: float = Field(ge=0.0, le=1.5)
    scroll_depth: float = Field(ge=0.0, le=1.0)
    dwell_time_ms: int = Field(ge=0)
    word_count: int = Field(ge=0)
    engagement_level: str = 'latent'
    content_source: str = 'web'
    
    # Optional
    subspace_id: Optional[int] = None
    session_id: Optional[int] = None
    title: Optional[str] = None
    content: Optional[str] = None
    signal_magnitude: float = 1.0
    signal_type: str = 'semantic'
    matched_marker_ids: list[int] = []
    captured_at: Optional[datetime] = None


class CaptureResponse(BaseModel):
    """API response for artifact capture."""
    artifact_id: int
    signal_id: int
    is_new: bool
    message: str


def get_handler() -> CaptureHandler:
    """Dependency injection for handler."""
    client = get_supabase_client()
    repo = ArtifactRepository(client)
    return CaptureHandler(repo)


@router.post("/capture", response_model=CaptureResponse)
async def capture_artifact(
    request: CaptureRequest,
    handler: CaptureHandler = Depends(get_handler)
):
    """
    Capture an artifact with its signal.
    
    The backend validates shape + ranges but never computes
    reading_depth. The database is the arbiter for:
    - URL normalization
    - Domain extraction
    - Semantic engagement ordering
    - Centroid updates
    """
    try:
        # Convert request to command
        cmd = CaptureArtifactCommand(
            user_id=request.user_id,
            space_id=request.space_id,
            url=request.url,
            embedding=request.embedding,
            reading_depth=request.reading_depth,
            scroll_depth=request.scroll_depth,
            dwell_time_ms=request.dwell_time_ms,
            word_count=request.word_count,
            engagement_level=request.engagement_level,
            content_source=request.content_source,
            subspace_id=request.subspace_id,
            session_id=request.session_id,
            title=request.title,
            content=request.content,
            signal_magnitude=request.signal_magnitude,
            signal_type=request.signal_type,
            matched_marker_ids=tuple(request.matched_marker_ids),
            captured_at=request.captured_at,
        )
        
        # Handle command
        result = await handler.handle(cmd)
        
        return CaptureResponse(
            artifact_id=result.artifact_id,
            signal_id=result.signal_id,
            is_new=result.is_new,
            message=result.message
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Capture failed: {e}")
