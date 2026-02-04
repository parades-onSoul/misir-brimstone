"""
Search API — Semantic search endpoint.

Endpoint:
- GET /search — Search artifacts by semantic similarity
"""
from fastapi import APIRouter, HTTPException, Depends, Header, Query
from pydantic import BaseModel
from typing import Optional
import logging

from supabase import create_client, Client
from core.config import get_settings
from application.handlers.search_handler import SearchHandler, SearchCommand

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/search", tags=["search"])


# Response models
class SearchResultItem(BaseModel):
    """Single search result."""
    artifact_id: int
    signal_id: int
    similarity: float
    title: Optional[str]
    url: str
    content_preview: Optional[str]
    space_id: int
    subspace_id: Optional[int]


class SearchResponseModel(BaseModel):
    """Search response."""
    results: list[SearchResultItem]
    query: str
    count: int
    dimension_used: int


# Dependency
def get_supabase_client() -> Client:
    """Get Supabase client."""
    settings = get_settings()
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


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

@router.get("", response_model=SearchResponseModel)
@limiter.limit("20/minute")
async def search(
    request: Request,
    q: str = Query(..., description="Search query", min_length=1),
    current_user_id: str = Depends(get_current_user),
    space_id: Optional[int] = Query(None, description="Filter by space"),
    subspace_id: Optional[int] = Query(None, description="Filter by subspace"),
    limit: int = Query(20, ge=1, le=100, description="Max results"),
    threshold: float = Query(0.7, ge=0.0, le=1.0, description="Min similarity"),
    client: Client = Depends(get_supabase_client)
):
    """
    Search artifacts by semantic similarity.
    
    Uses ISS (Implicit Semantic Search) with HNSW indexing.
    
    Args:
        user_id: User ID
        q: Search query text
        space_id: Optional space filter
        subspace_id: Optional subspace filter
        limit: Maximum results (default 20)
        threshold: Minimum similarity (default 0.7)
    
    Returns:
        SearchResponseModel with ranked results
    """
    try:
        handler = SearchHandler(client)
        cmd = SearchCommand(
            user_id=current_user_id,
            query=q,
            space_id=space_id,
            subspace_id=subspace_id,
            limit=limit,
            threshold=threshold
        )
        
        response = await handler.search(cmd)
        
        return SearchResponseModel(
            results=[
                SearchResultItem(
                    artifact_id=r.artifact_id,
                    signal_id=r.signal_id,
                    similarity=r.similarity,
                    title=r.title,
                    url=r.url,
                    content_preview=r.content_preview,
                    space_id=r.space_id,
                    subspace_id=r.subspace_id
                )
                for r in response.results
            ],
            query=response.query,
            count=response.count,
            dimension_used=response.dimension_used
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
