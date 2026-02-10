"""
Space API — Endpoints for space management.

Endpoints:
- GET /spaces — List user's spaces
- POST /spaces — Create new space
- GET /spaces/{id} — Get space by ID

Uses RFC 9457 Problem Details for standardized error responses.
"""
from fastapi import APIRouter, Depends, Path, Query, Request
from fastapi_problem.error import Problem
from pydantic import BaseModel
from typing import Optional

from supabase import create_client, Client
from core.config import get_settings
from core.logging_config import get_logger
from application.handlers.space_handler import (
    SpaceHandler, 
    CreateSpaceCommand, 
    ListSpacesCommand
)

logger = get_logger(__name__)
router = APIRouter(prefix="/spaces", tags=["spaces"])


# Request/Response models
class CreateMarkerInput(BaseModel):
    """Marker to create for a subspace."""
    text: str


class CreateSubspaceInput(BaseModel):
    """Subspace to create with a space."""
    name: str
    description: Optional[str] = None
    markers: list[str] = []
    depth: Optional[str] = None
    prerequisites: list[str] = []
    suggested_study_order: Optional[int] = None


class CreateSpaceRequest(BaseModel):
    """Request to create a space."""
    user_id: Optional[str] = None  # Can come from JWT
    name: str
    description: Optional[str] = None
    intention: Optional[str] = None
    subspaces: list[CreateSubspaceInput] = []


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
class DeleteSpaceResponse(BaseModel):
    deleted: bool



# Dependency
def get_supabase_client() -> Client:
    """Get Supabase client."""
    settings = get_settings()
    # Use service role key on the backend to bypass RLS for server-side operations
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY or settings.SUPABASE_KEY)


from core.limiter import limiter

@router.get("", response_model=SpaceListResponse)
@limiter.limit("50/minute")
async def list_spaces(
    request: Request,
    user_id: str,
    client: Client = Depends(get_supabase_client)
):
    """
    List all spaces for a user.
    
    Args:
        user_id: User ID to list spaces for
    
    Returns:
        SpaceListResponse with list of spaces
        
    Raises:
        Problem (400): If user_id is invalid
        Problem (500): If an unexpected error occurs
    """
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


@router.post("", response_model=SpaceResponse, status_code=201)
@limiter.limit("50/minute")
async def create_space(
    request: Request,
    body: CreateSpaceRequest,
    client: Client = Depends(get_supabase_client)
):
    """
    Create a new space.
    
    Args:
        body: CreateSpaceRequest with name and optional description
    
    Returns:
        SpaceResponse with created space
        
    Raises:
        Problem (400): If validation fails
        Problem (500): If an unexpected error occurs
    """
    handler = SpaceHandler(client)
    
    # Extract user_id from body or use default (should come from JWT in production)
    user_id = body.user_id if body.user_id else "anonymous"
    
    # Convert subspaces to dict format
    subspaces_data = [
        {
            'name': sub.name,
            'description': sub.description,
            'markers': sub.markers,
            'depth': sub.depth,
            'prerequisites': sub.prerequisites,
            'suggested_study_order': sub.suggested_study_order
        }
        for sub in body.subspaces
    ] if body.subspaces else []
    
    cmd = CreateSpaceCommand(
        user_id=user_id,
        name=body.name,
        description=body.description,
        intention=body.intention,
        subspaces=subspaces_data
    )
    result = await handler.create(cmd)
    
    return SpaceResponse(
        id=result.id,
        name=result.name,
        description=result.description,
        user_id=result.user_id,
        artifact_count=result.artifact_count
    )


@router.delete("/{space_id}", response_model=DeleteSpaceResponse)
@limiter.limit("50/minute")
async def delete_space(
    request: Request,
    space_id: int = Path(..., description="Space ID"),
    user_id: str = Query(..., description="Owner user ID"),
    client: Client = Depends(get_supabase_client)
):
    """Delete a space for the given user."""
    handler = SpaceHandler(client)
    try:
        deleted = await handler.delete(space_id, user_id)
    except Exception as e:
        logger.error("Failed to delete space", extra={"space_id": space_id, "user_id": user_id, "error": str(e)})
        raise Problem(
            status=500,
            title="Delete Failed",
            detail="An unexpected error occurred while deleting the space.",
            type_="delete-space-error"
        )

    if not deleted:
        raise Problem(
            status=404,
            title="Not Found",
            detail=f"Space with id {space_id} not found",
            type_="space-not-found"
        )

    return DeleteSpaceResponse(deleted=True)


@router.get("/{space_id}", response_model=SpaceResponse)
@limiter.limit("50/minute")
async def get_space(
    request: Request,
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
        
    Raises:
        Problem (404): If space not found
        Problem (500): If an unexpected error occurs
    """
    handler = SpaceHandler(client)
    result = await handler.get(space_id, user_id)
    
    if result is None:
        raise Problem(
            status=404,
            title="Not Found",
            detail=f"Space with id {space_id} not found",
            type_="space-not-found"
        )
    
    return SpaceResponse(
        id=result.id,
        name=result.name,
        description=result.description,
        user_id=result.user_id,
        artifact_count=result.artifact_count
    )
