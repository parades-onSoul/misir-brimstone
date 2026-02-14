"""
Artifact API — CRUD operations.

Endpoints:
- GET /artifacts — List artifacts (recent)
- DELETE /artifacts/{id}
- PATCH /artifacts/{id}
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query, Header
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
from infrastructure.services.content_classifier import classify_content
from infrastructure.services.embedding_service import get_embedding_service, EmbeddingService
import asyncio

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


class ClassifyPageRequest(BaseModel):
    url: str
    title: str = ""
    content: str = ""
    wordCount: int = 0
    domain: Optional[str] = None


class ClassifyMetricsRequest(BaseModel):
    dwellTimeMs: int = 0
    scrollDepth: float = 0.0
    readingDepth: float = 0.0
    scrollEvents: int = 0


class ClassifyContentRequest(BaseModel):
    page: ClassifyPageRequest
    metrics: ClassifyMetricsRequest
    engagement: str = "latent"


class ClassifyContentResponse(BaseModel):
    engagementLevel: str
    contentSource: str
    contentType: str
    readingDepth: float
    confidence: float
    semanticRelevance: float = 0.0
    keywords: list[str]
    nlpAvailable: bool


class ClassifierStatusResponse(BaseModel):
    available: bool
    mode: str


def get_artifact_handler(client: Client = Depends(get_supabase_client)) -> ArtifactHandler:
    """Dependency for ArtifactHandler."""
    repo = ArtifactRepository(client)
    return ArtifactHandler(repo)

def get_artifact_repo(client: Client = Depends(get_supabase_client)) -> ArtifactRepository:
    """Dependency for ArtifactRepository."""
    return ArtifactRepository(client)

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


@router.get("/classify/status", response_model=ClassifierStatusResponse)
@limiter.limit("100/minute")
async def get_classifier_status(
    request: Request,
    _current_user_id: str = Depends(get_current_user),
):
    """
    Return backend classifier availability.
    """
    return ClassifierStatusResponse(available=True, mode="backend-heuristic")


@router.post("/classify", response_model=ClassifyContentResponse)
@limiter.limit("200/minute")
async def classify_artifact_content(
    request: Request,
    body: ClassifyContentRequest,
    _current_user_id: str = Depends(get_current_user),
    repo: ArtifactRepository = Depends(get_artifact_repo),
    embedding_service: EmbeddingService = Depends(get_embedding_service)
):
    """
    Classify content for potential capture.
    Now includes semantic relevance check against user's graph.
    """
    # 1. Generate Embedding (CPU bound, run in executor)
    # Truncate to reasonable length for performance (model handles 8192)
    embedding_text = f"{body.page.title} {body.page.content}"[:8000]
    
    loop = asyncio.get_running_loop()
    embedding_result = await loop.run_in_executor(
        None,
        lambda: embedding_service.embed_text(embedding_text)
    )

    # 2. Check Semantic Relevance
    # Does this content match existing markers or knowledge clusters?
    semantic_relevance = await repo.find_max_relevance_for_user(
        user_id=_current_user_id,
        content_embedding=embedding_result.vector
    )

    # 3. Classify with Relevance
    result = classify_content(
        url=body.page.url,
        title=body.page.title,
        content=body.page.content,
        word_count=max(0, body.page.wordCount),
        dwell_time_ms=max(0, body.metrics.dwellTimeMs),
        scroll_depth=max(0.0, min(1.0, body.metrics.scrollDepth)),
        reading_depth=max(0.0, min(1.5, body.metrics.readingDepth)),
        engagement=body.engagement,
        semantic_relevance=semantic_relevance
    )
    
    return ClassifyContentResponse(
        engagementLevel=result["engagementLevel"],
        contentSource=result["contentSource"],
        contentType=result["contentType"],
        readingDepth=result["readingDepth"],
        confidence=result["confidence"],
        semanticRelevance=result.get("semanticRelevance", 0.0),
        keywords=result["keywords"],
        nlpAvailable=result["nlpAvailable"],
    )


@router.get("", response_model=List[ArtifactResponse])
@limiter.limit("50/minute")
async def list_artifacts(
    request: Request,
    limit: int = Query(50, ge=1, le=1000),
    current_user_id: str = Depends(get_current_user),
    client: Client = Depends(get_supabase_client)
):
    """
    List recent artifacts across all spaces.
    """
    repo = ArtifactRepository(client)
    result = await repo.get_all_by_user(current_user_id, limit)
    
    if result.is_err():
        return create_problem_response(result.unwrap_err())
        
    return result.unwrap()


@router.patch("/{artifact_id}", response_model=dict)
@limiter.limit("50/minute")
async def update_artifact(
    request: Request,
    artifact_id: int,
    body: UpdateArtifactRequest,
    current_user_id: str = Depends(get_current_user),
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
        user_id=current_user_id,
        title=body.title,
        content=body.content,
        engagement_level=body.engagement_level,
        reading_depth=body.reading_depth
    )
    
    result = await handler.update(cmd)
    
    # Convert Result to HTTP response
    if result.is_err():
        error = result.unwrap_err()
        return create_problem_response(error, str(request.url.path))
    
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
    current_user_id: str = Depends(get_current_user),
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
        user_id=current_user_id
    )
    
    result = await handler.delete(cmd)
    
    # Convert Result to HTTP response
    if result.is_err():
        error = result.unwrap_err()
        return create_problem_response(error, str(request.url.path))
    
    deleted = result.unwrap()
    if not deleted:
        raise Problem(
            status=404,
            title="Not Found",
            detail="Artifact not found",
            type_="not-found"
        )
    
    return {"message": "Artifact deleted"}
