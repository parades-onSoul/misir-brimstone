"""
Artifact Repository — Command-shaped writes via RPC.

Uses insert_artifact_with_signal RPC for atomic operations.
No generic save() — only intentional commands.
"""
from dataclasses import dataclass
from typing import Optional
import logging

from supabase import Client
from domain.commands import CaptureArtifactCommand
from core.config_cache import config_cache

logger = logging.getLogger(__name__)


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
    
    async def ingest_with_signal(self, cmd: CaptureArtifactCommand) -> CaptureResult:
        """
        Capture artifact and signal atomically via RPC.
        
        The database handles:
        - URL normalization
        - Domain extraction
        - Semantic engagement ordering (never downgrade)
        - Centroid updates (via trigger)
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
            
            # Call RPC
            response = self._client.schema('misir').rpc(
                'insert_artifact_with_signal',
                params
            ).execute()
            
            if response.data and len(response.data) > 0:
                row = response.data[0]
                return CaptureResult(
                    artifact_id=row['artifact_id'],
                    signal_id=row['signal_id'],
                    is_new=row['is_new'],
                    message=row['message']
                )
            else:
                raise ValueError("RPC returned no data")
                
        except Exception as e:
            logger.error(f"ingest_with_signal failed: {e}")
            raise
    
    async def find_by_id(self, artifact_id: int) -> Optional[dict]:
        """Find artifact by ID."""
        response = self._client.schema('misir').from_('artifact').select('*').eq('id', artifact_id).execute()
        return response.data[0] if response.data else None
    
    async def find_by_url(self, user_id: str, normalized_url: str) -> Optional[dict]:
        """Find artifact by normalized URL (user-scoped)."""
        response = (
            self._client.schema('misir')
            .from_('artifact')
            .select('*')
            .eq('user_id', user_id)
            .eq('normalized_url', normalized_url)
            .execute()
        )
        return response.data[0] if response.data else None
    
    async def search_by_space(
        self, 
        user_id: str, 
        space_id: int,
        limit: int = 50
    ) -> list[dict]:
        """Get artifacts in a space."""
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
        return response.data or []
