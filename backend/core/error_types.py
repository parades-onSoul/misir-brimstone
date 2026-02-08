"""
Domain Error Types using Result Pattern.

Result[T, E] pattern for clean error handling in the domain layer.
API layer converts these to HTTP responses using fastapi-problem.
"""
from typing import TypeVar, Generic
from result import Result, Ok, Err

# Type variables for generic Result types
T = TypeVar('T')
E = TypeVar('E')


# Domain Error Types (as strings for simplicity)
class DomainError:
    """Container for domain error types with consistent error codes."""
    
    # Validation Errors
    VALIDATION_ERROR = "validation-error"
    INVALID_INPUT = "invalid-input"
    INVALID_RANGE = "invalid-range"
    INVALID_DIMENSION = "invalid-dimension"
    
    # Business Logic Errors
    NOT_FOUND = "not-found"
    ALREADY_EXISTS = "already-exists"
    CONFLICT = "conflict"
    BUSINESS_RULE_VIOLATION = "business-rule-violation"
    
    # Domain Specific
    SPACE_NOT_FOUND = "space-not-found"
    ARTIFACT_NOT_FOUND = "artifact-not-found"
    SUBSPACE_NOT_FOUND = "subspace-not-found"
    SIGNAL_NOT_FOUND = "signal-not-found"
    
    # Authorization
    UNAUTHORIZED = "unauthorized"
    FORBIDDEN = "forbidden"
    
    # Infrastructure
    REPOSITORY_ERROR = "repository-error"
    DATABASE_ERROR = "database-error"
    EMBEDDING_SERVICE_ERROR = "embedding-service-error"
    EXTERNAL_SERVICE_ERROR = "external-service-error"
    
    # Configuration
    CONFIGURATION_ERROR = "configuration-error"
    INVALID_CONFIGURATION = "invalid-configuration"


class ErrorDetail:
    """
    Structured error detail for rich error information.
    
    Attributes:
        error_type: Machine-readable error code (from DomainError)
        message: Human-readable error message
        context: Optional dict with additional context
    """
    
    def __init__(self, error_type: str, message: str, context: dict = None):
        self.error_type = error_type
        self.message = message
        self.context = context or {}
    
    def __str__(self) -> str:
        return self.message
    
    def __repr__(self) -> str:
        return f"ErrorDetail(type='{self.error_type}', message='{self.message}')"


# Type aliases for common Result types
DomainResult = Result[T, ErrorDetail]
RepositoryResult = Result[T, ErrorDetail]
ServiceResult = Result[T, ErrorDetail]


# Common error constructors
def validation_error(message: str, **context) -> ErrorDetail:
    """Create a validation error."""
    return ErrorDetail(DomainError.VALIDATION_ERROR, message, context)


def not_found_error(resource: str, identifier: str | int, **context) -> ErrorDetail:
    """Create a not found error."""
    message = f"{resource} with identifier '{identifier}' not found"
    return ErrorDetail(DomainError.NOT_FOUND, message, {"resource": resource, "id": identifier, **context})


def conflict_error(message: str, **context) -> ErrorDetail:
    """Create a conflict error."""
    return ErrorDetail(DomainError.CONFLICT, message, context)


def repository_error(message: str, **context) -> ErrorDetail:
    """Create a repository error."""
    return ErrorDetail(DomainError.REPOSITORY_ERROR, message, context)


def embedding_service_error(message: str, **context) -> ErrorDetail:
    """Create an embedding service error."""
    return ErrorDetail(DomainError.EMBEDDING_SERVICE_ERROR, message, context)


def invalid_range_error(field: str, value: float, min_val: float, max_val: float) -> ErrorDetail:
    """Create an invalid range error."""
    message = f"{field} must be between {min_val} and {max_val}, got {value}"
    return ErrorDetail(
        DomainError.INVALID_RANGE,
        message,
        {"field": field, "value": value, "min": min_val, "max": max_val}
    )


# Convenience functions for common patterns
def success(value: T) -> Result[T, ErrorDetail]:
    """Wrap a success value in a Result."""
    return Ok(value)


def failure(error: ErrorDetail) -> Result[T, ErrorDetail]:
    """Wrap an error in a Result."""
    return Err(error)
