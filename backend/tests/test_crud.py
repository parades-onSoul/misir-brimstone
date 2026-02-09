"""
Unit tests for Artifact CRUD operations.
"""
import pytest
from unittest.mock import Mock, AsyncMock
from domain.commands import UpdateArtifactCommand, DeleteArtifactCommand
from application.handlers.artifact_handler import ArtifactHandler
from infrastructure.repositories import ArtifactRepository

class TestArtifactCRUD:
    @pytest.mark.asyncio
    async def test_update_artifact(self):
        """Test artifact update delegation."""
        # Setup
        mock_repo = Mock(spec=ArtifactRepository)
        mock_repo.update_artifact = AsyncMock(return_value=True)
        handler = ArtifactHandler(mock_repo)
        
        cmd = UpdateArtifactCommand(
            artifact_id=1,
            user_id="test-user",
            title="New Title",
            content="New Content"
        )
        
        # Execute
        result = await handler.update(cmd)
        
        # Verify
        assert result is True
        mock_repo.update_artifact.assert_called_once_with(cmd)

    @pytest.mark.asyncio
    async def test_delete_artifact(self):
        """Test artifact deletion delegation."""
        # Setup
        mock_repo = Mock(spec=ArtifactRepository)
        mock_repo.delete_artifact = AsyncMock(return_value=True)
        handler = ArtifactHandler(mock_repo)
        
        cmd = DeleteArtifactCommand(
            artifact_id=1,
            user_id="test-user"
        )
        
        # Execute
        result = await handler.delete(cmd)
        
        # Verify
        assert result is True
        mock_repo.delete_artifact.assert_called_once_with(1, "test-user")

    @pytest.mark.asyncio
    async def test_update_artifact_validation(self):
        """Test validation in UpdateArtifactCommand."""
        # Invalid reading depth
        with pytest.raises(ValueError, match="reading_depth"):
            UpdateArtifactCommand(
                artifact_id=1,
                user_id="user",
                reading_depth=2.0 # Invalid
            )
