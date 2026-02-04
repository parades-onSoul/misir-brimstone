"""
Artifact API — CRUD operations.

Endpoints:
- DELETE /artifacts/{id}
- PATCH /artifacts/{id}
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional

from supabase import Client
from core.limiter import limiter
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


def get_artifact_handler(client: Client = Depends(get_supabase_client)) -> ArtifactHandler:
    """Dependency for ArtifactHandler."""
    repo = ArtifactRepository(client)
    return ArtifactHandler(repo)


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
    """
    cmd = UpdateArtifactCommand(
        artifact_id=artifact_id,
        user_id=user_id,
        title=body.title,
        content=body.content,
        engagement_level=body.engagement_level,
        reading_depth=body.reading_depth
    )
    
    try:
        updated = await handler.update(cmd)
        if not updated:
            raise HTTPException(status_code=404, detail="Artifact not found")
        return {"message": "Artifact updated"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    """
    cmd = DeleteArtifactCommand(
        artifact_id=artifact_id,
        user_id=user_id
    )
    
    try:
        deleted = await handler.delete(cmd)
        if not deleted:
            raise HTTPException(status_code=404, detail="Artifact not found")
        return {"message": "Artifact deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
