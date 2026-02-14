"""
Capture API Endpoint — Thin HTTP layer.

Only responsibilities:
- Parse request
- Auth
- Route to handler
- Convert Result to HTTP response
"""
from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi_problem.error import Problem
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from supabase import Client
import math
import re

from core.error_handlers import create_problem_response
from domain.commands import CaptureArtifactCommand
from application.handlers import CaptureHandler
from infrastructure.repositories import ArtifactRepository
from infrastructure.repositories.subspace_repo import SubspaceRepository
from infrastructure.repositories.base import get_supabase_client
from infrastructure.services.embedding_service import get_embedding_service
from infrastructure.services.margin_service import AssignmentMarginService

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
    matched_marker_ids: list[int] = Field(default_factory=list)
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


def _safe_float(value: object, default: float = 0.0) -> float:
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


def _normalize_text(text: Optional[str]) -> str:
    return (text or "").strip().lower()


def _tokenize(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", text.lower()))


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = 0.0
    norm_a = 0.0
    norm_b = 0.0
    for idx in range(len(a)):
        ai = float(a[idx])
        bi = float(b[idx])
        dot += ai * bi
        norm_a += ai * ai
        norm_b += bi * bi
    if norm_a <= 0.0 or norm_b <= 0.0:
        return 0.0
    return dot / (math.sqrt(norm_a) * math.sqrt(norm_b))


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


def _derive_marker_hints(
    client: Client,
    *,
    user_id: str,
    space_id: int,
    embedding: list[float],
    title: Optional[str],
    content: Optional[str],
) -> tuple[list[int], Optional[int]]:
    """
    Infer relevant markers/subspace from text + marker embeddings.

    Returns:
        (matched_marker_ids, inferred_subspace_id)
    """
    marker_rows = (
        client.schema("misir")
        .from_("marker")
        .select("id,label,embedding")
        .eq("space_id", space_id)
        .eq("user_id", user_id)
        .execute()
    ).data or []
    if not marker_rows:
        return ([], None)

    marker_ids = {
        row.get("id")
        for row in marker_rows
        if isinstance(row.get("id"), int)
    }

    link_rows = (
        client.schema("misir")
        .from_("subspace_marker")
        .select("subspace_id,marker_id,weight")
        .in_("marker_id", list(marker_ids))
        .execute()
    ).data or []
    marker_to_subspaces: dict[int, list[tuple[int, float]]] = {}
    for row in link_rows:
        marker_id = row.get("marker_id")
        subspace_id = row.get("subspace_id")
        if (
            not isinstance(marker_id, int)
            or marker_id not in marker_ids
            or not isinstance(subspace_id, int)
        ):
            continue
        marker_to_subspaces.setdefault(marker_id, []).append(
            (subspace_id, _safe_float(row.get("weight"), 1.0))
        )

    haystack = _normalize_text(f"{title or ''}\n{content or ''}")
    haystack_tokens = _tokenize(haystack)

    marker_scores: list[tuple[int, float]] = []
    for marker in marker_rows:
        marker_id = marker.get("id")
        label = _normalize_text(marker.get("label"))
        if not isinstance(marker_id, int) or not label:
            continue

        text_score = 0.0
        label_tokens = _tokenize(label)
        if label in haystack:
            text_score = 1.0
        elif label_tokens and label_tokens.issubset(haystack_tokens):
            text_score = 0.9
        elif label_tokens and any(token in haystack_tokens for token in label_tokens):
            text_score = 0.5

        embedding_score = 0.0
        marker_embedding = marker.get("embedding")
        if isinstance(marker_embedding, list) and marker_embedding:
            try:
                embedding_score = max(0.0, _cosine_similarity(embedding, marker_embedding))
            except Exception:
                embedding_score = 0.0

        # Blend lexical+semantic signals.
        final_score = max(text_score, embedding_score)
        if final_score >= 0.35:
            marker_scores.append((marker_id, final_score))

    if not marker_scores:
        return ([], None)

    marker_scores.sort(key=lambda item: item[1], reverse=True)
    top_markers = marker_scores[:8]
    matched_marker_ids = [marker_id for marker_id, _ in top_markers]

    subspace_scores: dict[int, float] = {}
    for marker_id, marker_score in top_markers:
        for subspace_id, weight in marker_to_subspaces.get(marker_id, []):
            subspace_scores[subspace_id] = subspace_scores.get(subspace_id, 0.0) + (marker_score * max(weight, 0.1))

    if not subspace_scores:
        return (matched_marker_ids, None)

    best_subspace = max(subspace_scores.items(), key=lambda item: item[1])[0]
    return (matched_marker_ids, best_subspace)


def _repair_embeddings_for_space(
    client: Client,
    *,
    user_id: str,
    space_id: int,
) -> None:
    """
    Best-effort repair for legacy spaces that lack marker embeddings or subspace centroids.

    This runs only when assignment failed and should not block capture.
    """
    missing_centroids = (
        client.schema("misir")
        .from_("subspace")
        .select("id")
        .eq("space_id", space_id)
        .eq("user_id", user_id)
        .is_("centroid_embedding", "null")
        .execute()
    ).data or []
    if not missing_centroids:
        return

    embedding_service = get_embedding_service()
    now_iso = datetime.now().isoformat()

    for row in missing_centroids[:32]:
        subspace_id = row.get("id")
        if not isinstance(subspace_id, int):
            continue

        links = (
            client.schema("misir")
            .from_("subspace_marker")
            .select("marker_id")
            .eq("subspace_id", subspace_id)
            .execute()
        ).data or []
        marker_ids = [item.get("marker_id") for item in links if isinstance(item.get("marker_id"), int)]
        if not marker_ids:
            continue

        marker_rows = (
            client.schema("misir")
            .from_("marker")
            .select("id,label,embedding")
            .in_("id", marker_ids)
            .eq("space_id", space_id)
            .eq("user_id", user_id)
            .execute()
        ).data or []

        vectors: list[list[float]] = []
        for marker in marker_rows:
            marker_id = marker.get("id")
            marker_embedding = marker.get("embedding")
            if isinstance(marker_embedding, list) and marker_embedding:
                vectors.append(marker_embedding)
                continue
            if not isinstance(marker_id, int):
                continue

            label = _normalize_text(marker.get("label"))
            if not label:
                continue
            try:
                generated = embedding_service.embed_text(label).vector
            except Exception:
                continue
            if not generated:
                continue
            vectors.append(generated)
            try:
                client.schema("misir").from_("marker").update({"embedding": generated}).eq("id", marker_id).execute()
            except Exception:
                pass

        centroid = _mean_embedding(vectors)
        if centroid is None:
            continue
        try:
            client.schema("misir").from_("subspace").update(
                {
                    "centroid_embedding": centroid,
                    "centroid_updated_at": now_iso,
                }
            ).eq("id", subspace_id).eq("space_id", space_id).eq("user_id", user_id).execute()
        except Exception:
            continue


def get_current_user(
    authorization: str = Header(None),
    client: Client = Depends(get_supabase_client)
) -> str:
    """
    Extract user_id from JWT token and validate with Supabase.
    """
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
    handler: CaptureHandler = Depends(get_handler),
    client: Client = Depends(get_supabase_client),
):
    """
    Capture an artifact with its signal.
    
    The backend validates shape + ranges but never computes
    reading_depth. The database is the arbiter for:
    - URL normalization
    - Domain extraction
    - Semantic engagement ordering
    - Centroid updates
    
    Raises:
        Problem (400): If validation fails
        Problem (500): If capture fails
    """
    # Handle embedding generation
    embedding = body.embedding
    if not embedding:
        # If no vector provided, we must have content to embed
        text_to_embed = body.content or body.title
        if not text_to_embed:
            raise Problem(
                status=400,
                title="Bad Request",
                detail="Either 'embedding' or 'content'/'title' must be provided",
                type_="validation-error"
            )
        
        # Generate embedding
        svc = get_embedding_service()
        embed_result = svc.embed_text(text_to_embed)
        embedding = embed_result.vector

    # Auto-assign subspace when client does not provide one.
    # This is required for topic-level counters/last-active metrics to evolve.
    inferred_marker_ids: list[int] = []
    inferred_marker_subspace_id: Optional[int] = None
    try:
        inferred_marker_ids, inferred_marker_subspace_id = _derive_marker_hints(
            client,
            user_id=current_user_id,
            space_id=body.space_id,
            embedding=embedding,
            title=body.title,
            content=body.content,
        )
    except Exception:
        # Marker hinting is best-effort and must never block capture.
        inferred_marker_ids, inferred_marker_subspace_id = ([], None)

    resolved_subspace_id = body.subspace_id
    resolved_margin = body.margin
    resolved_updates_centroid = body.updates_centroid
    if resolved_subspace_id is None:
        try:
            margin_service = AssignmentMarginService(client=client)
            margin_result = await margin_service.calculate_margin(
                signal_vector=embedding,
                user_id=current_user_id,
                space_id=body.space_id
            )
            if margin_result.nearest_subspace_id is not None:
                resolved_subspace_id = margin_result.nearest_subspace_id
                resolved_margin = margin_result.margin
                resolved_updates_centroid = margin_result.updates_centroid
                # If centroid update is blocked by low margin, marker hints can still
                # provide a stable assignment target for UI/topic stats.
                if not resolved_updates_centroid and inferred_marker_subspace_id is not None:
                    resolved_subspace_id = inferred_marker_subspace_id
        except Exception:
            # Fall back to client-provided defaults if assignment fails.
            pass
    elif inferred_marker_subspace_id is not None and resolved_subspace_id <= 0:
        resolved_subspace_id = inferred_marker_subspace_id
        resolved_updates_centroid = False

    if resolved_subspace_id is None and inferred_marker_subspace_id is not None:
        resolved_subspace_id = inferred_marker_subspace_id
        resolved_updates_centroid = False

    # Legacy-data fallback: if assignment is still unresolved, repair marker/centroid
    # embeddings for this space and retry one pass.
    if resolved_subspace_id is None:
        try:
            _repair_embeddings_for_space(
                client,
                user_id=current_user_id,
                space_id=body.space_id,
            )
        except Exception:
            pass

        try:
            retry_marker_ids, retry_marker_subspace = _derive_marker_hints(
                client,
                user_id=current_user_id,
                space_id=body.space_id,
                embedding=embedding,
                title=body.title,
                content=body.content,
            )
            inferred_marker_ids = list(dict.fromkeys([*inferred_marker_ids, *retry_marker_ids]))
            if retry_marker_subspace is not None:
                resolved_subspace_id = retry_marker_subspace
                resolved_updates_centroid = False
        except Exception:
            pass

        if resolved_subspace_id is None:
            try:
                retry_margin_result = await AssignmentMarginService(client=client).calculate_margin(
                    signal_vector=embedding,
                    user_id=current_user_id,
                    space_id=body.space_id,
                )
                if retry_margin_result.nearest_subspace_id is not None:
                    resolved_subspace_id = retry_margin_result.nearest_subspace_id
                    resolved_margin = retry_margin_result.margin
                    resolved_updates_centroid = retry_margin_result.updates_centroid
            except Exception:
                pass

    merged_marker_ids = tuple(dict.fromkeys([*body.matched_marker_ids, *inferred_marker_ids]))

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
        subspace_id=resolved_subspace_id,
        session_id=body.session_id,
        title=body.title,
        content=body.content,
        signal_magnitude=body.signal_magnitude,
        signal_type=body.signal_type,
        matched_marker_ids=merged_marker_ids,
        margin=resolved_margin,
        updates_centroid=resolved_updates_centroid,
        captured_at=body.captured_at,
    )
    
    # Handle command
    result = await handler.handle(cmd)
    
    # Convert Result to HTTP response
    if result.is_err():
        error = result.unwrap_err()
        return create_problem_response(error, str(request.url.path))
    
    capture_result = result.unwrap()
    
    return CaptureResponse(
        artifact_id=capture_result.artifact_id,
        signal_id=capture_result.signal_id,
        is_new=capture_result.is_new,
        message=capture_result.message
    )
