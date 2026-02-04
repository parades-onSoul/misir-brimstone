"""
Capture Command Handler — Orchestrates artifact ingestion.

Validates, logs, delegates to repository.
Never computes reading_depth — only validates range.
DB is the arbiter.
"""
import logging
from typing import Optional
from dataclasses import dataclass

from domain.commands import CaptureArtifactCommand
from infrastructure.repositories import ArtifactRepository, CaptureResult
from core.config_cache import config_cache

logger = logging.getLogger(__name__)


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
    
    def __init__(self, repo: ArtifactRepository):
        self._repo = repo
    
    async def handle(self, cmd: CaptureArtifactCommand) -> CaptureResult:
        """
        Handle capture command.
        
        1. Validate embedding dimension (from config)
        2. Log suspicious reading_depth (don't reject)
        3. Call repository (RPC)
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
        
        logger.info(
            f"Captured artifact: id={result.artifact_id}, "
            f"signal={result.signal_id}, is_new={result.is_new}"
        )
        
        return result
    
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
        valid_levels = ['latent', 'discovered', 'engaged', 'saturated']
        if cmd.engagement_level not in valid_levels:
            errors.append(f"Invalid engagement_level: {cmd.engagement_level}")
        
        # Check content source is valid
        valid_sources = ['web', 'pdf', 'video', 'ebook', 'other']
        if cmd.content_source not in valid_sources:
            errors.append(f"Invalid content_source: {cmd.content_source}")
        
        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )
