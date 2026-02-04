"""
Subspace Repository — Read operations for subspaces.

Subspaces are semantic clusters within spaces.
For v1, we only need read operations (subspaces created via signals).
"""
from dataclasses import dataclass
from datetime import datetime
from typing import Optional
import logging

from supabase import Client
from domain.entities.analytics import SubspaceVelocity, SubspaceDrift

logger = logging.getLogger(__name__)


@dataclass
class SubspaceResult:
    """Result of subspace query."""
    id: int
    space_id: int
    name: str
    description: Optional[str]
    user_id: str
    artifact_count: int
    confidence: float
    learning_rate: float
    centroid_embedding: Optional[list[float]]


class SubspaceRepository:
    """
    Repository for subspace operations.
    
    Minimal viable set (read-only for v1):
    - get_by_space(space_id)
    - get_centroid(subspace_id)
    - get_by_id(subspace_id)
    """
    
    def __init__(self, client: Client):
        self._client = client
    
    async def get_by_space(
        self, 
        space_id: int, 
        user_id: str
    ) -> list[SubspaceResult]:
        """
        Get all subspaces in a space.
        
        Args:
            space_id: Parent space ID
            user_id: Owner user ID (for RLS)
        
        Returns:
            List of SubspaceResult
        """
        try:
            response = (
                self._client.schema('misir')
                .from_('subspace')
                .select('*')
                .eq('space_id', space_id)
                .eq('user_id', user_id)
                .is_('deleted_at', 'null')
                .order('artifact_count', desc=True)
                .execute()
            )
            
            return [
                SubspaceResult(
                    id=row['id'],
                    space_id=row['space_id'],
                    name=row['name'],
                    description=row.get('description'),
                    user_id=row['user_id'],
                    artifact_count=row.get('artifact_count', 0),
                    confidence=row.get('confidence', 0.0),
                    learning_rate=row.get('learning_rate', 0.1),
                    centroid_embedding=row.get('centroid_embedding')
                )
                for row in (response.data or [])
            ]
            
        except Exception as e:
            logger.error(f"Failed to get subspaces: {e}")
            raise
    
    async def get_by_id(
        self, 
        subspace_id: int, 
        user_id: str
    ) -> Optional[SubspaceResult]:
        """
        Get subspace by ID.
        
        Args:
            subspace_id: Subspace ID
            user_id: Owner user ID (for RLS)
        
        Returns:
            SubspaceResult or None
        """
        try:
            response = (
                self._client.schema('misir')
                .from_('subspace')
                .select('*')
                .eq('id', subspace_id)
                .eq('user_id', user_id)
                .is_('deleted_at', 'null')
                .execute()
            )
            
            if response.data and len(response.data) > 0:
                row = response.data[0]
                return SubspaceResult(
                    id=row['id'],
                    space_id=row['space_id'],
                    name=row['name'],
                    description=row.get('description'),
                    user_id=row['user_id'],
                    artifact_count=row.get('artifact_count', 0),
                    confidence=row.get('confidence', 0.0),
                    learning_rate=row.get('learning_rate', 0.1),
                    centroid_embedding=row.get('centroid_embedding')
                )
            return None
            
        except Exception as e:
            logger.error(f"Failed to get subspace: {e}")
            raise
    
    async def get_centroid(
        self, 
        subspace_id: int, 
        user_id: str
    ) -> Optional[list[float]]:
        """
        Get centroid embedding for a subspace.
        
        Args:
            subspace_id: Subspace ID
            user_id: Owner user ID (for RLS)
        
        Returns:
            Centroid vector or None
        """
        try:
            response = (
                self._client.schema('misir')
                .from_('subspace')
                .select('centroid_embedding')
                .eq('id', subspace_id)
                .eq('user_id', user_id)
                .execute()
            )
            
            if response.data and len(response.data) > 0:
                return response.data[0].get('centroid_embedding')
            return None
            
        except Exception as e:
            logger.error(f"Failed to get centroid: {e}")
            raise
    
    async def get_all_centroids(
        self, 
        space_id: int, 
        user_id: str
    ) -> list[tuple[int, list[float]]]:
        """
        Get all centroids in a space (for assignment margin).
        
        Returns:
            List of (subspace_id, centroid) tuples
        """
        try:
            response = (
                self._client.schema('misir')
                .from_('subspace')
                .select('id, centroid_embedding')
                .eq('space_id', space_id)
                .eq('user_id', user_id)
                .not_.is_('centroid_embedding', 'null')
                .execute()
            )
            
            return [
                (row['id'], row['centroid_embedding'])
                for row in (response.data or [])
            ]
            
        except Exception as e:
            logger.error(f"Failed to get centroids: {e}")
            raise
    
    async def create(
        self,
        user_id: str,
        space_id: int,
        name: str,
        description: Optional[str] = None,
        initial_centroid: Optional[list[float]] = None,
        learning_rate: float = 0.1
    ) -> SubspaceResult:
        """
        Create a new subspace.
        
        Args:
            user_id: Owner user ID
            space_id: Parent space ID
            name: Subspace name
            description: Optional description
            initial_centroid: Optional initial centroid embedding
            learning_rate: Learning rate for EMA (default 0.1)
        
        Returns:
            SubspaceResult with created subspace
        """
        try:
            data = {
                'user_id': user_id,
                'space_id': space_id,
                'name': name,
                'learning_rate': learning_rate,
            }
            if description:
                data['description'] = description
            if initial_centroid:
                data['centroid_embedding'] = initial_centroid
            
            response = (
                self._client.schema('misir')
                .from_('subspace')
                .insert(data)
                .execute()
            )
            
            if response.data and len(response.data) > 0:
                row = response.data[0]
                return SubspaceResult(
                    id=row['id'],
                    space_id=row['space_id'],
                    name=row['name'],
                    description=row.get('description'),
                    user_id=row['user_id'],
                    artifact_count=row.get('artifact_count', 0),
                    confidence=row.get('confidence', 0.0),
                    learning_rate=row.get('learning_rate', 0.1),
                    centroid_embedding=row.get('centroid_embedding')
                )
            else:
                raise ValueError("Insert returned no data")
                
        except Exception as e:
            logger.error(f"Failed to create subspace: {e}")
            raise
    
    async def update_centroid(
        self,
        subspace_id: int,
        user_id: str,
        new_centroid: list[float],
        confidence: Optional[float] = None
    ) -> bool:
        """
        Update subspace centroid (manual override).
        
        Note: Normally centroids are updated by DB trigger.
        This is for manual corrections or initialization.
        
        Args:
            subspace_id: Subspace ID
            user_id: Owner user ID
            new_centroid: New centroid embedding
            confidence: Optional new confidence value
        
        Returns:
            True if updated, False if not found
        """
        try:
            data = {
                'centroid_embedding': new_centroid,
                'centroid_updated_at': 'now()',
            }
            if confidence is not None:
                data['confidence'] = confidence
            
            response = (
                self._client.schema('misir')
                .from_('subspace')
                .update(data)
                .eq('id', subspace_id)
                .eq('user_id', user_id)
                .execute()
            )
            
            return len(response.data or []) > 0
            
        except Exception as e:
            logger.error(f"Failed to update centroid: {e}")
            raise
    
    async def update_learning_rate(
        self,
        subspace_id: int,
        user_id: str,
        learning_rate: float
    ) -> bool:
        """
        Update subspace learning rate.
        
        Args:
            subspace_id: Subspace ID
            user_id: Owner user ID
            learning_rate: New learning rate (0.0 - 1.0)
        
        Returns:
            True if updated
        """
        if not 0.0 <= learning_rate <= 1.0:
            raise ValueError("learning_rate must be 0.0-1.0")
        
        try:
            response = (
                self._client.schema('misir')
                .from_('subspace')
                .update({'learning_rate': learning_rate})
                .eq('id', subspace_id)
                .eq('user_id', user_id)
                .execute()
            )
            
            return len(response.data or []) > 0
            
        except Exception as e:
            logger.error(f"Failed to update learning rate: {e}")
            raise
    
    async def get_stats(
        self,
        subspace_id: int,
        user_id: str
    ) -> Optional[dict]:
        """
        Get subspace statistics for SDD tracking.
        
        Returns:
            Dict with artifact_count, confidence, centroid_updated_at
        """
        try:
            response = (
                self._client.schema('misir')
                .from_('subspace')
                .select('artifact_count, confidence, centroid_updated_at, learning_rate')
                .eq('id', subspace_id)
                .eq('user_id', user_id)
                .execute()
            )
            
            if response.data and len(response.data) > 0:
                return response.data[0]
            return None
            
        except Exception as e:
            logger.error(f"Failed to get stats: {e}")
            raise

    async def add_marker(
        self,
        subspace_id: int,
        marker_id: int,
        weight: float = 1.0,
        source: str = "manual"
    ) -> bool:
        """
        Associate a marker with a subspace (Junction Table).
        
        Args:
            subspace_id: Subspace ID
            marker_id: Marker ID
            weight: Relevance weight (0.0-1.0)
            source: Source of association (manual, auto)
            
        Returns:
            True if successful
        """
        try:
            data = {
                'subspace_id': subspace_id,
                'marker_id': marker_id,
                'weight': weight,
                'source': source
            }
            
            response = (
                self._client.schema('misir')
                .from_('subspace_marker')
                .insert(data)
                .execute()
            )
            
            return len(response.data or []) > 0
            
        except Exception as e:
            logger.error(f"Failed to add marker: {e}")
            # Likely duplicate key error if exists
            raise

    async def remove_marker(
        self,
        subspace_id: int,
        marker_id: int
    ) -> bool:
        """
        Remove marker association from subspace.
        
        Args:
            subspace_id: Subspace ID
            marker_id: Marker ID
            
        Returns:
            True if removed
        """
        try:
            response = (
                self._client.schema('misir')
                .from_('subspace_marker')
                .delete()
                .eq('subspace_id', subspace_id)
                .eq('marker_id', marker_id)
                .execute()
            )
            
            return len(response.data or []) > 0
            
        except Exception as e:
            logger.error(f"Failed to remove marker: {e}")
            raise

    async def get_markers(
        self,
        subspace_id: int
    ) -> list[dict]:
        """
        Get all markers for a subspace.
        
        Returns:
            List of dicts with marker details and weight
        """
        try:
            response = (
                self._client.schema('misir')
                .from_('subspace_marker')
                .select('weight, source, marker:marker_id(id, term, embedding)')
                .eq('subspace_id', subspace_id)
                .execute()
            )
            
            return response.data or []
            
        except Exception as e:
            logger.error(f"Failed to get markers: {e}")
            raise

    async def log_velocity(
        self,
        subspace_id: int,
        velocity: float,
        displacement: list[float]
    ) -> bool:
        """Log subspace velocity."""
        try:
            self._client.schema('misir').from_('subspace_velocity').insert({
                'subspace_id': subspace_id,
                'velocity': velocity,
                'displacement': displacement
            }).execute()
            return True
        except Exception as e:
            logger.error(f"Failed to log velocity: {e}")
            return False

    async def log_drift(
        self,
        subspace_id: int,
        drift_magnitude: float,
        previous_centroid: list[float],
        new_centroid: list[float],
        trigger_signal_id: int
    ) -> bool:
        """Log subspace drift event."""
        try:
            self._client.schema('misir').from_('subspace_drift').insert({
                'subspace_id': subspace_id,
                'drift_magnitude': drift_magnitude,
                'previous_centroid': previous_centroid,
                'new_centroid': new_centroid,
                'trigger_signal_id': trigger_signal_id
            }).execute()
            return True
        except Exception as e:
            logger.error(f"Failed to log drift: {e}")
            return False
            
    async def get_velocity_history(
        self,
        subspace_id: int,
        limit: int = 50
    ) -> list[SubspaceVelocity]:
        """Get velocity history."""
        try:
            response = (
                self._client.schema('misir')
                .from_('subspace_velocity')
                .select('*')
                .eq('subspace_id', subspace_id)
                .order('measured_at', desc=True)
                .limit(limit)
                .execute()
            )
            return [
                SubspaceVelocity(
                    subspace_id=row['subspace_id'],
                    space_id=0, # Not fetched in this query, optimization
                    velocity=row['velocity'],
                    displacement=row['displacement'],
                    measured_at=datetime.fromisoformat(row['measured_at'])
                )
                for row in (response.data or [])
            ]
        except Exception as e:
            logger.error(f"Failed to get velocity history: {e}")
            return []

    async def get_drift_history(
        self,
        subspace_id: int,
        limit: int = 50
    ) -> list[SubspaceDrift]:
        """Get drift history."""
        try:
            response = (
                self._client.schema('misir')
                .from_('subspace_drift')
                .select('*')
                .eq('subspace_id', subspace_id)
                .order('occurred_at', desc=True)
                .limit(limit)
                .execute()
            )
            return [
                SubspaceDrift(
                    id=row['id'],
                    subspace_id=row['subspace_id'],
                    space_id=0,
                    drift_magnitude=row['drift_magnitude'],
                    previous_centroid=row['previous_centroid'],
                    new_centroid=row['new_centroid'],
                    trigger_signal_id=row['trigger_signal_id'],
                    occurred_at=datetime.fromisoformat(row['occurred_at'])
                )
                for row in (response.data or [])
            ]
        except Exception as e:
            logger.error(f"Failed to get drift history: {e}")
            return []
