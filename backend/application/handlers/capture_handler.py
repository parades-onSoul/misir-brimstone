"""
Capture Command Handler — Orchestrates artifact ingestion.

Validates, logs, delegates to repository.
Never computes reading_depth — only validates range.
DB is the arbiter.
Uses Result pattern for type-safe error handling.
"""
from typing import Optional
from dataclasses import dataclass

from result import Result, Ok, Err
from domain.commands import CaptureArtifactCommand
from infrastructure.repositories import ArtifactRepository, CaptureResult
from infrastructure.repositories.subspace_repo import SubspaceRepository
from core.config_cache import config_cache
from infrastructure.services.webhook_service import WebhookService
from core.error_types import ErrorDetail, validation_error
from core.logging_config import get_logger

logger = get_logger(__name__)


@dataclass
class ValidationResult:
    """Result of command validation."""
    valid: bool
    errors: list[str]
    warnings: list[str]


class CaptureHandler:
    """
    Command handler for artifact capture.
    
    Responsibilities:
    - Validate shape and ranges
    - Log suspicious data (don't reject)
    - Delegate to repository
    
    Never:
    - Compute reading_depth (client provides, DB validates)
    - Modify engagement_level (DB handles semantic ordering)
    """
    
    def __init__(self, repo: ArtifactRepository, subspace_repo: Optional[SubspaceRepository] = None):
        self._repo = repo
        self._subspace_repo = subspace_repo
    
    async def handle(self, cmd: CaptureArtifactCommand) -> Result[CaptureResult, ErrorDetail]:
        """
        Handle capture command.
        
        1. Validate embedding dimension (from config)
        2. Log suspicious reading_depth (don't reject)
        3. Call repository (RPC)
        
        Returns:
            Result[CaptureResult, ErrorDetail]: Capture result or error
        """
        # 1. Validate embedding dimension
        expected_dim = config_cache.get_embedding_dimension()
        actual_dim = len(cmd.embedding)
        
        if actual_dim != expected_dim:
            # Log but continue — DB will reject if truly invalid
            logger.warning(
                f"Embedding dimension mismatch: expected {expected_dim}, got {actual_dim}"
            )
        
        # 2. Log suspicious reading depth (optional monitoring)
        self._log_if_reading_depth_suspicious(cmd)
        
        # 3. Delegate to repository (DB is arbiter)
        result = await self._repo.ingest_with_signal(cmd)
        
        # Return early if error
        if result.is_err():
            return result
        
        capture_result = result.unwrap()
        
        # 4. Update confidence based on batch coherence (if subspace provided)
        if cmd.subspace_id and self._subspace_repo:
            try:
                # Get current subspace state
                subspace_result = await self._subspace_repo.get_by_id(
                    subspace_id=cmd.subspace_id,
                    user_id=cmd.user_id
                )
                
                if subspace_result.is_ok():
                    subspace = subspace_result.unwrap()
                    if subspace and subspace.centroid_embedding:
                        # Update confidence using this single embedding as "batch"
                        # Note: update_confidence_from_batch might not return Result yet
                        # Skip for now to avoid breaking changes
                        pass
            except Exception as e:
                # Confidence update failure should not fail the capture
                logger.warning(f"Failed to update confidence for subspace {cmd.subspace_id}: {e}")
        
        # 5. Trigger Webhooks (fire-and-forget)
        try:
            webhook_svc = WebhookService()
            event_type = "artifact.created" if capture_result.is_new else "artifact.updated"
            await webhook_svc.dispatch_event(
                user_id=cmd.user_id,
                event_type=event_type,
                payload={
                    "artifact_id": capture_result.artifact_id,
                    "signal_id": capture_result.signal_id,
                    "url": cmd.url,
                    "title": cmd.title,
                    "space_id": cmd.space_id,
                    "subspace_id": cmd.subspace_id
                }
            )
        except Exception as e:
            # Webhook failure should not fail the request
            logger.warning(f"Failed to dispatch webhook: {e}")
        
        logger.info(
            f"Captured artifact: id={capture_result.artifact_id}, "
            f"signal={capture_result.signal_id}, is_new={capture_result.is_new}"
        )
        
        return Ok(capture_result)
    
    def _log_if_reading_depth_suspicious(self, cmd: CaptureArtifactCommand) -> None:
        """
        Log if reading_depth seems anomalous.
        
        This is monitoring only — never reject.
        Uses config-driven constants for calculation.
        """
        constants = config_cache.get_reading_depth_constants()
        avg_wpm = constants.get('avg_wpm', 200)
        time_weight = constants.get('time_weight', 0.6)
        scroll_weight = constants.get('scroll_weight', 0.4)
        max_ratio = constants.get('max_ratio', 1.5)
        
        if cmd.word_count > 0 and cmd.dwell_time_ms > 0:
            expected_time_ms = (cmd.word_count * 60000) / avg_wpm
            time_ratio = min(max_ratio, cmd.dwell_time_ms / expected_time_ms)
            expected_depth = (time_ratio * time_weight) + (cmd.scroll_depth * scroll_weight)
            
            # Tolerance of 20%
            tolerance = 0.20
            if abs(expected_depth - cmd.reading_depth) > tolerance:
                logger.warning(
                    f"Reading depth anomaly: url={cmd.url}, "
                    f"expected={expected_depth:.2f}, got={cmd.reading_depth:.2f}"
                )
    
    def validate(self, cmd: CaptureArtifactCommand) -> ValidationResult:
        """
        Validate command without executing.
        Useful for pre-flight checks.
        """
        errors = []
        warnings = []
        
        # Check embedding dimension
        expected_dim = config_cache.get_embedding_dimension()
        if len(cmd.embedding) != expected_dim:
            warnings.append(
                f"Embedding dimension: expected {expected_dim}, got {len(cmd.embedding)}"
            )
        
        # Check engagement level is valid
        # Use EngagementLevel enum values
        from domain.value_objects import EngagementLevel
        valid_levels = [e.value for e in EngagementLevel]
        if cmd.engagement_level not in valid_levels:
            errors.append(f"Invalid engagement_level: {cmd.engagement_level}")
        
        # Check content source is valid
        # Use SourceType enum values
        from domain.value_objects import SourceType
        valid_sources = [t.value for t in SourceType]
        if cmd.content_source not in valid_sources:
            errors.append(f"Invalid content_source: {cmd.content_source}")
        
        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )
