"""
Subspace Repository — Read operations for subspaces.

Subspaces are semantic clusters within spaces.
For v1, we only need read operations (subspaces created via signals).
"""
from dataclasses import dataclass
from typing import Optional
import logging

from supabase import Client

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
