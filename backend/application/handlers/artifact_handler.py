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

    async def get_paginated(
        self,
        user_id: str,
        space_id: int,
        page: int = 1,
        limit: int = 50,
        subspace_id: Optional[int] = None,
        engagement_level: Optional[str] = None,
        min_margin: Optional[float] = None,
        sort: str = "recent"
    ) -> Result[dict, ErrorDetail]:
        """
        Get paginated artifacts for a space with filters.
        
        Args:
            user_id: Current user ID
            space_id: Space to query
            page: Page number (1-based)
            limit: Items per page
            subspace_id: Optional subspace filter
            engagement_level: Optional engagement filter
            min_margin: Optional minimum margin filter
            sort: Sort order (recent, oldest, margin_desc, margin_asc)
            
        Returns:
            Result[dict, ErrorDetail]: Dictionary with items and pagination
        """
        return await self._repo.get_paginated(
            user_id=user_id,
            space_id=space_id,
            page=page,
            limit=limit,
            subspace_id=subspace_id,
            engagement_level=engagement_level,
            min_margin=min_margin,
            sort=sort
        )

