"""
Assignment Margin Service — Prevents centroid pollution from ambiguous signals.

This is a CRITICAL algorithm component that determines:
1. Whether a signal is ambiguous (near multiple subspaces)
2. Whether the signal should update the centroid

If margin < threshold, the signal is stored but does NOT update the centroid.
"""
from dataclasses import dataclass
from typing import Optional
import logging
import math

from supabase import Client
from core.config_cache import config_cache

logger = logging.getLogger(__name__)


@dataclass
class MarginResult:
    """Result of margin calculation."""
    nearest_subspace_id: Optional[int]
    nearest_distance: float
    second_distance: float
    margin: float
    updates_centroid: bool
    
    @property
    def is_ambiguous(self) -> bool:
        """True if signal is near multiple subspaces."""
        return not self.updates_centroid


class AssignmentMarginService:
    """
    Calculates assignment margin for signals.
    
    Assignment Margin Rule (from ALGORITHM_SPEC):
    - margin = d₂ − d₁
    - If margin < threshold → signal does NOT update centroid
    
    This prevents centroid pollution from ambiguous signals at scale.
    """
    
    def __init__(self, client: Client):
        self._client = client

    @staticmethod
    def _truncate_and_normalize(vector: list[float], target_dim: int) -> list[float]:
        if target_dim <= 0:
            raise ValueError("target_dim must be > 0")
        if len(vector) < target_dim:
            raise ValueError(
                f"Cannot truncate vector of length {len(vector)} to {target_dim}"
            )

        truncated = [float(value) for value in vector[:target_dim]]
        norm = math.sqrt(sum(v * v for v in truncated))
        if norm > 0:
            truncated = [v / norm for v in truncated]
        return truncated
    
    @staticmethod
    def calculate_margin_value(d1: float, d2: float) -> float:
        """Calculate margin between two distances."""
        return d2 - d1
    
    def get_threshold(self) -> float:
        """Get margin threshold from config."""
        return float(config_cache.get('assignment_margin_threshold', 0.05))
    
    async def calculate_margin(
        self,
        signal_vector: list[float],
        user_id: str,
        space_id: int
    ) -> MarginResult:
        """
        Calculate assignment margin for a signal vector.
        
        Returns:
            MarginResult with nearest subspace, distances, and updates_centroid flag
        """
        threshold = self.get_threshold()
        
        try:
            # Prefer Matryoshka RPC when available.
            signal_vector_384 = self._truncate_and_normalize(signal_vector, 384)
            response = self._client.schema('misir').rpc(
                'calculate_assignment_margin_matryoshka',
                {
                    'p_signal_vector_384': signal_vector_384,
                    'p_signal_vector_768': signal_vector,
                    'p_user_id': user_id,
                    'p_space_id': space_id
                }
            ).execute()

            if response.data and len(response.data) > 0:
                row = response.data[0]
                return MarginResult(
                    nearest_subspace_id=row['nearest_subspace_id'],
                    nearest_distance=row['nearest_distance'] or 0.0,
                    second_distance=row['second_distance'] or 1.0,
                    margin=row['margin'] or 1.0,
                    updates_centroid=row['updates_centroid']
                )
        except Exception as e:
            logger.warning(
                f"Matryoshka RPC calculate_assignment_margin failed: {e}, using legacy RPC"
            )

        try:
            # Legacy RPC fallback
            response = self._client.schema('misir').rpc(
                'calculate_assignment_margin',
                {
                    'p_signal_vector': signal_vector,
                    'p_user_id': user_id,
                    'p_space_id': space_id
                }
            ).execute()
            
            if response.data and len(response.data) > 0:
                row = response.data[0]
                return MarginResult(
                    nearest_subspace_id=row['nearest_subspace_id'],
                    nearest_distance=row['nearest_distance'] or 0.0,
                    second_distance=row['second_distance'] or 1.0,
                    margin=row['margin'] or 1.0,
                    updates_centroid=row['updates_centroid']
                )
        except Exception as e:
            logger.warning(f"Legacy RPC calculate_assignment_margin failed: {e}, using local fallback")
        
        # Fallback: query subspaces directly
        return await self._calculate_margin_fallback(
            signal_vector, user_id, space_id, threshold
        )
    
    async def _calculate_margin_fallback(
        self,
        signal_vector: list[float],
        user_id: str,
        space_id: int,
        threshold: float
    ) -> MarginResult:
        """
        Fallback margin calculation using direct queries.
        
        Used when RPC function is not available (e.g., before v1.1 migration).
        """
        # Get subspaces with centroids
        response = (
            self._client.schema('misir')
            .from_('subspace')
            .select('id, centroid_embedding')
            .eq('user_id', user_id)
            .eq('space_id', space_id)
            .not_.is_('centroid_embedding', 'null')
            .execute()
        )
        
        subspaces = response.data or []
        
        if len(subspaces) == 0:
            # No subspaces with centroids
            return MarginResult(
                nearest_subspace_id=None,
                nearest_distance=1.0,
                second_distance=1.0,
                margin=1.0,
                updates_centroid=True  # First signal always updates
            )
        
        if len(subspaces) == 1:
            # Only one subspace, no ambiguity possible
            return MarginResult(
                nearest_subspace_id=subspaces[0]['id'],
                nearest_distance=0.0,  # Will be calculated properly
                second_distance=1.0,
                margin=1.0,
                updates_centroid=True
            )
        
        # Calculate distances to all subspaces
        # Note: This is a simplified fallback. Production should use vector ops in DB.
        import numpy as np
        
        signal = np.array(signal_vector)
        distances = []
        
        for s in subspaces:
            centroid = np.array(s['centroid_embedding'])
            # Cosine distance
            cos_sim = np.dot(signal, centroid) / (np.linalg.norm(signal) * np.linalg.norm(centroid))
            distance = 1 - cos_sim
            distances.append((s['id'], distance))
        
        # Sort by distance
        distances.sort(key=lambda x: x[1])
        
        d1 = distances[0][1]
        d2 = distances[1][1] if len(distances) > 1 else 1.0
        margin = d2 - d1
        
        return MarginResult(
            nearest_subspace_id=distances[0][0],
            nearest_distance=d1,
            second_distance=d2,
            margin=margin,
            updates_centroid=margin >= threshold
        )
    
    def should_update_centroid(self, margin: float) -> bool:
        """Check if margin is sufficient for centroid update."""
        return margin >= self.get_threshold()
