import numpy as np
from typing import Optional
from datetime import timedelta
from domain.models import SpaceState, Delta

def calculate_drift(previous: SpaceState, current: SpaceState) -> Delta:
    """
    Calculates the vector difference (Drift) between two states.
    Returns a Delta object encapsulating the movement.
    """
    return Delta(
        previous_state=previous,
        current_state=current
    )

def calculate_velocity(delta: Delta) -> float:
    """
    Calculates the speed of drift over time (Magnitude / TimeDelta).
    """
    time_diff = delta.current_state.timestamp - delta.previous_state.timestamp
    seconds = time_diff.total_seconds()
    
    if seconds <= 0:
        return 0.0
        
    return delta.magnitude / seconds
