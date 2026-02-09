"""
Artifact Repository — Command-shaped writes via RPC.

Uses insert_artifact_with_signal RPC for atomic operations.
No generic save() — only intentional commands.
Returns Result[T, ErrorDetail] for type-safe error handling.
"""
from dataclasses import dataclass
from typing import Optional
from functools import partial
import asyncio

from result import Result, Ok, Err
from supabase import Client
from domain.commands import CaptureArtifactCommand, UpdateArtifactCommand
from core.config_cache import config_cache
from core.error_types import (
    ErrorDetail,
    repository_error,
    not_found_error,
    DomainError
)
from core.logging_config import get_logger

logger = get_logger(__name__)


@dataclass
class CaptureResult:
    """Result of artifact capture operation."""
    artifact_id: int
    signal_id: int
    is_new: bool
    message: str


class ArtifactRepository:
    """
    Repository for artifact operations.
    
    Design:
    - Command-shaped writes (no generic save)
    - Uses RPC for atomic transactions
    - DB is arbiter (triggers handle normalization, centroids)
    """
    
    def __init__(self, client: Client):
        self._client = client
    
    async def ingest_with_signal(self, cmd: CaptureArtifactCommand) -> Result[CaptureResult, ErrorDetail]:
        """
        Capture artifact and signal atomically via RPC.
        
        The database handles:
        - URL normalization
        - Domain extraction
        - Semantic engagement ordering (never downgrade)
        - Centroid updates (via trigger)
        
        Returns:
            Result[CaptureResult, ErrorDetail]: Success with capture result or error
        """
        try:
            # Build RPC params (order matches new function signature)
            params = {
                # Required params first
                'p_user_id': cmd.user_id,
                'p_space_id': cmd.space_id,
                'p_url': cmd.url,
                'p_embedding': cmd.embedding,
                
                # Optional params with defaults
                'p_subspace_id': cmd.subspace_id,
                'p_session_id': cmd.session_id,
                'p_title': cmd.title,
                'p_content': cmd.content,
                'p_engagement_level': cmd.engagement_level,
                'p_content_source': cmd.content_source,
                'p_dwell_time_ms': cmd.dwell_time_ms,
                'p_scroll_depth': cmd.scroll_depth,
                'p_reading_depth': cmd.reading_depth,
                'p_word_count': cmd.word_count,
                'p_signal_magnitude': cmd.signal_magnitude,
                'p_signal_type': cmd.signal_type,
                'p_matched_marker_ids': list(cmd.matched_marker_ids),
                
                # Assignment Margin (v1.1)
                'p_margin': cmd.margin,
                'p_updates_centroid': cmd.updates_centroid,
            }
            
            if cmd.captured_at:
                params['p_captured_at'] = cmd.captured_at.isoformat()
            
            # Call RPC (run in executor to avoid blocking event loop)
            loop = asyncio.get_running_loop()
            rpc_call = partial(
                self._client.schema('misir').rpc('insert_artifact_with_signal', params).execute
            )
            response = await loop.run_in_executor(None, rpc_call)
            
            if response.data and len(response.data) > 0:
                row = response.data[0]
                return Ok(CaptureResult(
                    artifact_id=row['artifact_id'],
                    signal_id=row['signal_id'],
                    is_new=row['is_new'],
                    message=row['message']
                ))
            else:
                return Err(repository_error(
                    "RPC returned no data",
                    operation="ingest_artifact",
                    user_id=cmd.user_id
                ))
                
        except Exception as e:
            logger.error(f"ingest_with_signal failed: {e}", exc_info=e)
            return Err(repository_error(
                f"Failed to ingest artifact: {str(e)}",
                operation="ingest_artifact",
                user_id=cmd.user_id,
                error=str(e)
            ))
    
    async def find_by_id(self, artifact_id: int) -> Result[dict, ErrorDetail]:
        """Find artifact by ID.
        
        Returns:
            Result[dict, ErrorDetail]: Artifact data or not found error
        """
        try:
            loop = asyncio.get_running_loop()
            query_call = partial(
                self._client.schema('misir').from_('artifact').select('*').eq('id', artifact_id).execute
            )
            response = await loop.run_in_executor(None, query_call)
            
            if response.data and len(response.data) > 0:
                return Ok(response.data[0])
            return Err(not_found_error("Artifact", artifact_id))
            
        except Exception as e:
            logger.error(f"find_by_id failed: {e}", exc_info=e)
            return Err(repository_error(
                f"Failed to find artifact: {str(e)}",
                operation="find_artifact",
                artifact_id=artifact_id
            ))
    
    async def find_by_url(self, user_id: str, normalized_url: str) -> Result[Optional[dict], ErrorDetail]:
        """Find artifact by normalized URL (user-scoped).
        
        Returns:
            Result[Optional[dict], ErrorDetail]: Artifact data, None if not found, or error
        """
        try:
            loop = asyncio.get_running_loop()
            query_call = partial(
                self._client.schema('misir')
                .from_('artifact')
                .select('*')
                .eq('user_id', user_id)
                .eq('normalized_url', normalized_url)
                .execute
            )
            response = await loop.run_in_executor(None, query_call)
            
            if response.data and len(response.data) > 0:
                return Ok(response.data[0])
            return Ok(None)  # Not an error, just not found
            
        except Exception as e:
            logger.error(f"find_by_url failed: {e}", exc_info=e)
            return Err(repository_error(
                f"Failed to find artifact by URL: {str(e)}",
                operation="find_artifact_by_url",
                user_id=user_id
            ))
    
    async def search_by_space(
        self, 
        user_id: str, 
        space_id: int,
        limit: int = 50
    ) -> Result[list[dict], ErrorDetail]:
        """Get artifacts in a space.
        
        Returns:
            Result[list[dict], ErrorDetail]: List of artifacts or error
        """
        try:
            response = (
                self._client.schema('misir')
                .from_('artifact')
                .select('*')
                .eq('user_id', user_id)
                .eq('space_id', space_id)
                .is_('deleted_at', 'null')
                .order('created_at', desc=True)
                .limit(limit)
                .execute()
            )
            return Ok(response.data or [])
            
        except Exception as e:
            logger.error(f"search_by_space failed: {e}", exc_info=e)
            return Err(repository_error(
                f"Failed to search artifacts: {str(e)}",
                operation="search_artifacts",
                space_id=space_id,
                user_id=user_id
            ))

    async def delete_artifact(self, artifact_id: int, user_id: str) -> Result[bool, ErrorDetail]:
        """
        Soft delete an artifact.
        
        Args:
            artifact_id: ID of artifact to delete
            user_id: Owner user ID
            
        Returns:
            Result[bool, ErrorDetail]: True if deleted, False if not found, or error
        """
        try:
            response = (
                self._client.schema('misir')
                .from_('artifact')
                .update({'deleted_at': 'now()'})
                .eq('id', artifact_id)
                .eq('user_id', user_id)
                .is_('deleted_at', 'null')
                .execute()
            )
            return Ok(len(response.data or []) > 0)
            
        except Exception as e:
            logger.error(f"Failed to delete artifact: {e}", exc_info=e)
            return Err(repository_error(
                f"Failed to delete artifact: {str(e)}",
                operation="delete_artifact",
                artifact_id=artifact_id,
                user_id=user_id
            ))

    async def update_artifact(self, cmd: UpdateArtifactCommand) -> Result[bool, ErrorDetail]:
        """
        Update artifact fields.
        
        Args:
            cmd: Update command with new values
            
        Returns:
            Result[bool, ErrorDetail]: True if updated, False if no changes, or error
        """
        try:
            data = {}
            if cmd.title is not None:
                data['title'] = cmd.title
            if cmd.content is not None:
                data['content'] = cmd.content
            if cmd.engagement_level is not None:
                data['engagement_level'] = cmd.engagement_level
            if cmd.reading_depth is not None:
                data['reading_depth'] = cmd.reading_depth
                
            if not data:
                return Ok(False)  # No changes to make

            data['updated_at'] = 'now()'

            response = (
                self._client.schema('misir')
                .from_('artifact')
                .update(data)
                .eq('id', cmd.artifact_id)
                .eq('user_id', cmd.user_id)
                .is_('deleted_at', 'null')
                .execute()
            )
            return Ok(len(response.data or []) > 0)
            
        except Exception as e:
            logger.error(f"Failed to update artifact: {e}", exc_info=e)
            return Err(repository_error(
                f"Failed to update artifact: {str(e)}",
                operation="update_artifact",
                artifact_id=cmd.artifact_id,
                user_id=cmd.user_id
            ))
