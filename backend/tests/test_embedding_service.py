"""
Tests for EmbeddingService.

Verifies:
- Thread safety (model loads once)
- Dimension invariants
- Matryoshka truncation
- Determinism (same input → same output)
"""
import pytest
import threading
import time
from unittest.mock import Mock, patch
import numpy as np


class TestEmbeddingService:
    """Unit tests for EmbeddingService."""
    
    def test_supported_dimensions(self):
        """Verify supported dimension constants."""
        from infrastructure.services.embedding_service import EmbeddingService
        
        assert 768 in EmbeddingService.SUPPORTED_DIMS
        assert 384 in EmbeddingService.SUPPORTED_DIMS
        assert 256 in EmbeddingService.SUPPORTED_DIMS
    
    def test_invalid_dimension_raises(self):
        """Unsupported dimension should raise ValueError."""
        from infrastructure.services.embedding_service import EmbeddingService
        
        with pytest.raises(ValueError, match="Unsupported dimension"):
            EmbeddingService(default_dim=500)
    
    def test_truncate_and_normalize(self):
        """Matryoshka truncation + L2 normalization."""
        from infrastructure.services.embedding_service import EmbeddingService
        
        service = EmbeddingService.__new__(EmbeddingService)
        
        # Create test vector
        original = np.random.randn(768)
        original = original / np.linalg.norm(original)  # Normalize
        
        # Truncate to 384
        truncated = service._truncate_and_normalize(original, 384)
        
        assert len(truncated) == 384
        assert abs(np.linalg.norm(truncated) - 1.0) < 1e-6  # L2 norm = 1
    
    def test_text_hash_deterministic(self):
        """Same text should produce same hash."""
        from infrastructure.services.embedding_service import EmbeddingService
        
        service = EmbeddingService.__new__(EmbeddingService)
        
        hash1 = service._hash_text("hello world")
        hash2 = service._hash_text("hello world")
        hash3 = service._hash_text("different text")
        
        assert hash1 == hash2
        assert hash1 != hash3
    
    def test_thread_safety_model_loading(self):
        """Model should load exactly once under concurrent access."""
        from infrastructure.services.embedding_service import EmbeddingService
        
        load_count = 0
        load_lock = threading.Lock()
        
        # Mock SentenceTransformer
        class MockModel:
            def encode(self, text, **kwargs):
                return np.random.randn(768)
        
        def mock_load(*args, **kwargs):
            nonlocal load_count
            with load_lock:
                load_count += 1
            time.sleep(0.1)  # Simulate slow load
            return MockModel()
        
        with patch('sentence_transformers.SentenceTransformer', mock_load):
            service = EmbeddingService()
            
            errors = []
            
            def access_model():
                try:
                    _ = service._model
                except Exception as e:
                    errors.append(e)
            
            # Start 10 threads simultaneously
            threads = [threading.Thread(target=access_model) for _ in range(10)]
            for t in threads:
                t.start()
            for t in threads:
                t.join()
            
            assert len(errors) == 0
            assert load_count == 1  # Model loaded exactly once


class TestEmbeddingIntegration:
    """Integration tests (require model download)."""
    
    @pytest.mark.slow
    def test_embed_text_returns_correct_shape(self):
        """Embedding should return correct dimension."""
        from infrastructure.services.embedding_service import EmbeddingService
        
        service = EmbeddingService(default_dim=384)
        result = service.embed_text("Hello, world!")
        
        assert result.dimension == 384
        assert len(result.vector) == 384
        assert result.model == EmbeddingService.DEFAULT_MODEL
    
    @pytest.mark.slow
    def test_determinism(self):
        """Same text should produce same vector."""
        from infrastructure.services.embedding_service import EmbeddingService
        
        service = EmbeddingService()
        
        result1 = service.embed_text("The quick brown fox")
        result2 = service.embed_text("The quick brown fox")
        
        assert result1.vector == result2.vector
        assert result1.text_hash == result2.text_hash
    
    @pytest.mark.slow
    def test_query_vs_document_embedding(self):
        """Query and document embeddings should be different (asymmetric)."""
        from infrastructure.services.embedding_service import EmbeddingService
        
        service = EmbeddingService()
        
        text = "machine learning basics"
        doc_result = service.embed_text(text)
        query_result = service.embed_query(text)
        
        # Should be different due to different prefixes
        assert doc_result.vector != query_result.vector


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
