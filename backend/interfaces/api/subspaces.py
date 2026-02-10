"""
Subspace API — List subspaces for a space.

Endpoint:
- GET /spaces/{space_id}/subspaces — List subspaces for a given space and user
"""
from fastapi import APIRouter, Depends, Path, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List

from supabase import create_client, Client

from core.config import get_settings
from core.error_handlers import create_problem_response
from core.logging_config import get_logger
from core.limiter import limiter
from infrastructure.repositories.subspace_repo import SubspaceRepository

logger = get_logger(__name__)
router = APIRouter(prefix="/spaces", tags=["subspaces"])


class SubspaceResponse(BaseModel):
    id: int
    space_id: int
    name: str
    description: Optional[str] = None
    user_id: str
    artifact_count: int
    confidence: float
    learning_rate: float
    centroid_embedding: Optional[list[float]] = None
    markers: List[str] = []


def get_supabase_client() -> Client:
    """Backend uses service key to bypass RLS for server-side operations."""
    settings = get_settings()
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY or settings.SUPABASE_KEY)


@router.get("/{space_id}/subspaces", response_model=List[SubspaceResponse])
@limiter.limit("50/minute")
async def list_subspaces(
    request: Request,
    space_id: int = Path(..., description="Parent space ID"),
    user_id: str = Query(..., description="Owner user ID"),
    client: Client = Depends(get_supabase_client),
):
    """
    List all subspaces for the given space and user.
    """
    repo = SubspaceRepository(client)
    result = await repo.get_by_space(space_id=space_id, user_id=user_id)

    if result.is_err():
        error = result.unwrap_err()
        logger.error(
            "Failed to list subspaces",
            extra={"space_id": space_id, "user_id": user_id, "error": {
                "type": error.error_type,
                "message": error.message,
                "context": error.context,
            }}
        )
        problem = create_problem_response(error, f"/spaces/{space_id}/subspaces")
        payload = {
            "type": getattr(problem, "type", None) or getattr(problem, "type_", None),
            "title": getattr(problem, "title", None),
            "detail": getattr(problem, "detail", None),
            "status": getattr(problem, "status", None),
            "instance": getattr(problem, "instance", None),
            "context": getattr(problem, "extra", None),
        }
        status_code = payload["status"] or 500
        return JSONResponse(status_code=status_code, content={k: v for k, v in payload.items() if v is not None})

    subspaces = result.unwrap()
    return [
        SubspaceResponse(
            id=s.id,
            space_id=s.space_id,
            name=s.name,
            description=s.description,
            user_id=s.user_id,
            artifact_count=s.artifact_count,
            confidence=s.confidence,
            learning_rate=s.learning_rate,
            centroid_embedding=s.centroid_embedding,
            markers=s.markers
        )
        for s in subspaces
    ]
