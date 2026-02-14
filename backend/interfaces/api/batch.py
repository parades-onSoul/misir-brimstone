"""
Batch API — Bulk operations.

Endpoints:
- POST /artifacts/batch — Batch capture artifacts
"""
from fastapi import APIRouter, Depends, Request
from fastapi_problem.error import Problem
from pydantic import BaseModel, Field
from typing import List

from core.limiter import limiter
from domain.commands import CaptureArtifactCommand
from application.handlers import CaptureHandler
from interfaces.api.capture import (
    CaptureRequest,
    CaptureResponse,
    get_current_user,
    get_handler,
)

router = APIRouter(tags=["batch"])


class BatchCaptureRequest(BaseModel):
    """Batch capture request."""
    artifacts: List[CaptureRequest] = Field(..., max_length=100, description="List of artifacts to capture")


class BatchCaptureResponse(BaseModel):
    """Batch capture response."""
    successful: List[CaptureResponse]
    failed: List[dict]
    count: int


@router.post("/batch", response_model=BatchCaptureResponse)
@limiter.limit("20/minute")  # Stricter limit for batch ops
async def batch_capture(
    request: Request,
    body: BatchCaptureRequest,
    current_user_id: str = Depends(get_current_user),
    handler: CaptureHandler = Depends(get_handler)
):
    """
    Batch capture artifacts.
    
    Max 100 artifacts per request.
    Wraps individual capture logic.
    
    Raises:
        Problem (400): If validation fails
        Problem (500): If batch operation fails
    """
    successful = []
    failed = []
    
    for i, item in enumerate(body.artifacts):
        try:
            # Re-use logic from single capture
            # 1. Handle embedding
            embedding = item.embedding
            if not embedding:
                # If no vector provided, we must have content to embed
                text_to_embed = item.content or item.title
                if not text_to_embed:
                    raise ValueError("Either 'embedding' or 'content'/'title' must be provided")
                
                # Generate embedding (TODO: Batch embedding generation for performance)
                from infrastructure.services.embedding_service import get_embedding_service
                svc = get_embedding_service()
                embed_result = svc.embed_text(text_to_embed)
                embedding = embed_result.vector

            # 2. Convert to command
            cmd = CaptureArtifactCommand(
                user_id=current_user_id,
                space_id=item.space_id,
                url=item.url,
                embedding=embedding,
                reading_depth=item.reading_depth,
                scroll_depth=item.scroll_depth,
                dwell_time_ms=item.dwell_time_ms,
                word_count=item.word_count,
                engagement_level=item.engagement_level,
                content_source=item.content_source,
                subspace_id=item.subspace_id,
                session_id=item.session_id,
                title=item.title,
                content=item.content,
                signal_magnitude=item.signal_magnitude,
                signal_type=item.signal_type,
                matched_marker_ids=tuple(item.matched_marker_ids),
                captured_at=item.captured_at
            )
            
            # 3. Handle command
            result = await handler.handle(cmd)
            
            # Unwrap Result
            if result.is_err():
                error = result.unwrap_err()
                failed.append({
                    "index": i,
                    "url": item.url,
                    "error": f"{error.error_code}: {error.message}"
                })
                continue
            
            capture_result = result.unwrap()
            
            successful.append(CaptureResponse(
                artifact_id=capture_result.artifact_id,
                signal_id=capture_result.signal_id,
                is_new=capture_result.is_new,
                message=capture_result.message
            ))
            
        except Exception as e:
            failed.append({
                "index": i,
                "url": item.url,
                "error": str(e)
            })
    
    return BatchCaptureResponse(
        successful=successful,
        failed=failed,
        count=len(successful)
    )
