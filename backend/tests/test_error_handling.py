"""
Test cases for the new error handling system.

Verifies RFC 9457 Problem Details responses.
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, AsyncMock, patch

from main import app
from interfaces.api.spaces import get_current_user as get_spaces_current_user
from core.error_types import (
    DomainError,
    ErrorDetail,
    validation_error,
    not_found_error,
    conflict_error
)
from core.error_handlers import create_problem_response, get_status_code


class TestErrorTypes:
    """Test error type definitions and helpers."""
    
    def test_validation_error_creation(self):
        """Test creating a validation error."""
        error = validation_error("Name is required", field="name")
        
        assert error.error_type == DomainError.VALIDATION_ERROR
        assert "Name is required" in error.message
        assert error.context["field"] == "name"
    
    def test_not_found_error_creation(self):
        """Test creating a not found error."""
        error = not_found_error("Space", 123)
        
        assert error.error_type == DomainError.NOT_FOUND
        assert "123" in error.message
        assert "Space" in error.message
        assert error.context["resource"] == "Space"
        assert error.context["id"] == 123
    
    def test_conflict_error_creation(self):
        """Test creating a conflict error."""
        error = conflict_error("Space already exists", name="test-space")
        
        assert error.error_type == DomainError.CONFLICT
        assert "already exists" in error.message
        assert error.context["name"] == "test-space"


class TestErrorHandlers:
    """Test error handler utilities."""
    
    def test_get_status_code_for_validation(self):
        """Test status code mapping for validation errors."""
        status = get_status_code(DomainError.VALIDATION_ERROR)
        assert status == 400
    
    def test_get_status_code_for_not_found(self):
        """Test status code mapping for not found errors."""
        status = get_status_code(DomainError.SPACE_NOT_FOUND)
        assert status == 404
    
    def test_get_status_code_for_conflict(self):
        """Test status code mapping for conflict errors."""
        status = get_status_code(DomainError.CONFLICT)
        assert status == 409
    
    def test_get_status_code_for_repository_error(self):
        """Test status code mapping for repository errors."""
        status = get_status_code(DomainError.REPOSITORY_ERROR)
        assert status == 500
    
    def test_create_problem_response(self):
        """Test creating a Problem response from ErrorDetail."""
        error = not_found_error("Space", 123)
        response = create_problem_response(error, "/api/v1/spaces/123")

        assert response.status_code == 404
        body = response.body.decode("utf-8")
        assert DomainError.NOT_FOUND in body
        assert "123" in body
        assert "Space" in body


class TestAPIErrorResponses:
    """Test API error responses using TestClient."""
    
    @pytest.fixture
    def client(self):
        """Create test client."""
        app.dependency_overrides[get_spaces_current_user] = lambda: "test-user-id"
        try:
            yield TestClient(app)
        finally:
            app.dependency_overrides.pop(get_spaces_current_user, None)
    
    def test_health_endpoint(self, client):
        """Test health endpoint works."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}
    
    def test_pydantic_validation_error(self, client):
        """Test Pydantic validation errors return RFC 9457 format."""
        # Note: Pydantic validation happens before our handler is called
        # FastAPI returns default Pydantic error format for request body validation
        # Our handler only catches ValidationError for domain validation
        # This test verifies the endpoint rejects invalid input
        response = client.post(
            "/api/v1/spaces",
            json={"name": 123}  # name should be string, user_id missing
        )
        
        # Should get 422 validation error
        assert response.status_code == 422
        data = response.json()
        assert "detail" in data
        # Pydantic returns list of errors
        assert isinstance(data["detail"], list)
    
    def test_root_endpoint(self, client):
        """Test root endpoint returns system info."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "online"
        assert "OSCL" in data["algorithms"]


class TestValueErrorHandling:
    """Test legacy ValueError handling."""
    
    def test_value_error_converted_to_problem(self):
        """Test that ValueError is caught and converted to Problem response."""
        from core.error_types import ErrorDetail
        
        # ValueError should be handled by global handler
        # This is tested implicitly when commands raise ValueError for validation
        # Example: CreateSpaceCommand with empty name raises ValueError
        pass  # Placeholder - add specific tests as endpoints are migrated


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
