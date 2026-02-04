"""
Capture API Endpoint — Thin HTTP layer.

Only responsibilities:
- Parse request
- Auth
- Route to handler
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from supabase import Client

from core.config import get_settings
from domain.commands import CaptureArtifactCommand
from application.handlers import CaptureHandler
from infrastructure.repositories import ArtifactRepository
from infrastructure.repositories.subspace_repo import SubspaceRepository
from infrastructure.repositories.base import get_supabase_client
from infrastructure.services.embedding_service import get_embedding_service

router = APIRouter()


# Request/Response DTOs
class CaptureRequest(BaseModel):
    """API request for artifact capture."""
    space_id: int
    url: str
    
    # Optional - calculated by backend if missing
    embedding: Optional[list[float]] = None
    
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
    
    # v1.1 Assignment Margin parameters  
    margin: Optional[float] = None
    updates_centroid: bool = True


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
    subspace_repo = SubspaceRepository(client)
    return CaptureHandler(repo, subspace_repo)


def get_current_user(
    authorization: str = Header(None),
    client: Client = Depends(get_supabase_client)
) -> str:
    """
    Extract user_id from JWT token.
    
    When MOCK_AUTH=True (development), returns a mock user ID.
    When MOCK_AUTH=False (production), validates JWT with Supabase.
    """
    settings = get_settings()
    
    if settings.MOCK_AUTH:
        return settings.MOCK_USER_ID
    
    # Production authentication
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="Authorization header required")
        
        # Extract token from "Bearer <token>" format
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization format")
        
        token = authorization.split(" ")[1]
        
        # Verify JWT token with Supabase
        user = client.auth.get_user(token)
        if not user or not user.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        return user.user.id
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {e}")


from fastapi import Request
from core.limiter import limiter

@router.post("/capture", response_model=CaptureResponse)
@limiter.limit("100/minute")
async def capture_artifact(
    request: Request,
    body: CaptureRequest,
    current_user_id: str = Depends(get_current_user),
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
        # Handle embedding generation
        embedding = body.embedding
        if not embedding:
            # If no vector provided, we must have content to embed
            text_to_embed = body.content or body.title
            if not text_to_embed:
                raise ValueError("Either 'embedding' or 'content'/'title' must be provided")
            
            # Generate embedding
            svc = get_embedding_service()
            result = svc.embed_text(text_to_embed)
            embedding = result.vector

        # Convert request to command
        cmd = CaptureArtifactCommand(
            user_id=current_user_id,
            space_id=body.space_id,
            url=body.url,
            embedding=embedding,
            reading_depth=body.reading_depth,
            scroll_depth=body.scroll_depth,
            dwell_time_ms=body.dwell_time_ms,
            word_count=body.word_count,
            engagement_level=body.engagement_level,
            content_source=body.content_source,
            subspace_id=body.subspace_id,
            session_id=body.session_id,
            title=body.title,
            content=body.content,
            signal_magnitude=body.signal_magnitude,
            signal_type=body.signal_type,
            matched_marker_ids=tuple(body.matched_marker_ids),
            margin=body.margin,
            updates_centroid=body.updates_centroid,
            captured_at=body.captured_at,
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
