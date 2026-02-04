import numpy as np
from typing import List, Optional
from datetime import datetime
from domain.models import Subspace, Signal, Marker

class SubspaceEngine:
    """
    Manages the evolution of Subspaces over time.
    Principles:
    1. Centroids move towards new evidence (Incremental Learning)
    2. Markers gain/lose confidence based on usage
    """
    
    def __init__(self, learning_rate: float = 0.1, decay_rate: float = 0.05):
        self.learning_rate = learning_rate # Alpha: How much new info shifts the centroid
        self.decay_rate = decay_rate

    def update_subspace(self, subspace: Subspace, new_signals: List[Signal]) -> Subspace:
        """
        Updates a subspace with a batch of new signals.
        Returns the mutated subspace.
        """
        if not new_signals:
            return subspace

        # 1. Calculate the 'Signal Centroid' of the new batch
        batch_vectors = np.stack([s.vector for s in new_signals])
        batch_weights = np.array([s.magnitude for s in new_signals])
        
        # Weighted mean of the new batch
        total_weight = np.sum(batch_weights)
        if total_weight > 0:
            batch_centroid = np.average(batch_vectors, axis=0, weights=batch_weights)
        else:
            batch_centroid = np.mean(batch_vectors, axis=0)
            
        # 2. Update Space Centroid (Exponential Moving Average)
        # New = (1 - alpha) * Old + alpha * Batch
        # We adjust alpha based on total_weight to prevent tiny signals from shifting massive spaces too much
        # For MVP, we stick to fixed learning rate for simplicity/predictability
        
        old_centroid = subspace.centroid
        if old_centroid.size == 0:
            new_centroid = batch_centroid # Initialize
        else:
            new_centroid = (1 - self.learning_rate) * old_centroid + (self.learning_rate * batch_centroid)
            
        # 3. Update Markers (Placeholder - requires NLP extraction in real usage)
        # For now, we just decay existing markers
        self._decay_markers(subspace.markers)
        
        # 4. Update definition
        subspace.centroid = new_centroid
        subspace.last_updated = datetime.now()
        
        # Track velocity (simple diff)
        if old_centroid.size > 0:
            subspace.velocity = new_centroid - old_centroid
            
        return subspace

    def _decay_markers(self, markers: List[Marker]):
        """
        Reduces weight/confidence of markers over time.
        """
        for marker in markers:
            marker.weight *= (1 - self.decay_rate)
            # Clip at 0
            if marker.weight < 0:
                marker.weight = 0

# Singleton
subspace_engine = SubspaceEngine()
