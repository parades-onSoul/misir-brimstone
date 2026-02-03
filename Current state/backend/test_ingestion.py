import sys
import os
import numpy as np

# Add backend to path so imports work
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ingestion.processors import TextProcessor
from intelligence.embeddings import embedding_service
from domain.models import Signal, SignalType

def test_pipeline():
    print("1. Initializing Processor...")
    processor = TextProcessor()
    
    raw_text = "   Misir is an orientation engine for knowledge spaces.   "
    print(f"   Input: '{raw_text}'")
    
    print("2. Processing Artifact...")
    artifact = processor.process(raw_text, source_url="test://manual")
    print(f"   Artifact Created: {artifact.id}")
    print(f"   Cleaned Content: '{artifact.content}'")
    
    print("3. Generating Embedding...")
    vector = embedding_service.embed(artifact.content)
    print(f"   Vector Shape: {vector.shape}")
    print(f"   First 5 dims: {vector[:5]}")
    
    print("4. Creating Signal...")
    # Mock space ID
    import uuid
    space_id = uuid.uuid4()
    
    signal = Signal(
        id=uuid.uuid4(),
        artifact_id=artifact.id,
        space_id=space_id,
        vector=vector,
        magnitude=1.0, # Default validation magnitude
        signal_type=SignalType.SEMANTIC,
        timestamp=artifact.created_at
    )
    
    print(f"   Signal Created: {signal.id}")
    print("   ✅ Validated: Text -> Artifact -> Vector -> Signal")

if __name__ == "__main__":
    test_pipeline()
