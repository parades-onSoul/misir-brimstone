"""
Artifact API — CRUD operations.

Endpoints:
- GET /artifacts — List artifacts (recent)
- DELETE /artifacts/{id}
- PATCH /artifacts/{id}
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from fastapi_problem.error import Problem
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from supabase import Client
from core.limiter import limiter
from core.error_handlers import create_problem_response
from domain.commands import UpdateArtifactCommand, DeleteArtifactCommand
from application.handlers.artifact_handler import ArtifactHandler
from infrastructure.repositories import ArtifactRepository
from infrastructure.repositories.base import get_supabase_client

router = APIRouter()


class UpdateArtifactRequest(BaseModel):
    """Request model for updating an artifact."""
    title: Optional[str] = None
    content: Optional[str] = None
    engagement_level: Optional[str] = None
    reading_depth: Optional[float] = None

class ArtifactResponse(BaseModel):
    id: int
    title: Optional[str]
    url: str
    domain: Optional[str]
    created_at: datetime
    captured_at: Optional[datetime]
    engagement_level: str
    subspace_id: Optional[int]
    space_id: int


def get_artifact_handler(client: Client = Depends(get_supabase_client)) -> ArtifactHandler:
    """Dependency for ArtifactHandler."""
    repo = ArtifactRepository(client)
    return ArtifactHandler(repo)

@router.get("", response_model=List[ArtifactResponse])
@limiter.limit("50/minute")
async def list_artifacts(
    request: Request,
    user_id: str,
    limit: int = Query(50, ge=1, le=100),
    client: Client = Depends(get_supabase_client)
):
    """
    List recent artifacts across all spaces.
    """
    repo = ArtifactRepository(client)
    result = await repo.get_all_by_user(user_id, limit)
    
    if result.is_err():
        return create_problem_response(result.unwrap_err())
        
    return result.unwrap()


@router.patch("/{artifact_id}", response_model=dict)
@limiter.limit("50/minute")
async def update_artifact(
    request: Request,
    artifact_id: int,
    body: UpdateArtifactRequest,
    user_id: str, # TODO: Extract from auth token in production
    handler: ArtifactHandler = Depends(get_artifact_handler)
):
    """
    Update an artifact.
    
    Allowed fields: title, content, engagement_level, reading_depth.
    
    Raises:
        Problem (400): If validation fails
        Problem (404): If artifact not found
        Problem (500): If update fails
    """
    cmd = UpdateArtifactCommand(
        artifact_id=artifact_id,
        user_id=user_id,
        title=body.title,
        content=body.content,
        engagement_level=body.engagement_level,
        reading_depth=body.reading_depth
    )
    
    result = await handler.update(cmd)
    
    # Convert Result to HTTP response
    if result.is_err():
        error = result.unwrap_err()
        raise create_problem_response(error, str(request.url.path))
    
    updated = result.unwrap()
    if not updated:
        raise Problem(
            status=404,
            title="Not Found",
            detail="Artifact not found",
            type_="not-found"
        )
    
    return {"message": "Artifact updated"}


@router.delete("/{artifact_id}", response_model=dict)
@limiter.limit("50/minute")
async def delete_artifact(
    request: Request,
    artifact_id: int,
    user_id: str, # TODO: Extract from auth token
    handler: ArtifactHandler = Depends(get_artifact_handler)
):
    """
    Soft-delete an artifact.
    
    Raises:
        Problem (404): If artifact not found
        Problem (500): If deletion fails
    """
    cmd = DeleteArtifactCommand(
        artifact_id=artifact_id,
        user_id=user_id
    )
    
    result = await handler.delete(cmd)
    
    # Convert Result to HTTP response
    if result.is_err():
        error = result.unwrap_err()
        raise create_problem_response(error, str(request.url.path))
    
    deleted = result.unwrap()
    if not deleted:
        raise Problem(
            status=404,
            title="Not Found",
            detail="Artifact not found",
            type_="not-found"
        )
    
    return {"message": "Artifact deleted"}
