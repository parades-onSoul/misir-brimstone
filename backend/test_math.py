import sys
import os
import numpy as np
import uuid
from datetime import datetime, timedelta

# Add backend to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from math_engine.spatial import calculate_centroid, calculate_dispersion
from math_engine.dynamics import calculate_drift, calculate_velocity
from domain.models import Signal, SpaceState, SignalType

def test_math_engine():
    print("Testing Math Engine...")
    
    # 1. Setup Signals
    # Vector A: [1, 0]
    # Vector B: [0, 1]
    vec_a = np.array([1.0, 0.0])
    vec_b = np.array([0.0, 1.0])
    
    sig_a = Signal(uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), vec_a, 1.0, SignalType.SEMANTIC, datetime.now())
    sig_b = Signal(uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), vec_b, 1.0, SignalType.SEMANTIC, datetime.now())
    
    # 2. Test Centroid
    # Expected: [0.5, 0.5] (Average of [1,0] and [0,1] with equal weight)
    centroid = calculate_centroid([sig_a, sig_b])
    print(f"Centroid: {centroid}")
    
    assert np.allclose(centroid, np.array([0.5, 0.5])), f"Centroid incorrect: {centroid}"
    print("✅ Centroid Calculation Correct")
    
    # 3. Test Dispersion
    disp = calculate_dispersion([sig_a, sig_b], centroid)
    print(f"Dispersion: {disp}")
    # Dist from [0.5, 0.5] to [1, 0] is sqrt(0.5^2 + 0.5^2) = sqrt(0.5) = ~0.707
    expected_disp = np.linalg.norm(vec_a - centroid)
    assert np.isclose(disp, expected_disp), f"Dispersion incorrect: {disp}"
    print("✅ Dispersion Calculation Correct")
    
    # 4. Test Drift
    # State 1: At Origin
    start_time = datetime.now()
    state_1 = SpaceState(uuid.uuid4(), start_time, np.array([0.0, 0.0]), 0.0, np.array([0,0]), 0.0, 0)
    
    # State 2: At [1.0, 0.0] (Moved right 1 unit)
    # 10 minutes later
    end_time = start_time + timedelta(minutes=10)
    state_2 = SpaceState(uuid.uuid4(), end_time, np.array([1.0, 0.0]), 0.0, np.array([0,0]), 0.0, 0)
    
    delta = calculate_drift(state_1, state_2)
    print(f"Drift Magnitude: {delta.magnitude}")
    print(f"Drift Vector: {delta.drift_vector}")
    
    assert delta.magnitude == 1.0
    assert np.allclose(delta.drift_vector, np.array([1.0, 0.0]))
    print("✅ Drift Calculation Correct")
    
    # 5. Test Velocity
    # Moved 1.0 units in 600 seconds = 1/600 units/sec
    velocity = calculate_velocity(delta)
    expected_velocity = 1.0 / 600.0
    print(f"Velocity: {velocity}")
    assert np.isclose(velocity, expected_velocity)
    print("✅ Velocity Calculation Correct")

if __name__ == "__main__":
    test_math_engine()
