"""
Subspace Analytics Service — Handles drift detection, velocity tracking, and confidence calculations.
"""
import logging
import numpy as np
from typing import List, Optional
from datetime import datetime

from core.config import get_settings
from domain.entities.analytics import SubspaceVelocity, SubspaceDrift

logger = logging.getLogger(__name__)


class SubspaceAnalyticsService:
    """
    Service for subspace analytics calculations.
    
    Responsibilities:
    - Calculate drift magnitude between centroids
    - Calculate velocity (displacement over time)
    - Calculate confidence using batch coherence
    """
    
    def __init__(self, drift_threshold: float = None):
        """
        Initialize analytics service.
        
        Args:
            drift_threshold: Minimum drift to trigger event logging (defaults to config.DRIFT_THRESHOLD)
        """
        config = get_settings()
        self.drift_threshold = drift_threshold if drift_threshold is not None else config.DRIFT_THRESHOLD
        self.drift_threshold = drift_threshold
    
    def calculate_drift(
        self,
        previous_centroid: List[float],
        new_centroid: List[float]
    ) -> float:
        """
        Calculate drift magnitude as 1 - cosine_similarity.
        
        Args:
            previous_centroid: Previous centroid vector
            new_centroid: New centroid vector
            
        Returns:
            Drift magnitude (0 = no drift, 1 = complete drift)
        """
        try:
            prev = np.array(previous_centroid)
            new = np.array(new_centroid)
            
            # Cosine similarity
            dot_product = np.dot(prev, new)
            magnitude = np.linalg.norm(prev) * np.linalg.norm(new)
            
            if magnitude == 0:
                return 0.0
            
            similarity = dot_product / magnitude
            
            # Drift is inverse of similarity
            drift = 1 - similarity
            
            return max(0.0, drift)  # Clamp to [0, 1]
            
        except Exception as e:
            logger.error(f"Failed to calculate drift: {e}")
            return 0.0
    
    def should_log_drift(self, drift_magnitude: float) -> bool:
        """
        Determine if drift is significant enough to log.
        
        Args:
            drift_magnitude: Calculated drift value
            
        Returns:
            True if should be logged
        """
        return drift_magnitude >= self.drift_threshold
    
    def calculate_velocity(
        self,
        previous_centroid: List[float],
        new_centroid: List[float],
        time_delta_seconds: float
    ) -> tuple[float, List[float]]:
        """
        Calculate velocity as displacement / time.
        
        Args:
            previous_centroid: Previous centroid vector
            new_centroid: New centroid vector
            time_delta_seconds: Time elapsed since last update
            
        Returns:
            (scalar_velocity, displacement_vector)
        """
        try:
            prev = np.array(previous_centroid)
            new = np.array(new_centroid)
            
            # Displacement vector
            displacement = (new - prev).tolist()
            
            # Scalar velocity (magnitude per second)
            magnitude = np.linalg.norm(new - prev)
            velocity = magnitude / max(time_delta_seconds, 1.0)  # Avoid division by zero
            
            return float(velocity), displacement
            
        except Exception as e:
            logger.error(f"Failed to calculate velocity: {e}")
            return 0.0, [0.0] * len(previous_centroid)
    
    def calculate_batch_coherence(
        self,
        embeddings: List[List[float]],
        centroid: List[float]
    ) -> float:
        """
        Calculate how coherent a batch of embeddings is relative to the centroid.
        
        Uses average cosine similarity of batch items to the centroid.
        Higher values = more coherent batch.
        
        Args:
            embeddings: List of embedding vectors
            centroid: Centroid vector
            
        Returns:
            Coherence score (0 = no coherence, 1 = perfect coherence)
        """
        try:
            if not embeddings:
                return 0.0
            
            centroid_vec = np.array(centroid)
            centroid_norm = np.linalg.norm(centroid_vec)
            
            if centroid_norm == 0:
                return 0.0
            
            similarities = []
            
            for embedding in embeddings:
                vec = np.array(embedding)
                vec_norm = np.linalg.norm(vec)
                
                if vec_norm == 0:
                    continue
                
                # Cosine similarity
                similarity = np.dot(vec, centroid_vec) / (vec_norm * centroid_norm)
                similarities.append(similarity)
            
            if not similarities:
                return 0.0
            
            # Average similarity
            coherence = float(np.mean(similarities))
            
            return max(0.0, min(1.0, coherence))  # Clamp to [0, 1]
            
        except Exception as e:
            logger.error(f"Failed to calculate batch coherence: {e}")
            return 0.0
    
    def update_confidence(
        self,
        current_confidence: float,
        batch_coherence: float,
        learning_rate: float = 0.05
    ) -> float:
        """
        Update confidence using exponential moving average.
        
        Formula: new_confidence = (1 - α) * old + α * coherence
        
        Args:
            current_confidence: Current confidence value
            batch_coherence: Coherence of new batch
            learning_rate: How quickly to adapt (default 0.05)
            
        Returns:
            Updated confidence value
        """
        try:
            new_confidence = (1 - learning_rate) * current_confidence + learning_rate * batch_coherence
            return max(0.0, min(1.0, new_confidence))  # Clamp to [0, 1]
            
        except Exception as e:
            logger.error(f"Failed to update confidence: {e}")
            return current_confidence
    
    def create_drift_event(
        self,
        subspace_id: int,
        space_id: int,
        drift_magnitude: float,
        previous_centroid: List[float],
        new_centroid: List[float],
        trigger_signal_id: int
    ) -> SubspaceDrift:
        """
        Create a SubspaceDrift entity for persistence.
        
        Args:
            subspace_id: Subspace ID
            space_id: Space ID
            drift_magnitude: Calculated drift value
            previous_centroid: Old centroid vector
            new_centroid: New centroid vector
            trigger_signal_id: Signal that triggered this drift
            
        Returns:
            SubspaceDrift entity
        """
        return SubspaceDrift(
            id=None,
            subspace_id=subspace_id,
            space_id=space_id,
            drift_magnitude=drift_magnitude,
            previous_centroid=previous_centroid,
            new_centroid=new_centroid,
            trigger_signal_id=trigger_signal_id,
            occurred_at=datetime.now(timezone.utc)
        )
    
    def create_velocity_event(
        self,
        subspace_id: int,
        space_id: int,
        velocity: float,
        displacement: List[float]
    ) -> SubspaceVelocity:
        """
        Create a SubspaceVelocity entity for persistence.
        
        Args:
            subspace_id: Subspace ID
            space_id: Space ID
            velocity: Scalar velocity
            displacement: Displacement vector
            
        Returns:
            SubspaceVelocity entity
        """
        return SubspaceVelocity(
            subspace_id=subspace_id,
            space_id=space_id,
            velocity=velocity,
            displacement=displacement,
            measured_at=datetime.now(timezone.utc)
        )
