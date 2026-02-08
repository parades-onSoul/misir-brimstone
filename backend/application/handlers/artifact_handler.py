"""
Artifact Handler — Orchestrates artifact updates and deletions.
"""
import logging
from typing import Optional

from result import Result, Ok, Err
from domain.commands import UpdateArtifactCommand, DeleteArtifactCommand
from infrastructure.repositories import ArtifactRepository
from core.error_types import ErrorDetail
from core.logging_config import get_logger

logger = get_logger(__name__)


class ArtifactHandler:
    """
    Handler for existing artifact operations (update, delete).
    Distinct from CaptureHandler which handles new ingestion.
    """
    
    def __init__(self, repo: ArtifactRepository):
        self._repo = repo
        
    async def update(self, cmd: UpdateArtifactCommand) -> Result[bool, ErrorDetail]:
        """
        Handle artifact update.
        
        Args:
            cmd: Update command
            
        Returns:
            Result[bool, ErrorDetail] - True if updated, False if not found
        """
        # Update artifact fields
        return await self._repo.update_artifact(cmd)
        
    async def delete(self, cmd: DeleteArtifactCommand) -> Result[bool, ErrorDetail]:
        """
        Handle artifact deletion.
        
        Args:
            cmd: Delete command
            
        Returns:
            Result[bool, ErrorDetail] - True if deleted, False if not found
        """
        # Soft delete artifact (signals effectively hidden from search)
        return await self._repo.delete_artifact(cmd.artifact_id, cmd.user_id)
