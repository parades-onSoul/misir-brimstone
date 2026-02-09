"""
Signal Repository — Vector search and signal queries.

Signals are the core data unit - embedding + engagement data.
This repository provides:
- Vector similarity search (ISS)
- Signal queries by space/subspace
- Analytics queries
Returns Result[T, ErrorDetail] for type-safe error handling.
"""
from dataclasses import dataclass
from typing import Optional

from result import Result, Ok, Err
from supabase import Client
from core.error_types import ErrorDetail, repository_error
from core.logging_config import get_logger

logger = get_logger(__name__)


@dataclass
class SignalSearchResult:
    """Result from vector similarity search."""
    signal_id: int
    artifact_id: int
    space_id: int
    subspace_id: Optional[int]
    distance: float  # Cosine distance (lower = more similar)
    similarity: float  # 1 - distance
    title: Optional[str]
    url: str


@dataclass
class SignalStats:
    """Signal statistics for a subspace."""
    total_count: int
    centroid_updating_count: int
    avg_margin: Optional[float]
    latest_signal_at: Optional[str]


class SignalRepository:
    """
    Repository for signal operations.
    
    Key methods:
    - search_by_vector: ISS vector similarity search
    - get_by_subspace: Get signals in a subspace
    - get_stats: Analytics for SDD
    """
    
    def __init__(self, client: Client):
        self._client = client
    
    async def search_by_vector(
        self,
        query_vector: list[float],
        user_id: str,
        *,
        space_id: Optional[int] = None,
        subspace_id: Optional[int] = None,
        limit: int = 20,
        threshold: float = 0.7
    ) -> Result[list[SignalSearchResult], ErrorDetail]:
        """
        Search signals by vector similarity (ISS).
        
        Uses HNSW index via RPC for fast approximate search.
        
        Args:
            query_vector: Query embedding
            user_id: User ID (for RLS)
            space_id: Optional space filter
            subspace_id: Optional subspace filter
            limit: Max results
            threshold: Min similarity (0-1)
        
        Returns:
            Result[list[SignalSearchResult], ErrorDetail]: Search results or error
        """
        try:
            # Try RPC first (uses HNSW index)
            params = {
                'p_query_vector': query_vector,
                'p_user_id': user_id,
                'p_limit': limit,
                'p_threshold': threshold,
            }
            if space_id is not None:
                params['p_space_id'] = space_id
            if subspace_id is not None:
                params['p_subspace_id'] = subspace_id
            
            response = self._client.schema('misir').rpc(
                'search_signals_by_vector',
                params
            ).execute()
            
            results = []
            for row in (response.data or []):
                distance = row.get('distance', 0.5)
                results.append(SignalSearchResult(
                    signal_id=row['signal_id'],
                    artifact_id=row['artifact_id'],
                    space_id=row['space_id'],
                    subspace_id=row.get('subspace_id'),
                    distance=distance,
                    similarity=1 - distance,
                    title=row.get('title'),
                    url=row.get('url', '')
                ))
            
            return Ok(results)
            
        except Exception as e:
            logger.error(f"Vector search failed: {e}", exc_info=e)
            return Err(repository_error(
                operation="search_signals",
                details=f"Failed to search signals: {str(e)}"
            ))

    
    async def _search_fallback(
        self,
        query_vector: list[float],
        user_id: str,
        space_id: Optional[int],
        subspace_id: Optional[int],
        limit: int
    ) -> list[SignalSearchResult]:
        """
        Fallback search without HNSW (degraded mode).
        
        Returns recent signals when RPC is unavailable.
        """
        query = (
            self._client.schema('misir')
            .from_('signal')
            .select('''
                id,
                artifact_id,
                space_id,
                subspace_id,
                artifact:artifact_id(title, url)
            ''')
            .eq('user_id', user_id)
            .is_('deleted_at', 'null')
            .order('created_at', desc=True)
            .limit(limit)
        )
        
        if space_id is not None:
            query = query.eq('space_id', space_id)
        if subspace_id is not None:
            query = query.eq('subspace_id', subspace_id)
        
        response = query.execute()
        
        results = []
        for row in (response.data or []):
            artifact = row.get('artifact', {}) or {}
            results.append(SignalSearchResult(
                signal_id=row['id'],
                artifact_id=row['artifact_id'],
                space_id=row['space_id'],
                subspace_id=row.get('subspace_id'),
                distance=0.5,  # Unknown in fallback
                similarity=0.5,
                title=artifact.get('title'),
                url=artifact.get('url', '')
            ))
        
        return results
    
    async def get_by_subspace(
        self,
        subspace_id: int,
        user_id: str,
        *,
        limit: int = 50,
        include_low_margin: bool = True
    ) -> list[dict]:
        """
        Get signals in a subspace.
        
        Args:
            subspace_id: Subspace ID
            user_id: User ID
            limit: Max results
            include_low_margin: Include signals that didn't update centroid
        
        Returns:
            List of signal dicts
        """
        try:
            query = (
                self._client.schema('misir')
                .from_('signal')
                .select('*')
                .eq('subspace_id', subspace_id)
                .eq('user_id', user_id)
                .is_('deleted_at', 'null')
                .order('created_at', desc=True)
                .limit(limit)
            )
            
            if not include_low_margin:
                query = query.eq('updates_centroid', True)
            
            response = query.execute()
            return response.data or []
            
        except Exception as e:
            logger.error(f"Failed to get signals: {e}")
            raise
    
    async def get_stats(
        self,
        subspace_id: int,
        user_id: str
    ) -> SignalStats:
        """
        Get signal statistics for a subspace.
        
        Useful for SDD monitoring and analytics.
        
        Returns:
            SignalStats with counts and averages
        """
        try:
            # Total count
            total_response = (
                self._client.schema('misir')
                .from_('signal')
                .select('id', count='exact')
                .eq('subspace_id', subspace_id)
                .eq('user_id', user_id)
                .is_('deleted_at', 'null')
                .execute()
            )
            total_count = total_response.count or 0
            
            # Centroid-updating count
            updating_response = (
                self._client.schema('misir')
                .from_('signal')
                .select('id', count='exact')
                .eq('subspace_id', subspace_id)
                .eq('user_id', user_id)
                .eq('updates_centroid', True)
                .is_('deleted_at', 'null')
                .execute()
            )
            updating_count = updating_response.count or 0
            
            # Average margin (for signals with margin)
            margin_response = (
                self._client.schema('misir')
                .from_('signal')
                .select('margin')
                .eq('subspace_id', subspace_id)
                .eq('user_id', user_id)
                .not_.is_('margin', 'null')
                .is_('deleted_at', 'null')
                .execute()
            )
            
            margins = [r['margin'] for r in (margin_response.data or []) if r.get('margin')]
            avg_margin = sum(margins) / len(margins) if margins else None
            
            # Latest signal
            latest_response = (
                self._client.schema('misir')
                .from_('signal')
                .select('created_at')
                .eq('subspace_id', subspace_id)
                .eq('user_id', user_id)
                .is_('deleted_at', 'null')
                .order('created_at', desc=True)
                .limit(1)
                .execute()
            )
            latest_at = None
            if latest_response.data:
                latest_at = latest_response.data[0].get('created_at')
            
            return SignalStats(
                total_count=total_count,
                centroid_updating_count=updating_count,
                avg_margin=avg_margin,
                latest_signal_at=latest_at
            )
            
        except Exception as e:
            logger.error(f"Failed to get signal stats: {e}")
            raise
    
    async def get_margin_distribution(
        self,
        space_id: int,
        user_id: str
    ) -> dict:
        """
        Get margin distribution for monitoring.
        
        Returns:
            Dict with margin categories and counts
        """
        try:
            response = (
                self._client.schema('misir')
                .from_('signal')
                .select('margin')
                .eq('space_id', space_id)
                .eq('user_id', user_id)
                .not_.is_('margin', 'null')
                .is_('deleted_at', 'null')
                .execute()
            )
            
            # Categorize margins
            categories = {
                'ambiguous': 0,  # < 0.1
                'low': 0,        # 0.1 - 0.2
                'medium': 0,     # 0.2 - 0.5
                'high': 0        # > 0.5
            }
            
            for row in (response.data or []):
                margin = row.get('margin', 0)
                if margin < 0.1:
                    categories['ambiguous'] += 1
                elif margin < 0.2:
                    categories['low'] += 1
                elif margin < 0.5:
                    categories['medium'] += 1
                else:
                    categories['high'] += 1
            
            total = sum(categories.values())
            return {
                'categories': categories,
                'total': total,
                'update_rate': (total - categories['ambiguous']) / total if total > 0 else 0
            }
            
        except Exception as e:
            logger.error(f"Failed to get margin distribution: {e}")
            raise
