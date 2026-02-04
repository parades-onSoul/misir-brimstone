"""
Artifact Handler — Orchestrates artifact updates and deletions.
"""
import logging
from typing import Optional

from domain.commands import UpdateArtifactCommand, DeleteArtifactCommand
from infrastructure.repositories import ArtifactRepository

logger = logging.getLogger(__name__)


class ArtifactHandler:
    """
    Handler for existing artifact operations (update, delete).
    Distinct from CaptureHandler which handles new ingestion.
    """
    
    def __init__(self, repo: ArtifactRepository):
        self._repo = repo
        
    async def update(self, cmd: UpdateArtifactCommand) -> bool:
        """
        Handle artifact update.
        python
        Args:
            cmd: Update command
            
        Returns:
            True if updated, False if not found
        """
        # 1. Update artifact fields
        return await self._repo.update_artifact(cmd)
        
    async def delete(self, cmd: DeleteArtifactCommand) -> bool:
        """
        Handle artifact deletion.
        
        Args:
            cmd: Delete command
            
        Returns:
            True if deleted, False if not found
        """
        # 1. Soft delete artifact (signals effectively hidden from search)
        return await self._repo.delete_artifact(cmd.artifact_id, cmd.user_id)
