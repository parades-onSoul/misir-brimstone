"""
Space API — Endpoints for space management.

Endpoints:
- GET /spaces — List user's spaces
- POST /spaces — Create new space
- GET /spaces/{id} — Get space by ID
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import logging

from supabase import create_client, Client
from core.config import get_settings
from application.handlers.space_handler import (
    SpaceHandler, 
    CreateSpaceCommand, 
    ListSpacesCommand
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/spaces", tags=["spaces"])


# Request/Response models
class CreateSpaceRequest(BaseModel):
    """Request to create a space."""
    user_id: str
    name: str
    description: Optional[str] = None


class SpaceResponse(BaseModel):
    """Space response."""
    id: int
    name: str
    description: Optional[str]
    user_id: str
    artifact_count: int


class SpaceListResponse(BaseModel):
    """List of spaces response."""
    spaces: list[SpaceResponse]
    count: int


# Dependency
def get_supabase_client() -> Client:
    """Get Supabase client."""
    settings = get_settings()
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


@router.get("", response_model=SpaceListResponse)
async def list_spaces(
    user_id: str,
    client: Client = Depends(get_supabase_client)
):
    """
    List all spaces for a user.
    
    Args:
        user_id: User ID to list spaces for
    
    Returns:
        SpaceListResponse with list of spaces
    """
    try:
        handler = SpaceHandler(client)
        cmd = ListSpacesCommand(user_id=user_id)
        results = await handler.list(cmd)
        
        return SpaceListResponse(
            spaces=[
                SpaceResponse(
                    id=r.id,
                    name=r.name,
                    description=r.description,
                    user_id=r.user_id,
                    artifact_count=r.artifact_count
                )
                for r in results
            ],
            count=len(results)
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to list spaces: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("", response_model=SpaceResponse, status_code=201)
async def create_space(
    request: CreateSpaceRequest,
    client: Client = Depends(get_supabase_client)
):
    """
    Create a new space.
    
    Args:
        request: CreateSpaceRequest with name and optional description
    
    Returns:
        SpaceResponse with created space
    """
    try:
        handler = SpaceHandler(client)
        cmd = CreateSpaceCommand(
            user_id=request.user_id,
            name=request.name,
            description=request.description
        )
        result = await handler.create(cmd)
        
        return SpaceResponse(
            id=result.id,
            name=result.name,
            description=result.description,
            user_id=result.user_id,
            artifact_count=result.artifact_count
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to create space: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/{space_id}", response_model=SpaceResponse)
async def get_space(
    space_id: int,
    user_id: str,
    client: Client = Depends(get_supabase_client)
):
    """
    Get a specific space by ID.
    
    Args:
        space_id: Space ID
        user_id: User ID (for ownership check)
    
    Returns:
        SpaceResponse
    """
    try:
        handler = SpaceHandler(client)
        result = await handler.get(space_id, user_id)
        
        if result is None:
            raise HTTPException(status_code=404, detail="Space not found")
        
        return SpaceResponse(
            id=result.id,
            name=result.name,
            description=result.description,
            user_id=result.user_id,
            artifact_count=result.artifact_count
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get space: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
