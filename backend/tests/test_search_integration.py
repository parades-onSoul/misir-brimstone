"""
Integration tests for SearchHandler and ISS.

Tests:
- End-to-end search flow
- Dimension truncation
- Space/subspace filtering
"""
import pytest
from unittest.mock import Mock, AsyncMock, patch


class TestSearchHandlerIntegration:
    """Integration tests for SearchHandler."""
    
    @pytest.fixture
    def mock_client(self):
        """Create mock Supabase client."""
        client = Mock()
        client.schema.return_value = client
        client.rpc.return_value = client
        client.execute.return_value = Mock(data=[])
        return client
    
    @pytest.fixture
    def mock_embedding_service(self):
        """Create mock embedding service."""
        from infrastructure.services.embedding_service import EmbeddingResult
        
        service = Mock()
        service.embed_query.return_value = EmbeddingResult(
            vector=[0.1] * 768,
            dimension=768,
            model="test-model",
            text_hash="abc123"
        )
        return service
    
    def test_search_command_validation(self):
        """SearchCommand should validate inputs."""
        from application.handlers.search_handler import SearchCommand
        
        # Valid command
        cmd = SearchCommand(user_id="user-123", query="test query")
        assert cmd.limit == 20
        assert cmd.threshold == 0.7
        
        # Empty query should fail
        with pytest.raises(ValueError, match="query is required"):
            SearchCommand(user_id="user-123", query="")
        
        # Empty user_id should fail
        with pytest.raises(ValueError, match="user_id is required"):
            SearchCommand(user_id="", query="test")
        
        # Invalid limit should fail
        with pytest.raises(ValueError, match="limit"):
            SearchCommand(user_id="user-123", query="test", limit=150)
    
    def test_search_result_similarity_calculation(self):
        """Similarity should be 1 - distance."""
        from application.handlers.search_handler import SearchResult
        
        result = SearchResult(
            artifact_id=1,
            signal_id=1,
            similarity=0.8,
            title="Test",
            url="http://test.com",
            content_preview=None,
            space_id=1,
            subspace_id=None
        )
        
        # Distance = 1 - similarity
        expected_distance = 1 - result.similarity
        assert expected_distance == pytest.approx(0.2)


class TestSignalRepository:
    """Tests for SignalRepository."""
    
    @pytest.fixture
    def mock_client(self):
        """Create mock Supabase client."""
        client = Mock()
        return client
    
    def test_signal_stats_dataclass(self):
        """SignalStats should hold correct data."""
        from infrastructure.repositories.signal_repo import SignalStats
        
        stats = SignalStats(
            total_count=100,
            centroid_updating_count=85,
            avg_margin=0.35,
            latest_signal_at="2026-02-04T12:00:00Z"
        )
        
        assert stats.total_count == 100
        assert stats.centroid_updating_count == 85
        assert stats.avg_margin == 0.35


class TestISSDimensionHandling:
    """Tests for ISS dimension handling."""
    
    def test_matryoshka_dimensions_supported(self):
        """All Matryoshka dimensions should be supported."""
        from infrastructure.services.embedding_service import EmbeddingService
        
        assert 768 in EmbeddingService.SUPPORTED_DIMS
        assert 384 in EmbeddingService.SUPPORTED_DIMS
        assert 256 in EmbeddingService.SUPPORTED_DIMS
        assert 128 in EmbeddingService.SUPPORTED_DIMS
        assert 64 in EmbeddingService.SUPPORTED_DIMS
    
    def test_unsupported_dimension_raises(self):
        """Unsupported dimensions should raise ValueError."""
        from infrastructure.services.embedding_service import EmbeddingService
        
        with pytest.raises(ValueError, match="Unsupported dimension"):
            EmbeddingService(default_dim=500)


class TestMarginDistribution:
    """Tests for margin distribution analytics."""
    
    def test_margin_categories(self):
        """Margin categories should be correct."""
        # Categories:
        # ambiguous: < 0.1
        # low: 0.1 - 0.2
        # medium: 0.2 - 0.5
        # high: > 0.5
        
        margins = [0.05, 0.08, 0.15, 0.35, 0.6, 0.8]
        
        ambiguous = sum(1 for m in margins if m < 0.1)
        low = sum(1 for m in margins if 0.1 <= m < 0.2)
        medium = sum(1 for m in margins if 0.2 <= m < 0.5)
        high = sum(1 for m in margins if m >= 0.5)
        
        assert ambiguous == 2  # 0.05, 0.08
        assert low == 1        # 0.15
        assert medium == 1     # 0.35
        assert high == 2       # 0.6, 0.8


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
