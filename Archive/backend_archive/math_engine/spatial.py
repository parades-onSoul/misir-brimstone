import numpy as np
from typing import List
from domain.models import Signal

def calculate_centroid(signals: List[Signal]) -> np.ndarray:
    """
    Calculates the weighted center of gravity for a set of signals.
    Centroid = Σ(Vector_i * Magnitude_i) / Σ(Magnitude_i)
    """
    if not signals:
        return np.zeros(0) 
        
    # Stack vectors: (N, D)
    vectors = np.stack([s.vector for s in signals])
    # Weights: (N,)
    weights = np.array([s.magnitude for s in signals])
    
    total_weight = np.sum(weights)
    if total_weight == 0:
        return np.mean(vectors, axis=0) # Fallback to arithmetic mean
        
    # Weighted average
    weighted_sum = np.dot(weights, vectors)
    return weighted_sum / total_weight

def calculate_dispersion(signals: List[Signal], centroid: np.ndarray) -> float:
    """
    Calculates signal dispersion (weighted variance/spread).
    """
    if not signals:
        return 0.0
        
    distances = np.array([np.linalg.norm(s.vector - centroid) for s in signals])
    weights = np.array([s.magnitude for s in signals])
    
    total_weight = np.sum(weights)
    if total_weight == 0:
        return float(np.mean(distances))
        
    return float(np.sum(distances * weights) / total_weight)
