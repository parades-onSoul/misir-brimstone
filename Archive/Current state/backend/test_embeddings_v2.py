import sys
import os
import numpy as np

# Add backend to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from intelligence.embeddings import get_embedding_service, LocalEmbeddingService

def test_embedding_refactor():
    print("Testing Refactored Embedding Service...")
    
    # 1. Test Factory
    service = get_embedding_service('default')
    print(f"Service loaded model: {service.model_name}")
    assert service.model_name == 'nomic-ai/nomic-embed-text-v1.5'
    
    # 2. Test Dimensions (Nomic Embed = 768-dim)
    dim = service.dimension
    print(f"Dimension: {dim}")
    assert dim == 768
    
    # 3. Test Single Embedding
    text = "Misir Orientation Logic"
    vec = service.embed(text)
    print(f"Vector shape: {vec.shape}")
    assert vec.shape == (768,)
    
    # 4. Test Batch Embedding
    texts = ["Signal A", "Signal B", "Signal C"]
    vecs = service.embed_batch(texts)
    print(f"Batch items: {len(vecs)}")
    print(f"First vec shape: {vecs[0].shape}")
    
    assert len(vecs) == 3
    assert vecs[0].shape == (768,)
    
    print("✅ Embedding Service Refactor Verified (Nomic 768-dim)")


def test_matryoshka():
    """Test Matryoshka dimensionality truncation."""
    print("\nTesting Matryoshka Dimensionality...")
    
    service = get_embedding_service('default')
    text = "Quantum computing enables exponentially faster computations"
    
    # 1. Full dimension
    full = service.embed(text)
    print(f"Full vector: {full.shape}")
    assert full.shape == (768,)
    
    # 2. Truncated dimensions
    for target_dim in [512, 384, 256, 128]:
        truncated = service.embed(text, dim=target_dim)
        print(f"Truncated to {target_dim}: {truncated.shape}")
        assert truncated.shape == (target_dim,)
        
        # Verify it's normalized (for cosine similarity)
        norm = np.linalg.norm(truncated)
        assert abs(norm - 1.0) < 0.01, f"Expected norm ~1.0, got {norm}"
    
    # 3. Test convenience methods
    ext_vec = service.embed_for_extension(text)
    print(f"Extension vector: {ext_vec.shape}")
    assert ext_vec.shape == (384,)
    
    search_vec = service.embed_for_search(text)
    print(f"Search vector: {search_vec.shape}")
    assert search_vec.shape == (256,)
    
    # 4. Test batch truncation
    texts = ["Alpha", "Beta", "Gamma"]
    batch_truncated = service.embed_batch(texts, dim=256)
    print(f"Batch truncated: {len(batch_truncated)} vectors of shape {batch_truncated[0].shape}")
    assert all(v.shape == (256,) for v in batch_truncated)
    
    # 5. Verify semantic preservation (truncated vectors should be similar direction)
    # First 256 dims of full should match the truncated 256
    full_prefix = full[:256]
    full_prefix_norm = full_prefix / np.linalg.norm(full_prefix)
    similarity = np.dot(full_prefix_norm, service.embed(text, dim=256))
    print(f"Semantic preservation (256-dim): {similarity:.4f}")
    assert similarity > 0.99, f"Expected >0.99 similarity, got {similarity}"
    
    print("✅ Matryoshka Dimensionality Verified")


if __name__ == "__main__":
    test_embedding_refactor()
    test_matryoshka()
