
import pytest
from unittest.mock import Mock, patch
import numpy as np
from infrastructure.services.embedding_service import EmbeddingService

@pytest.fixture
def mock_sentence_transformer():
    with patch('sentence_transformers.SentenceTransformer') as mock_class:
        mock_instance = Mock()
        # Mock encode to return a numpy array
        mock_instance.encode.return_value = np.zeros(768)
        mock_class.return_value = mock_instance
        yield mock_instance

def test_embedding_service_caching(mock_sentence_transformer):
    service = EmbeddingService(model_name="test-model")
    
    # 1. First call - should hit the model
    result1 = service.embed_text("hello world")
    mock_sentence_transformer.encode.assert_called_once()
    assert result1.vector is not None
    
    # Reset mock to track next calls
    mock_sentence_transformer.encode.reset_mock()
    
    # 2. Second call (same text) - should NOT hit the model
    result2 = service.embed_text("hello world")
    mock_sentence_transformer.encode.assert_not_called()
    assert result2.vector == result1.vector
    
    # 3. Different text - should hit the model
    service.embed_text("different")
    mock_sentence_transformer.encode.assert_called_once()

def test_query_caching(mock_sentence_transformer):
    service = EmbeddingService(model_name="test-model")
    
    # Query caching
    q1 = service.embed_query("what is misir?")
    mock_sentence_transformer.encode.assert_called_once()
    
    mock_sentence_transformer.encode.reset_mock()
    
    q2 = service.embed_query("what is misir?")
    mock_sentence_transformer.encode.assert_not_called()
    assert q1.vector == q2.vector
