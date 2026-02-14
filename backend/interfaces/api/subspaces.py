"""
Subspace API.

Endpoints:
- GET /spaces/{space_id}/subspaces
- POST /spaces/{space_id}/subspaces
- PATCH /spaces/{space_id}/subspaces/{subspace_id}
- DELETE /spaces/{space_id}/subspaces/{subspace_id}
- POST /spaces/{space_id}/subspaces/{subspace_id}/merge
"""
from typing import Optional, List
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Path, Request, Header, HTTPException
from fastapi_problem.error import Problem
from pydantic import BaseModel, Field
from supabase import create_client, Client

from core.config import get_settings
from core.error_handlers import create_problem_response
from core.logging_config import get_logger
from core.limiter import limiter
from infrastructure.repositories.subspace_repo import SubspaceRepository, SubspaceResult
from infrastructure.services.embedding_service import get_embedding_service

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
    centroid_updated_at: Optional[str] = None
    last_active_at: Optional[str] = None
    recent_artifact_count: Optional[int] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    markers: List[str] = []


class CreateSubspaceRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    markers: List[str] = []


class UpdateSubspaceRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None


class MergeSubspaceRequest(BaseModel):
    target_subspace_id: int = Field(gt=0)


class DeleteSubspaceResponse(BaseModel):
    deleted: bool


class MergeSubspaceResponse(BaseModel):
    merged: bool
    source_subspace_id: int
    target_subspace_id: int
    moved_artifacts: int


def get_supabase_client() -> Client:
    """Backend uses service key to bypass RLS for server-side operations."""
    settings = get_settings()
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY or settings.SUPABASE_KEY)


def get_current_user(
    authorization: str = Header(None),
    client: Client = Depends(get_supabase_client)
) -> str:
    """Extract user_id from Bearer JWT token."""
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="Authorization header required")

        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization format")

        token = authorization.split(" ")[1]
        user = client.auth.get_user(token)
        if not user or not user.user:
            raise HTTPException(status_code=401, detail="Invalid token")

        return user.user.id
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {e}")


def _to_response(subspace: SubspaceResult) -> SubspaceResponse:
    return SubspaceResponse(
        id=subspace.id,
        space_id=subspace.space_id,
        name=subspace.name,
        description=subspace.description,
        user_id=subspace.user_id,
        artifact_count=subspace.artifact_count,
        confidence=subspace.confidence,
        learning_rate=subspace.learning_rate,
        centroid_embedding=subspace.centroid_embedding,
        centroid_updated_at=subspace.centroid_updated_at,
        last_active_at=subspace.last_active_at,
        recent_artifact_count=subspace.recent_artifact_count,
        created_at=subspace.created_at,
        updated_at=subspace.updated_at,
        markers=subspace.markers,
    )


def _mean_embedding(vectors: list[list[float]]) -> Optional[list[float]]:
    if not vectors:
        return None
    dim = len(vectors[0])
    if dim == 0:
        return None
    accumulator = [0.0] * dim
    count = 0
    for vec in vectors:
        if len(vec) != dim:
            continue
        for idx, value in enumerate(vec):
            accumulator[idx] += float(value)
        count += 1
    if count == 0:
        return None
    return [value / count for value in accumulator]


def _ensure_space_ownership(client: Client, space_id: int, user_id: str) -> None:
    space_res = (
        client.schema("misir")
        .from_("space")
        .select("id")
        .eq("id", space_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not (space_res.data and len(space_res.data) > 0):
        raise Problem(
            status=404,
            title="Not Found",
            detail=f"Space with id {space_id} not found",
            type_="space-not-found",
        )


@router.get("/{space_id}/subspaces", response_model=List[SubspaceResponse])
@limiter.limit("50/minute")
async def list_subspaces(
    request: Request,
    space_id: int = Path(..., description="Parent space ID"),
    current_user_id: str = Depends(get_current_user),
    client: Client = Depends(get_supabase_client),
):
    """List all subspaces for a space (JWT-scoped)."""
    repo = SubspaceRepository(client)
    result = await repo.get_by_space(space_id=space_id, user_id=current_user_id)

    if result.is_err():
        error = result.unwrap_err()
        logger.error(
            "Failed to list subspaces",
            extra={
                "space_id": space_id,
                "user_id": current_user_id,
                "error": {
                    "type": error.error_type,
                    "message": error.message,
                    "context": error.context,
                },
            },
        )
        return create_problem_response(error, f"/spaces/{space_id}/subspaces")

    return [_to_response(s) for s in result.unwrap()]


@router.post("/{space_id}/subspaces", response_model=SubspaceResponse, status_code=201)
@limiter.limit("30/minute")
async def create_subspace(
    request: Request,
    body: CreateSubspaceRequest,
    space_id: int = Path(..., description="Parent space ID"),
    current_user_id: str = Depends(get_current_user),
    client: Client = Depends(get_supabase_client),
):
    """Create a subspace in a space (JWT-scoped)."""
    _ensure_space_ownership(client, space_id, current_user_id)

    name = body.name.strip()
    if not name:
        raise Problem(status=400, title="Bad Request", detail="name cannot be empty", type_="validation-error")

    created = (
        client.schema("misir")
        .from_("subspace")
        .insert(
            {
                "space_id": space_id,
                "user_id": current_user_id,
                "name": name,
                "description": body.description,
                "confidence": 0.0,
                "learning_rate": 0.1,
            }
        )
        .execute()
    )
    if not (created.data and len(created.data) > 0):
        raise Problem(status=500, title="Create Failed", detail="Failed to create subspace", type_="create-subspace-error")

    subspace_id = created.data[0]["id"]

    marker_labels = []
    seen_labels = set()
    for marker in body.markers:
        label = marker.strip()
        normalized = label.lower()
        if label and normalized not in seen_labels:
            seen_labels.add(normalized)
            marker_labels.append(label)

    marker_links = []
    marker_embeddings: list[list[float]] = []
    embedding_service = get_embedding_service()
    for label in marker_labels:
        existing = (
            client.schema("misir")
            .from_("marker")
            .select("id, embedding")
            .eq("space_id", space_id)
            .eq("label", label)
            .limit(1)
            .execute()
        )
        if existing.data:
            marker_id = existing.data[0]["id"]
            existing_embedding = existing.data[0].get("embedding")
            if isinstance(existing_embedding, list) and existing_embedding:
                marker_embeddings.append(existing_embedding)
            else:
                try:
                    generated = embedding_service.embed_text(label).vector
                    marker_embeddings.append(generated)
                    client.schema("misir").from_("marker").update(
                        {"embedding": generated}
                    ).eq("id", marker_id).eq("space_id", space_id).execute()
                except Exception:
                    pass
        else:
            generated_embedding = None
            try:
                generated_embedding = embedding_service.embed_text(label).vector
            except Exception:
                generated_embedding = None

            inserted = (
                client.schema("misir")
                .from_("marker")
                .insert({
                    "space_id": space_id,
                    "user_id": current_user_id,
                    "label": label,
                    "weight": 1.0,
                    "embedding": generated_embedding,
                })
                .execute()
            )
            if not (inserted.data and len(inserted.data) > 0):
                continue
            marker_id = inserted.data[0]["id"]
            if isinstance(generated_embedding, list) and generated_embedding:
                marker_embeddings.append(generated_embedding)
        marker_links.append({
            "subspace_id": subspace_id,
            "marker_id": marker_id,
            "weight": 1.0,
            "source": "user_defined",
        })

    if marker_links:
        client.schema("misir").from_("subspace_marker").upsert(
            marker_links, on_conflict="subspace_id,marker_id"
        ).execute()

    centroid = _mean_embedding(marker_embeddings)
    if centroid is not None:
        client.schema("misir").from_("subspace").update(
            {
                "centroid_embedding": centroid,
                "centroid_updated_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", subspace_id).eq("space_id", space_id).eq("user_id", current_user_id).execute()

    repo = SubspaceRepository(client)
    fetched = await repo.get_by_id(subspace_id, current_user_id)
    if fetched.is_ok() and fetched.unwrap():
        return _to_response(fetched.unwrap())

    raise Problem(status=500, title="Create Failed", detail="Created subspace but failed to fetch it", type_="create-subspace-error")


@router.patch("/{space_id}/subspaces/{subspace_id}", response_model=SubspaceResponse)
@limiter.limit("50/minute")
async def update_subspace(
    request: Request,
    body: UpdateSubspaceRequest,
    space_id: int = Path(..., description="Parent space ID"),
    subspace_id: int = Path(..., description="Subspace ID"),
    current_user_id: str = Depends(get_current_user),
    client: Client = Depends(get_supabase_client),
):
    """Update subspace name/description (JWT-scoped)."""
    if body.name is None and body.description is None:
        raise Problem(status=400, title="Bad Request", detail="At least one field is required", type_="validation-error")

    update_data: dict[str, Optional[str]] = {}
    if body.name is not None:
        normalized_name = body.name.strip()
        if not normalized_name:
            raise Problem(status=400, title="Bad Request", detail="name cannot be empty", type_="validation-error")
        update_data["name"] = normalized_name
    if body.description is not None:
        update_data["description"] = body.description

    updated = (
        client.schema("misir")
        .from_("subspace")
        .update(update_data)
        .eq("id", subspace_id)
        .eq("space_id", space_id)
        .eq("user_id", current_user_id)
        .execute()
    )
    if not (updated.data and len(updated.data) > 0):
        raise Problem(status=404, title="Not Found", detail="Subspace not found", type_="subspace-not-found")

    repo = SubspaceRepository(client)
    fetched = await repo.get_by_id(subspace_id, current_user_id)
    if fetched.is_ok() and fetched.unwrap():
        return _to_response(fetched.unwrap())

    raise Problem(status=500, title="Update Failed", detail="Updated subspace but failed to fetch it", type_="update-subspace-error")


@router.delete("/{space_id}/subspaces/{subspace_id}", response_model=DeleteSubspaceResponse)
@limiter.limit("30/minute")
async def delete_subspace(
    request: Request,
    space_id: int = Path(..., description="Parent space ID"),
    subspace_id: int = Path(..., description="Subspace ID"),
    current_user_id: str = Depends(get_current_user),
    client: Client = Depends(get_supabase_client),
):
    """Delete a subspace (JWT-scoped)."""
    deleted = (
        client.schema("misir")
        .from_("subspace")
        .delete()
        .eq("id", subspace_id)
        .eq("space_id", space_id)
        .eq("user_id", current_user_id)
        .execute()
    )
    if not (deleted.data and len(deleted.data) > 0):
        raise Problem(status=404, title="Not Found", detail="Subspace not found", type_="subspace-not-found")
    return DeleteSubspaceResponse(deleted=True)


@router.post("/{space_id}/subspaces/{subspace_id}/merge", response_model=MergeSubspaceResponse)
@limiter.limit("20/minute")
async def merge_subspace(
    request: Request,
    body: MergeSubspaceRequest,
    space_id: int = Path(..., description="Parent space ID"),
    subspace_id: int = Path(..., description="Source subspace ID"),
    current_user_id: str = Depends(get_current_user),
    client: Client = Depends(get_supabase_client),
):
    """Merge a source subspace into target (moves artifacts/signals, then deletes source)."""
    target_subspace_id = body.target_subspace_id
    if target_subspace_id == subspace_id:
        raise Problem(status=400, title="Bad Request", detail="Cannot merge a topic into itself", type_="validation-error")

    pair = (
        client.schema("misir")
        .from_("subspace")
        .select("id")
        .in_("id", [subspace_id, target_subspace_id])
        .eq("space_id", space_id)
        .eq("user_id", current_user_id)
        .execute()
    )
    found_ids = {row["id"] for row in (pair.data or [])}
    if subspace_id not in found_ids or target_subspace_id not in found_ids:
        raise Problem(status=404, title="Not Found", detail="Source or target subspace not found", type_="subspace-not-found")

    # Move artifacts and signals to target.
    moved_artifacts_res = (
        client.schema("misir")
        .from_("artifact")
        .update({"subspace_id": target_subspace_id})
        .eq("space_id", space_id)
        .eq("user_id", current_user_id)
        .eq("subspace_id", subspace_id)
        .execute()
    )
    moved_artifacts = len(moved_artifacts_res.data or [])

    client.schema("misir").from_("signal").update({"subspace_id": target_subspace_id}).eq("space_id", space_id).eq(
        "user_id", current_user_id
    ).eq("subspace_id", subspace_id).execute()

    # Merge marker associations.
    source_markers = (
        client.schema("misir")
        .from_("subspace_marker")
        .select("marker_id, weight")
        .eq("subspace_id", subspace_id)
        .execute()
    ).data or []
    if source_markers:
        upserts = [
            {
                "subspace_id": target_subspace_id,
                "marker_id": row["marker_id"],
                "weight": row.get("weight", 1.0),
                "source": "suggested",
            }
            for row in source_markers
        ]
        client.schema("misir").from_("subspace_marker").upsert(upserts, on_conflict="subspace_id,marker_id").execute()

    # Delete source subspace.
    deleted = (
        client.schema("misir")
        .from_("subspace")
        .delete()
        .eq("id", subspace_id)
        .eq("space_id", space_id)
        .eq("user_id", current_user_id)
        .execute()
    )
    if not (deleted.data and len(deleted.data) > 0):
        raise Problem(status=500, title="Merge Failed", detail="Failed to delete source subspace", type_="merge-subspace-error")

    # Refresh target artifact_count for consistency.
    target_artifacts = (
        client.schema("misir")
        .from_("artifact")
        .select("id")
        .eq("space_id", space_id)
        .eq("user_id", current_user_id)
        .eq("subspace_id", target_subspace_id)
        .execute()
    ).data or []
    client.schema("misir").from_("subspace").update({"artifact_count": len(target_artifacts)}).eq("id", target_subspace_id).eq(
        "user_id", current_user_id
    ).execute()

    return MergeSubspaceResponse(
        merged=True,
        source_subspace_id=subspace_id,
        target_subspace_id=target_subspace_id,
        moved_artifacts=moved_artifacts,
    )
