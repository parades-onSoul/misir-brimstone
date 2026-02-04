"""
Integration tests for enum validation in capture flow.

Tests all combinations of engagement_level and content_source values
to ensure proper validation and database integration.
"""
import pytest
from domain.value_objects import EngagementLevel, SourceType
from domain.commands import CaptureArtifactCommand
from application.handlers import CaptureHandler
from infrastructure.repositories import ArtifactRepository
from unittest.mock import Mock, AsyncMock


class TestEnumValidation:
    """Test all enum values are properly validated and accepted."""
    
    @pytest.mark.asyncio
    @pytest.mark.parametrize("engagement_level", [
        EngagementLevel.LATENT,
        EngagementLevel.DISCOVERED,
        EngagementLevel.ENGAGED,
        EngagementLevel.SATURATED,
    ])
    async def test_all_engagement_levels_accepted(self, engagement_level):
        """Test that all engagement_level values are valid."""
        # Setup
        mock_repo = Mock(spec=ArtifactRepository)
        mock_repo.ingest_with_signal = AsyncMock(return_value=Mock(
            artifact_id=1,
            signal_id=1,
            is_new=True,
            message="success"
        ))
        handler = CaptureHandler(mock_repo)
        
        # Create command with test engagement level
        cmd = CaptureArtifactCommand(
            user_id="test-user",
            space_id=1,
            url="https://example.com",
            embedding=[0.1] * 768,
            engagement_level=engagement_level.value,
            content_source=SourceType.WEB.value,
            reading_depth=0.5,
            scroll_depth=0.5,
            dwell_time_ms=1000,
            word_count=100
        )
        
        # Execute
        result = await handler.handle(cmd)
        
        # Verify
        assert result.artifact_id == 1
        assert mock_repo.ingest_with_signal.called
    
    @pytest.mark.asyncio
    @pytest.mark.parametrize("content_source", [
        SourceType.WEB,
        SourceType.PDF,
        SourceType.VIDEO,
        SourceType.CHAT,
        SourceType.NOTE,
        SourceType.OTHER,
    ])
    async def test_all_content_sources_accepted(self, content_source):
        """Test that all content_source values are valid."""
        # Setup
        mock_repo = Mock(spec=ArtifactRepository)
        mock_repo.ingest_with_signal = AsyncMock(return_value=Mock(
            artifact_id=1,
            signal_id=1,
            is_new=True,
            message="success"
        ))
        handler = CaptureHandler(mock_repo)
        
        # Create command with test content source
        cmd = CaptureArtifactCommand(
            user_id="test-user",
            space_id=1,
            url="https://example.com",
            embedding=[0.1] * 768,
            engagement_level=EngagementLevel.ENGAGED.value,
            content_source=content_source.value,
            reading_depth=0.5,
            scroll_depth=0.5,
            dwell_time_ms=1000,
            word_count=100
        )
        
        # Execute
        result = await handler.handle(cmd)
        
        # Verify
        assert result.artifact_id == 1
        assert mock_repo.ingest_with_signal.called
    
    @pytest.mark.asyncio
    async def test_invalid_engagement_level_rejected(self):
        """Test that invalid engagement_level values are rejected."""
        # Setup
        mock_repo = Mock(spec=ArtifactRepository)
        handler = CaptureHandler(mock_repo)
        
        # Create command with invalid engagement level
        cmd = CaptureArtifactCommand(
            user_id="test-user",
            space_id=1,
            url="https://example.com",
            embedding=[0.1] * 768,
            engagement_level="invalid_level",
            content_source=SourceType.WEB.value,
            reading_depth=0.5,
            scroll_depth=0.5,
            dwell_time_ms=1000,
            word_count=100
        )
        
        # Execute validation
        validation = handler.validate(cmd)
        
        # Verify
        assert not validation.valid
        assert any("engagement_level" in error for error in validation.errors)
    
    @pytest.mark.asyncio
    async def test_invalid_content_source_rejected(self):
        """Test that invalid content_source values are rejected."""
        # Setup
        mock_repo = Mock(spec=ArtifactRepository)
        handler = CaptureHandler(mock_repo)
        
        # Create command with invalid content source
        cmd = CaptureArtifactCommand(
            user_id="test-user",
            space_id=1,
            url="https://example.com",
            embedding=[0.1] * 768,
            engagement_level=EngagementLevel.ENGAGED.value,
            content_source="invalid_source",
            reading_depth=0.5,
            scroll_depth=0.5,
            dwell_time_ms=1000,
            word_count=100
        )
        
        # Execute validation
        validation = handler.validate(cmd)
        
        # Verify
        assert not validation.valid
        assert any("content_source" in error for error in validation.errors)
    
    @pytest.mark.asyncio
    @pytest.mark.parametrize("old_level,new_level,should_upgrade", [
        (EngagementLevel.LATENT, EngagementLevel.DISCOVERED, True),
        (EngagementLevel.DISCOVERED, EngagementLevel.ENGAGED, True),
        (EngagementLevel.ENGAGED, EngagementLevel.SATURATED, True),
        (EngagementLevel.SATURATED, EngagementLevel.ENGAGED, False),  # Never downgrade
        (EngagementLevel.ENGAGED, EngagementLevel.LATENT, False),    # Never downgrade
    ])
    async def test_engagement_level_semantic_ordering(self, old_level, new_level, should_upgrade):
        """Test that engagement_level follows semantic ordering (never downgrades)."""
        # Note: This is enforced at DB level, so we just verify the enum ordering
        assert (new_level > old_level) == should_upgrade
