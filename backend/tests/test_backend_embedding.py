
import pytest
from unittest.mock import Mock, patch, AsyncMock
from result import Ok
from interfaces.api.capture import CaptureRequest
from application.handlers import CaptureHandler
from infrastructure.repositories import CaptureResult
from infrastructure.services.embedding_service import EmbeddingService, EmbeddingResult

@pytest.fixture
def mock_embedding_service():
    with patch('interfaces.api.capture.get_embedding_service') as mock_factory:
        service_instance = Mock(spec=EmbeddingService)
        # return dummy vector
        service_instance.embed_text.return_value = EmbeddingResult(
            vector=[0.1] * 768,
            dimension=768,
            model='test',
            text_hash='abc'
        )
        mock_factory.return_value = service_instance
        yield service_instance

@pytest.fixture
def mock_handler():
    handler = Mock(spec=CaptureHandler)
    handler.handle = AsyncMock()
    handler.handle.return_value = Ok(CaptureResult(
        artifact_id=1,
        signal_id=2,
        is_new=True,
        message="Captured"
    ))
    return handler

@pytest.fixture
def mock_limiter():
    with patch('interfaces.api.capture.limiter.limit') as mock_limit:
        # Mock the decorator to do nothing
        mock_limit.return_value = lambda f: f
        yield mock_limit

@pytest.fixture 
def mock_current_user():
    with patch('interfaces.api.capture.get_current_user') as mock_user:
        mock_user.return_value = "user1"
        yield mock_user

@pytest.mark.asyncio
async def test_capture_with_generated_embedding(mock_handler, mock_embedding_service, mock_limiter, mock_current_user):
    # Import the function after mocking the limiter
    from interfaces.api.capture import capture_artifact
    from fastapi import Request
    
    # Mock request object
    request = Mock(spec=Request)
    
    # Request without embedding but with content
    body = CaptureRequest(
        space_id=1,
        url="http://example.com",
        content="This is some content to embed",
        title="Page Title",
        embedding=None, # Missing
        reading_depth=1.0,
        scroll_depth=1.0,
        dwell_time_ms=5000,
        word_count=500,
        engagement_level="engaged",
        content_source="web"
    )
    
    response = await capture_artifact(request, body, current_user_id="user1", handler=mock_handler)
    
    # 1. Verify embedding service was called
    mock_embedding_service.embed_text.assert_called_with("This is some content to embed")
    
    # 2. Verify handler was called with generated embedding
    assert mock_handler.handle.call_count == 1
    cmd = mock_handler.handle.call_args[0][0]
    assert cmd.embedding == [0.1] * 768
    assert cmd.url == "http://example.com"

@pytest.mark.asyncio
async def test_capture_missing_embedding_and_content(mock_handler, mock_limiter, mock_current_user):
    # Import the function after mocking the limiter
    from interfaces.api.capture import capture_artifact
    from fastapi import Request
    from rfc9457 import Problem
    
    # Mock request object
    request = Mock(spec=Request)
    
    # Request without embedding AND without content
    body = CaptureRequest(
        space_id=1,
        url="http://example.com",
        embedding=None,
        content=None,
        title=None,
        reading_depth=1.0,
        scroll_depth=1.0,
        dwell_time_ms=5000,
        word_count=500
    )
    
    with pytest.raises(Problem) as excinfo:
        await capture_artifact(request, body, current_user_id="user1", handler=mock_handler)
    
    assert excinfo.value.status == 400
    assert "Either 'embedding' or 'content'/'title' must be provided" in excinfo.value.detail

@pytest.mark.asyncio
async def test_capture_with_provided_embedding(mock_handler, mock_embedding_service, mock_limiter, mock_current_user):
    # Import the function after mocking the limiter
    from interfaces.api.capture import capture_artifact
    from fastapi import Request
    
    # Mock request object
    request = Mock(spec=Request)
    
    # Request WITH embedding
    provided_embedding = [0.9] * 768
    body = CaptureRequest(
        space_id=1,
        url="http://example.com",
        embedding=provided_embedding,
        content="Ignored content",
        reading_depth=1.0,
        scroll_depth=1.0,
        dwell_time_ms=5000,
        word_count=500
    )

    await capture_artifact(request, body, current_user_id="user1", handler=mock_handler)

    # 1. Verify embedding service was NOT called since embedding was provided
    mock_embedding_service.embed_text.assert_not_called()

    # 2. Verify handler was called with provided embedding
    assert mock_handler.handle.call_count == 1
    cmd = mock_handler.handle.call_args[0][0]
    assert cmd.embedding == provided_embedding
    assert cmd.url == "http://example.com"
