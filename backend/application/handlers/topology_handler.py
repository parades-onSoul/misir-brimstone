"""
Topology Handler — Manages 2D projection of subspace network.
"""
import logging
import json
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

from sklearn.manifold import TSNE
from infrastructure.repositories.subspace_repo import SubspaceRepository
from core.error_types import ErrorDetail

logger = logging.getLogger(__name__)

class TTLCache:
    """Simple in-memory cache with Time-To-Live."""
    def __init__(self):
        self._cache: Dict[str, Any] = {}
        self._timestamps: Dict[str, datetime] = {}
        
    def get(self, key: str) -> Optional[Any]:
        if key not in self._cache:
            return None
        
        expires_at = self._timestamps[key]
        if datetime.now() > expires_at:
            del self._cache[key]
            del self._timestamps[key]
            return None
            
        return self._cache[key]
        
    def set(self, key: str, value: Any, ttl_seconds: int = 3600):
        self._cache[key] = value
        self._timestamps[key] = datetime.now() + timedelta(seconds=ttl_seconds)

# Global cache instance for topology
# Since handlers are instantiated per request, we need a global cache
topology_cache = TTLCache()


class TopologyHandler:
    """
    Handles generation of 2D topology map for knowledge spaces.
    Uses t-SNE for dimensionality reduction of centroids.
    """
    
    def __init__(self, repo: SubspaceRepository):
        self._repo = repo
        
    async def get_topology(self, space_id: int, user_id: str) -> Dict[str, Any]:
        """
        Get 2D topology nodes for a space.
        Cached for 1 hour to avoid expensive t-SNE re-calculation.
        """
        cache_key = f"topology:{space_id}"
        cached = topology_cache.get(cache_key)
        if cached:
            return cached
            
        # Fetch subspaces
        result = await self._repo.get_by_space(space_id, user_id)
        
        if result.is_err():
            # If error (e.g., DB down), return empty topology rather than crashing
            logger.error(f"Failed to fetch subspaces for topology: {result.err().message}")
            return {"nodes": []}
            
        subspaces = result.ok()
        
        # Filter for valid centroids
        valid_subspaces = []
        centroids = []
        
        for s in subspaces:
            embedding = s.centroid_embedding
            # Embedding might come as string or list depending on repo parsing
            if not embedding:
                continue
                
            if isinstance(embedding, str):
                try:
                    embedding = json.loads(embedding)
                except:
                    continue
                    
            if embedding and len(embedding) > 0:
                valid_subspaces.append(s)
                centroids.append(embedding)
                
        # Need at least 2 points for t-SNE (perplexity constraint)
        if len(centroids) < 2:
            # Need to handle < 2 points gracefully.
            # If 1 point, just place it at (0,0)
            if len(centroids) == 1:
                s = valid_subspaces[0]
                return {
                    "nodes": [{
                        "subspace_id": s.id,
                        "name": s.name,
                        "artifact_count": s.artifact_count,
                        "confidence": s.confidence,
                        "x": 0.0,
                        "y": 0.0
                    }]
                }
            return {"nodes": []}
            
        # Run t-SNE
        # perplexity must be less than n_samples
        n_samples = len(centroids)
        perplexity = min(30, n_samples - 1)
        
        try:
            tsne = TSNE(
                n_components=2,
                random_state=42,
                perplexity=perplexity,
                init='pca', 
                learning_rate='auto'
            )
            coords_2d = tsne.fit_transform(np.array(centroids))
            
            # Map back to nodes
            nodes = []
            for i, s in enumerate(valid_subspaces):
                nodes.append({
                    "subspace_id": s.id,
                    "name": s.name,
                    "artifact_count": s.artifact_count,
                    "confidence": s.confidence,
                    "x": float(coords_2d[i][0]),
                    "y": float(coords_2d[i][1])
                })
                
            response = {"nodes": nodes}
            
            # Cache result
            topology_cache.set(cache_key, response, ttl_seconds=3600)
            
            return response
            
        except Exception as e:
            logger.error(f"t-SNE failed for space {space_id}: {e}", exc_info=e)
            # Fallback: Return empty or maybe random layout? Empty safer.
            return {"nodes": []}
