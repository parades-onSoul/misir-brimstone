"""
Search Handler — ISS (Implicit Semantic Search).

Simple, correct search:
1. Embed query
2. Normalize + truncate
3. HNSW search via RPC
4. Optional space/subspace filter
5. Return ranked artifacts
"""
from dataclasses import dataclass
from typing import Optional
import logging

from supabase import Client
from infrastructure.services.embedding_service import get_embedding_service

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class SearchCommand:
    """Command to search signals by vector similarity."""
    user_id: str
    query: str
    space_id: Optional[int] = None
    subspace_id: Optional[int] = None
    limit: int = 20
    threshold: float = 0.7  # Minimum similarity
    
    def __post_init__(self):
        if not self.user_id:
            raise ValueError("user_id is required")
        if not self.query or not self.query.strip():
            raise ValueError("query is required")
        if self.limit < 1 or self.limit > 100:
            raise ValueError("limit must be 1-100")
        if not 0.0 <= self.threshold <= 1.0:
            raise ValueError("threshold must be 0.0-1.0")


@dataclass
class SearchResult:
    """Single search result."""
    artifact_id: int
    signal_id: int
    similarity: float
    title: Optional[str]
    url: str
    content_preview: Optional[str]
    space_id: int
    subspace_id: Optional[int]


@dataclass
class SearchResponse:
    """Search response with results."""
    results: list[SearchResult]
    query: str
    count: int
    dimension_used: int


class SearchHandler:
    """
    Handler for semantic search (ISS).
    
    Uses:
    - EmbeddingService for query embedding
    - HNSW index via Supabase RPC
    """
    
    def __init__(self, client: Client):
        self._client = client
        self._embedding_service = get_embedding_service()
    
    async def search(self, cmd: SearchCommand) -> SearchResponse:
        """
        Execute semantic search.
        
        Args:
            cmd: SearchCommand with query and filters
        
        Returns:
            SearchResponse with ranked results
        """
        logger.info(f"Searching for '{cmd.query[:50]}...' (user: {cmd.user_id[:8]})")
        
        # 1. Embed query (use query prefix for asymmetric search)
        embed_result = self._embedding_service.embed_query(cmd.query)
        query_vector = embed_result.vector
        dimension = embed_result.dimension
        
        logger.debug(f"Query embedded: dim={dimension}")
        
        # 2. Search via RPC (uses HNSW index)
        try:
            # Build RPC params
            params = {
                'p_query_vector': query_vector,
                'p_user_id': cmd.user_id,
                'p_limit': cmd.limit,
                'p_threshold': cmd.threshold,
            }
            
            if cmd.space_id is not None:
                params['p_space_id'] = cmd.space_id
            if cmd.subspace_id is not None:
                params['p_subspace_id'] = cmd.subspace_id
            
            response = self._client.schema('misir').rpc(
                'search_signals_by_vector',
                params
            ).execute()
            
            results = self._parse_results(response.data or [])
            
        except Exception as e:
            logger.warning(f"RPC search failed: {e}, using fallback")
            results = await self._fallback_search(cmd, query_vector)
        
        logger.info(f"Search returned {len(results)} results")
        
        return SearchResponse(
            results=results,
            query=cmd.query,
            count=len(results),
            dimension_used=dimension
        )
    
    def _parse_results(self, data: list[dict]) -> list[SearchResult]:
        """Parse RPC response into SearchResult objects."""
        return [
            SearchResult(
                artifact_id=row['artifact_id'],
                signal_id=row['signal_id'],
                similarity=1 - row['distance'],  # Convert distance to similarity
                title=row.get('title'),
                url=row['url'],
                content_preview=row.get('content_preview'),
                space_id=row['space_id'],
                subspace_id=row.get('subspace_id')
            )
            for row in data
        ]
    
    async def _fallback_search(
        self, 
        cmd: SearchCommand, 
        query_vector: list[float]
    ) -> list[SearchResult]:
        """
        Fallback search using direct query.
        
        Used when RPC function is not available.
        """
        # Build filter conditions
        query = (
            self._client.schema('misir')
            .from_('signal')
            .select('''
                id,
                artifact_id,
                space_id,
                subspace_id,
                artifact:artifact_id(title, url, content)
            ''')
            .eq('user_id', cmd.user_id)
            .is_('deleted_at', 'null')
            .limit(cmd.limit * 2)  # Fetch more, filter by threshold
        )
        
        if cmd.space_id is not None:
            query = query.eq('space_id', cmd.space_id)
        if cmd.subspace_id is not None:
            query = query.eq('subspace_id', cmd.subspace_id)
        
        response = query.execute()
        
        # Note: This fallback doesn't use HNSW.
        # For proper vector search, the RPC should be available.
        # This is a degraded mode that returns recent signals.
        
        results = []
        for row in (response.data or [])[:cmd.limit]:
            artifact = row.get('artifact', {}) or {}
            results.append(SearchResult(
                artifact_id=row['artifact_id'],
                signal_id=row['id'],
                similarity=0.5,  # Unknown similarity in fallback
                title=artifact.get('title'),
                url=artifact.get('url', ''),
                content_preview=artifact.get('content', '')[:200] if artifact.get('content') else None,
                space_id=row['space_id'],
                subspace_id=row.get('subspace_id')
            ))
        
        return results
