"""
Tests for ArtifactRepository and MarginService.

Tests:
- ArtifactRepository (RPC calls)
- MarginService (calculation logic)
"""
import pytest
from unittest.mock import Mock, AsyncMock, patch

class TestMarginService:
    """Margin calculation tests."""
    
    def test_calculate_margin(self):
        """Margin should be correctly calculated from top 2 matches."""
        from infrastructure.services.margin_service import AssignmentMarginService
        
        # Margin = (d2 - d1)
        # d1 = 0.2
        # d2 = 0.3
        # margin = 0.3 - 0.2 = 0.1
        
        # Note: logic is d2 - d1
        margin = AssignmentMarginService.calculate_margin_value(0.2, 0.3)
        assert margin == pytest.approx(0.1)
    
    def test_calculate_margin_safe_division(self):
        """Should handle d1=0."""
        from infrastructure.services.margin_service import AssignmentMarginService
        
        margin = AssignmentMarginService.calculate_margin_value(0.0, 0.1)
        assert margin == pytest.approx(0.1)
        

class TestArtifactRepository:
    """Artifact repository tests."""
    
    @pytest.fixture
    def mock_client(self):
        client = Mock()
        client.schema.return_value = client
        client.rpc.return_value = client
        client.execute.return_value = Mock(data=[])
        return client

    @pytest.mark.asyncio
    async def test_create_artifact_rpc_success(self, mock_client):
        """Should call create_artifact_with_signal RPC."""
        from infrastructure.repositories.artifact_repo import ArtifactRepository
        from domain.commands import CaptureArtifactCommand
        
        repo = ArtifactRepository(mock_client)
        
        # Mock successful RPC response
        mock_client.execute.return_value = Mock(data=[{
            'artifact_id': 1,
            'signal_id': 100,
            'is_new': True,
            'message': 'Captured'
        }])
        
        cmd = CaptureArtifactCommand(
            user_id="user-1",
            space_id=1,
            url="http://example.com/foo",
            embedding=[0.1]*768,
            reading_depth=1.0,
            scroll_depth=1.0,
            dwell_time_ms=5000,
            word_count=500,
            engagement_level="active",
            content_source="web"
        )
        
        result = await repo.ingest_with_signal(cmd)
        
        # Unwrap Result
        assert result.is_ok()
        capture_result = result.unwrap()
        
        assert capture_result.artifact_id == 1
        assert capture_result.signal_id == 100
        assert capture_result.is_new is True
        
        # Verify RPC call
        mock_client.rpc.assert_called_once()
        args, _ = mock_client.rpc.call_args
        assert args[0] == 'insert_artifact_with_signal'

    @pytest.mark.asyncio
    async def test_create_artifact_rpc_error(self, mock_client):
        """Should return Err on RPC failure."""
        from infrastructure.repositories.artifact_repo import ArtifactRepository
        from domain.commands import CaptureArtifactCommand
        
        repo = ArtifactRepository(mock_client)
        
        # Mock error
        mock_client.execute.side_effect = Exception("RPC Failed")
        
        cmd = CaptureArtifactCommand(
            user_id="user-1",
            space_id=1,
            url="http://example.com/foo",
            embedding=[0.1]*768,
            reading_depth=1.0,
            scroll_depth=1.0,
            dwell_time_ms=5000,
            word_count=500,
            engagement_level="active",
            content_source="web"
        )
        
        result = await repo.ingest_with_signal(cmd)
        
        # Should return Err, not raise exception
        assert result.is_err()
        error = result.unwrap_err()
        assert "RPC Failed" in error.message or "RPC Failed" in error.details
