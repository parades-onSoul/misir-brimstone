import sys
import os
import numpy as np
import uuid
from datetime import datetime

# Add backend to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from math_engine.subspace import SubspaceEngine
from domain.models import Subspace, Signal, SignalType, Marker

def test_evolution():
    print("🧪 Testing Subspace Evolution...")
    engine = SubspaceEngine(learning_rate=0.5) # High alpha for dramatic effect in test
    
    # 1. Initialize Empty Subspace at Origin [0, 0]
    subspace = Subspace(
        id=uuid.uuid4(),
        name="Test Space",
        centroid=np.array([0.0, 0.0]),
        markers=[],
        confidence=1.0,
        last_updated=datetime.now()
    )
    print(f"Start Centroid: {subspace.centroid}")
    
    # 2. Add Signal A at [1, 0]
    # Centroid should move halfway to [0.5, 0] (since alpha=0.5)
    sig_a = Signal(uuid.uuid4(), uuid.uuid4(), subspace.id, np.array([1.0, 0.0]), 1.0, SignalType.SEMANTIC, datetime.now())
    
    engine.update_subspace(subspace, [sig_a])
    print(f"Step 1 Centroid (Target [1,0]): {subspace.centroid}")
    assert np.allclose(subspace.centroid, np.array([0.5, 0.0]))
    print("✅ Step 1 Correct")
    
    # 3. Add Signal B at [0, 1]
    # Current is [0.5, 0]. Target is [0, 1].
    # New = 0.5 * [0.5, 0] + 0.5 * [0, 1]
    #     = [0.25, 0] + [0, 0.5]
    #     = [0.25, 0.5]
    sig_b = Signal(uuid.uuid4(), uuid.uuid4(), subspace.id, np.array([0.0, 1.0]), 1.0, SignalType.SEMANTIC, datetime.now())
    
    engine.update_subspace(subspace, [sig_b])
    print(f"Step 2 Centroid (Target [0,1]): {subspace.centroid}")
    assert np.allclose(subspace.centroid, np.array([0.25, 0.5]))
    print("✅ Step 2 Correct")
    
    print("All System Checks Passed. The Engine is Learning.")

if __name__ == "__main__":
    test_evolution()
