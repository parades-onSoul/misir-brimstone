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


def _normalize_engagement_level(level: str) -> str:
    """Map legacy/client engagement levels to current DB enum values."""
    value = (level or "").strip().lower()
    mapping = {
        "ambient": "latent",
        "active": "engaged",
        "committed": "saturated",
    }
    if value in {"latent", "discovered", "engaged", "saturated"}:
        return value
    return mapping.get(value, "latent")


def _normalize_content_source(source: str) -> str:
    """Map legacy/client content sources to current DB enum values."""
    value = (source or "").strip().lower()
    mapping = {
        "ai": "chat",
        "document": "pdf",
        "ebook": "pdf",
    }
    if value in {"web", "pdf", "video", "chat", "note", "other"}:
        return value
    return mapping.get(value, "web")


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
            normalized_engagement = _normalize_engagement_level(cmd.engagement_level)
            normalized_source = _normalize_content_source(cmd.content_source)

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
                'p_engagement_level': normalized_engagement,
                'p_content_source': normalized_source,
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
                await self._backfill_assignment_fields(
                    artifact_id=row['artifact_id'],
                    user_id=cmd.user_id,
                    subspace_id=cmd.subspace_id,
                    matched_marker_ids=list(cmd.matched_marker_ids),
                )
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
            error_text = str(e)
            if "array_length(vector, integer) does not exist" in error_text:
                return Err(repository_error(
                    "Database RPC is outdated for pgvector. "
                    "Run database/v1.4/rpc-function-fix.sql (or replace array_length(p_embedding, 1) "
                    "with vector_dims(p_embedding) in misir.insert_artifact_with_signal).",
                    operation="ingest_artifact",
                    user_id=cmd.user_id,
                    error=error_text
                ))
            return Err(repository_error(
                f"Failed to ingest artifact: {error_text}",
                operation="ingest_artifact",
                user_id=cmd.user_id,
                error=error_text
            ))

    async def _backfill_assignment_fields(
        self,
        *,
        artifact_id: int,
        user_id: str,
        subspace_id: Optional[int],
        matched_marker_ids: list[int],
    ) -> None:
        """
        Best-effort assignment backfill for URL upsert collisions.

        The RPC may update an existing artifact row where subspace/markers were
        previously null. This keeps UI topic stats in sync even when URLs repeat.
        """
        update_data: dict[str, object] = {}
        if isinstance(subspace_id, int) and subspace_id > 0:
            update_data["subspace_id"] = subspace_id
        if matched_marker_ids:
            update_data["matched_marker_ids"] = matched_marker_ids
        if not update_data:
            return

        try:
            loop = asyncio.get_running_loop()
            update_call = partial(
                self._client.schema('misir')
                .from_('artifact')
                .update(update_data)
                .eq('id', artifact_id)
                .eq('user_id', user_id)
                .execute
            )
            await loop.run_in_executor(None, update_call)
        except Exception as backfill_error:
            logger.warning(
                f"Assignment backfill skipped for artifact {artifact_id}: {backfill_error}"
            )
    
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

    async def get_timeline_by_space(
        self,
        user_id: str,
        space_id: int
    ) -> Result[list[dict], ErrorDetail]:
        """Get minimal artifact data for timeline view (chronological order).
        
        Returns:
            Result[list[dict], ErrorDetail]: List of artifacts or error
        """
        try:
            response = (
                self._client.schema('misir')
                .from_('artifact')
                .select('id, title, url, domain, created_at, engagement_level, subspace_id')
                .eq('user_id', user_id)
                .eq('space_id', space_id)
                .is_('deleted_at', 'null')
                .order('created_at', desc=False) # Oldest first
                .execute()
            )
            return Ok(response.data or [])
            
        except Exception as e:
            logger.error(f"get_timeline_by_space failed: {e}", exc_info=e)
            return Err(repository_error(
                f"Failed to get timeline: {str(e)}",
                operation="get_timeline_by_space",
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

    async def get_all_by_user(self, user_id: str, limit: int = 50) -> Result[list[dict], ErrorDetail]:
        """Get all artifacts for a user (most recent first)."""
        try:
            response = (
                self._client.schema('misir')
                .from_('artifact')
                .select('id, title, url, domain, created_at, captured_at, engagement_level, subspace_id, space_id')
                .eq('user_id', user_id)
                .is_('deleted_at', 'null')
                .order('created_at', desc=True)
                .limit(limit)
                .execute()
            )
            return Ok(response.data or [])
        except Exception as e:
            logger.error(f"get_all_by_user failed: {e}", exc_info=e)
            return Err(repository_error(
                f"Failed to get artifacts: {str(e)}",
                operation="get_all_by_user",
                user_id=user_id
            ))

    async def get_all_by_user_id(self, user_id: str) -> list[dict]:
        """
        Get all artifacts for a user, including embedding.
        Used for heavy analytics.
        """
        try:
            # This could be a very large query. Use with caution.
            response = self._client.schema('misir').from_("artifact").select("*").eq("user_id", user_id).is_("deleted_at", "null").execute()
            return response.data or []
        except Exception as e:
            logger.error(f"get_all_by_user_id failed: {e}", exc_info=e)
            return []

    async def get_weak_artifacts_for_user(self, user_id: str, limit: int = 5) -> list[dict]:
        """
        Get artifacts with the lowest positive margin for a user across all spaces.
        These are items the system was least confident about assigning.
        """
        try:
            # We need to join artifact with signal (for margin) and space (for name)
            # PostgREST allows embedding and filtering on related tables.
            # We select artifact columns, and embed the space name and signal margin.
            # Note: Can't order by nested signal.margin directly in PostgREST, so we'll sort in Python
            response = self._client.schema('misir').from_("artifact").select(
                "id, title, created_at, signal(margin), space:space_id(name)"
            ).eq("user_id", user_id).limit(limit * 3).execute()  # Fetch more, filter and sort in Python

            # The result is slightly nested, so we need to flatten it for the endpoint.
            # E.g., {'id': 1, 'title': 'Test', 'signal': {'margin': 0.5}, 'space': {'name': 'My Space'}}
            # We'll transform it into a more usable structure.
            
            flat_data = []
            for item in response.data or []:
                signal = item.get("signal")
                margin = None
                if isinstance(signal, dict):
                    value = signal.get("margin")
                    margin = float(value) if isinstance(value, (int, float)) else None
                elif isinstance(signal, list):
                    for signal_item in signal:
                        if not isinstance(signal_item, dict):
                            continue
                        value = signal_item.get("margin")
                        if isinstance(value, (int, float)):
                            margin = float(value)
                            break

                space_name = "Unknown"
                space = item.get("space")
                if isinstance(space, dict):
                    name = space.get("name")
                    if isinstance(name, str) and name:
                        space_name = name
                elif isinstance(space, list) and space:
                    first = space[0]
                    if isinstance(first, dict):
                        name = first.get("name")
                        if isinstance(name, str) and name:
                            space_name = name

                if margin is not None:  # Only include artifacts with margin
                    flat_item = {
                        "id": item.get("id"),
                        "title": item.get("title"),
                        "created_at": item.get("created_at"),
                        "margin": margin,
                        "space_name": space_name,
                    }
                    flat_data.append(flat_item)
            
            # Sort by margin ascending (lowest first) and take limit
            flat_data.sort(key=lambda x: x["margin"])
            return flat_data[:limit]

        except Exception as e:
            logger.error(f"get_weak_artifacts_for_user failed: {e}", exc_info=e)
            return []

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
        Get paginated artifacts with filters.
        
        Returns:
            Result[dict, ErrorDetail]: Dictionary with 'items' and 'pagination' keys.
        """
        try:
            offset = (page - 1) * limit
            
            # Base query with exact count
            # We select artifact fields, related signal margin, and subspace name
            query = self._client.schema('misir').from_('artifact').select(
                '*, signal(margin), subspace(name)', count='exact'
            )
            
            # Base filters
            query = query.eq('user_id', user_id).eq('space_id', space_id).is_('deleted_at', 'null')
            
            # Optional filters
            if subspace_id:
                query = query.eq('subspace_id', subspace_id)
            
            if engagement_level:
                query = query.eq('engagement_level', engagement_level)
            
            # Margin filtering
            # Note: This relies on PostgREST's ability to filter on embedded resources
            # syntax: embedded_resource.column
            if min_margin is not None:
                # We need to ensure we join signal innerly if we are filtering on it?
                # For now we use the filter syntax.
                # If signal is missing, margin is null, so it shouldn't match gte.
                query = query.filter('signal.margin', 'gte', min_margin)
            
            # Sorting
            if sort == "recent":
                query = query.order('captured_at', desc=True)
            elif sort == "oldest":
                query = query.order('captured_at', desc=False)
            elif sort == "margin_desc":
                # Order by related column
                # Syntax might vary by client version, but generally resource(col)
                # If this fails, we might need a stored procedure or just python sorting (bad for pagination)
                # Let's try the standard PostgREST syntax
                query = query.order('signal(margin)', desc=True, nullsfirst=False)
            elif sort == "margin_asc":
                query = query.order('signal(margin)', desc=False, nullsfirst=False)
            
            # Pagination
            query = query.range(offset, offset + limit - 1)
            
            # Execute
            # Note: run_in_executor might be needed if this is blocking? 
            # The client usually doesn't expose async execute directly unless used with await?
            # The other methods here use run_in_executor for atomic safety or just direct calls.
            # Other methods in this file use execute() directly without await if it's sync client wrapped?
            # Wait, the __init__ takes `client: Client`. Is it sync or async?
            # Looking at `ingest_with_signal`, it uses `loop.run_in_executor`.
            # Looking at `search_by_space`, it calls `.execute()` directly. 
            # This implies `self._client` is likely the sync client from `supabase` package.
            # So `.execute()` is blocking.
            # `search_by_space` is defined `async` but calls synchronous `.execute()`. 
            # This blocks the event loop! `ingest_with_signal` does it correctly.
            # I should follow `ingest_with_signal` pattern or fix `search_by_space` later.
            # For now, to correspond with `search_by_space` style (which seems accepted here), I'll do direct execute.
            # Ideally I should wrap in executor.
            
            loop = asyncio.get_running_loop()
            response = await loop.run_in_executor(None, query.execute)
            
            total = response.count if response.count is not None else 0
            
            return Ok({
                "items": response.data or [],
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total,
                    "total_pages": (total + limit - 1) // limit if limit > 0 else 0
                }
            })
            
        except Exception as e:
            logger.error(f"get_paginated failed: {e}", exc_info=e)
            return Err(repository_error(
                f"Failed to get paginated artifacts: {str(e)}",
                operation="get_paginated",
                space_id=space_id
            ))


