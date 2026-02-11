"""
Subspace Repository — Read operations for subspaces.

Subspaces are semantic clusters within spaces.
For v1, we only need read operations (subspaces created via signals).
Returns Result[T, ErrorDetail] for type-safe error handling.
"""
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from result import Result, Ok, Err
from core.config import get_settings
from supabase import Client
from domain.entities.analytics import SubspaceVelocity, SubspaceDrift, SubspaceConfidence
from core.error_types import (
    ErrorDetail,
    repository_error,
    not_found_error
)
from core.logging_config import get_logger

logger = get_logger(__name__)


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
    markers: list[str]


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

    def _parse_embedding(self, embedding_data: any) -> Optional[list[float]]:
        """Parse embedding from Supabase response (string or list) to list[float]."""
        if embedding_data is None:
            return None
        if isinstance(embedding_data, list):
            return embedding_data
        if isinstance(embedding_data, str):
            try:
                return json.loads(embedding_data)
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse embedding string: {embedding_data[:50]}...")
                return None
        return None
    
    async def get_by_space(
        self, 
        space_id: int, 
        user_id: str
    ) -> Result[list[SubspaceResult], ErrorDetail]:
        """
        Get all subspaces in a space.
        
        Args:
            space_id: Parent space ID
            user_id: Owner user ID (for RLS)
        
        Returns:
            Result[list[SubspaceResult], ErrorDetail]: List of subspaces or error
        """
        try:
            response = (
                self._client.schema('misir')
                .from_('subspace')
                .select('*, subspace_marker(marker(label))')
                .eq('space_id', space_id)
                .eq('user_id', user_id)
                .order('artifact_count', desc=True)
                .execute()
            )
            
            results = []
            for row in (response.data or []):
                # Flatten nested markers
                markers = []
                if row.get('subspace_marker'):
                    for sm in row['subspace_marker']:
                        if sm.get('marker') and sm['marker'].get('label'):
                            markers.append(sm['marker']['label'])

                results.append(SubspaceResult(
                    id=row['id'],
                    space_id=row['space_id'],
                    name=row['name'],
                    description=row.get('description'),
                    user_id=row['user_id'],
                    artifact_count=row.get('artifact_count', 0),
                    confidence=row.get('confidence', 0.0),
                    learning_rate=row.get('learning_rate', 0.1),
                    centroid_embedding=self._parse_embedding(row.get('centroid_embedding')),
                    markers=markers
                ))
            return Ok(results)
            
        except Exception as e:
            logger.error(f"Failed to get subspaces: {e}", exc_info=e)
            return Err(repository_error(
                f"Failed to get subspaces: {str(e)}",
                operation="get_subspaces",
                space_id=space_id,
                user_id=user_id
            ))
    
    async def get_by_id(
        self, 
        subspace_id: int, 
        user_id: str
    ) -> Result[Optional[SubspaceResult], ErrorDetail]:
        """
        Get subspace by ID.
        
        Args:
            subspace_id: Subspace ID
            user_id: Owner user ID (for RLS)
        
        Returns:
            Result[Optional[SubspaceResult], ErrorDetail]: Subspace or None if not found, or error
        """
        try:
            response = (
                self._client.schema('misir')
                .from_('subspace')
                .select('*, subspace_marker(marker(label))')
                .eq('id', subspace_id)
                .eq('user_id', user_id)
                .execute()
            )
            
            if response.data and len(response.data) > 0:
                row = response.data[0]
                
                # Flatten nested markers
                markers = []
                if row.get('subspace_marker'):
                    for sm in row['subspace_marker']:
                        if sm.get('marker') and sm['marker'].get('label'):
                            markers.append(sm['marker']['label'])

                result = SubspaceResult(
                    id=row['id'],
                    space_id=row['space_id'],
                    name=row['name'],
                    description=row.get('description'),
                    user_id=row['user_id'],
                    artifact_count=row.get('artifact_count', 0),
                    confidence=row.get('confidence', 0.0),
                    learning_rate=row.get('learning_rate', 0.1),
                    centroid_embedding=self._parse_embedding(row.get('centroid_embedding')),
                    markers=markers
                )
                return Ok(result)
            return Ok(None)
            
        except Exception as e:
            logger.error(f"Failed to get subspace: {e}", exc_info=e)
            return Err(repository_error(
                f"Failed to get subspace: {str(e)}",
                operation="get_subspace",
                subspace_id=subspace_id,
                user_id=user_id
            ))
    
    async def get_centroid(
        self, 
        subspace_id: int, 
        user_id: str
    ) -> Result[Optional[list[float]], ErrorDetail]:
        """
        Get centroid embedding for a subspace.
        
        Args:
            subspace_id: Subspace ID
            user_id: Owner user ID (for RLS)
        
        Returns:
            Result[Optional[list[float]], ErrorDetail]: Centroid vector, None, or error
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
                return Ok(response.data[0].get('centroid_embedding'))
            return Ok(None)
            
        except Exception as e:
            logger.error(f"Failed to get centroid: {e}", exc_info=e)
            return Err(repository_error(
                f"Failed to get centroid: {str(e)}",
                operation="get_centroid",
                subspace_id=subspace_id
            ))
    
    async def get_all_centroids(
        self, 
        space_id: int, 
        user_id: str
    ) -> Result[list[tuple[int, list[float]]], ErrorDetail]:
        """
        Get all centroids in a space (for assignment margin).
        
        Returns:
            Result[list[tuple[int, list[float]]], ErrorDetail]: List of (subspace_id, centroid) tuples or error
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
            
            results = [
                (row['id'], row['centroid_embedding'])
                for row in (response.data or [])
            ]
            return Ok(results)
            
        except Exception as e:
            logger.error(f"Failed to get centroids: {e}", exc_info=e)
            return Err(repository_error(
                f"Failed to get centroids: {str(e)}",
                operation="get_all_centroids",
                space_id=space_id
            ))
    
    async def create(
        self,
        user_id: str,
        space_id: int,
        name: str,
        description: Optional[str] = None,
        initial_centroid: Optional[list[float]] = None,
        learning_rate: float = None
    ) -> SubspaceResult:
        """
        Create a new subspace.
        
        Args:
            user_id: Owner user ID
            space_id: Parent space ID
            name: Subspace name
            description: Optional description
            initial_centroid: Optional initial centroid embedding
            learning_rate: Learning rate for EMA (defaults to config.SUBSPACE_LEARNING_RATE)
        
        Returns:
            SubspaceResult with created subspace
        """
        try:
            if learning_rate is None:
                config = get_settings()
                learning_rate = config.SUBSPACE_LEARNING_RATE
            
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
        confidence: Optional[float] = None,
        previous_centroid: Optional[list[float]] = None,
        trigger_signal_id: Optional[int] = None,
        space_id: Optional[int] = None,
        last_updated: Optional[datetime] = None
    ) -> bool:
        """
        Update subspace centroid with drift/velocity tracking.
        
        Note: Normally centroids are updated by DB trigger.
        This is for manual corrections or when using analytics.
        
        Args:
            subspace_id: Subspace ID
            user_id: Owner user ID
            new_centroid: New centroid embedding
            confidence: Optional new confidence value
            previous_centroid: Previous centroid for drift calculation
            trigger_signal_id: Signal that triggered update (for drift logging)
            space_id: Space ID (for drift logging)
            last_updated: Timestamp of last update (for velocity)
        
        Returns:
            True if updated, False if not found
        """
        try:
            # Prepare update data
            data = {
                'centroid_embedding': new_centroid,
                'centroid_updated_at': 'now()',
            }
            if confidence is not None:
                data['confidence'] = confidence
            
            # If we have drift tracking info, calculate and log analytics
            if previous_centroid and trigger_signal_id and space_id:
                from infrastructure.services.subspace_analytics import SubspaceAnalyticsService
                analytics = SubspaceAnalyticsService()
                
                # Calculate drift
                drift = analytics.calculate_drift(previous_centroid, new_centroid)
                
                # Log drift if significant
                if analytics.should_log_drift(drift):
                    await self.log_drift(
                        subspace_id=subspace_id,
                        drift_magnitude=drift,
                        previous_centroid=previous_centroid,
                        new_centroid=new_centroid,
                        trigger_signal_id=trigger_signal_id
                    )
                
                # Calculate and log velocity if timestamp provided
                if last_updated:
                    time_delta = (datetime.now(timezone.utc) - last_updated).total_seconds()
                    velocity, displacement = analytics.calculate_velocity(
                        previous_centroid, 
                        new_centroid, 
                        time_delta
                    )
                    
                    await self.log_velocity(
                        subspace_id=subspace_id,
                        velocity=velocity,
                        displacement=displacement
                    )
            
            # Update centroid
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
    
    async def update_confidence_from_batch(
        self,
        subspace_id: int,
        user_id: str,
        batch_embeddings: list[list[float]],
        current_centroid: list[float],
        current_confidence: float,
        learning_rate: float = None
    ) -> Optional[float]:
        """
        Calculate and update confidence based on batch coherence.
        
        Uses batch coherence (average similarity to centroid) to update
        confidence via exponential moving average.
        
        Args:
            subspace_id: Subspace ID
            user_id: Owner user ID
            batch_embeddings: New embeddings being added
            current_centroid: Current centroid vector
            current_confidence: Current confidence value
            learning_rate: How quickly to adapt confidence (defaults to config.CONFIDENCE_LEARNING_RATE)
            
        Returns:
            New confidence value, or None if update failed
        """
        try:
            if learning_rate is None:
                config = get_settings()
                learning_rate = config.CONFIDENCE_LEARNING_RATE
            
            from infrastructure.services.subspace_analytics import SubspaceAnalyticsService
            analytics = SubspaceAnalyticsService()
            
            # Calculate batch coherence
            batch_coherence = analytics.calculate_batch_coherence(
                batch_embeddings,
                current_centroid
            )
            
            # Update confidence using EMA
            new_confidence = analytics.update_confidence(
                current_confidence,
                batch_coherence,
                learning_rate
            )
            
            # Persist to database
            response = (
                self._client.schema('misir')
                .from_('subspace')
                .update({'confidence': new_confidence})
                .eq('id', subspace_id)
                .eq('user_id', user_id)
                .execute()
            )
            
            if response.data and len(response.data) > 0:
                logger.info(f"Updated confidence for subspace {subspace_id}: {current_confidence:.3f} → {new_confidence:.3f} (coherence: {batch_coherence:.3f})")
                return new_confidence
            return None
            
        except Exception as e:
            logger.error(f"Failed to update confidence: {e}")
            return None
    
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
    
    async def decay_marker_weights(
        self,
        subspace_id: int,
        decay_rate: float = None,
        min_weight: float = None
    ) -> int:
        """
        Apply time-based decay to all marker weights in a subspace.
        
        Implements decay floor to prevent weights from reaching zero.
        Formula: new_weight = max(old_weight * (1 - decay_rate), min_weight)
        
        Args:
            subspace_id: Subspace ID
            decay_rate: Fraction to decay (defaults to config.MARKER_DECAY_RATE)
            min_weight: Minimum weight floor (defaults to config.MARKER_MIN_WEIGHT)
            
        Returns:
            Number of markers updated
        """
        try:
            if decay_rate is None or min_weight is None:
                config = get_settings()
                if decay_rate is None:
                    decay_rate = config.MARKER_DECAY_RATE
                if min_weight is None:
                    min_weight = config.MARKER_MIN_WEIGHT
            
            # Get current markers
            markers = await self.get_markers(subspace_id)
            
            if not markers:
                return 0
            
            updated_count = 0
            
            for marker in markers:
                current_weight = marker.get('weight', 1.0)
                
                # Apply decay with floor
                new_weight = max(
                    current_weight * (1 - decay_rate),
                    min_weight
                )
                
                # Only update if weight changed
                if abs(new_weight - current_weight) > 0.0001:
                    self._client.schema('misir').from_('subspace_marker').update({
                        'weight': new_weight
                    }).eq('subspace_id', subspace_id).eq(
                        'marker_id', 
                        marker['marker']['id']
                    ).execute()
                    
                    updated_count += 1
            
            return updated_count
            
        except Exception as e:
            logger.error(f"Failed to decay marker weights: {e}")
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

    async def get_confidence_history(
        self,
        subspace_id: int,
        limit: int = 50
    ) -> list[SubspaceConfidence]:
        """Get confidence history."""
        try:
            response = (
                self._client.schema('misir')
                .from_('subspace_centroid_history')
                .select('subspace_id, confidence, computed_at')
                .eq('subspace_id', subspace_id)
                .order('computed_at', desc=True)
                .limit(limit)
                .execute()
            )
            return [
                SubspaceConfidence(
                    subspace_id=row['subspace_id'],
                    confidence=row['confidence'],
                    computed_at=datetime.fromisoformat(row['computed_at'])
                )
                for row in (response.data or [])
            ]
        except Exception as e:
            logger.error(f"Failed to get confidence history: {e}")
            return []
