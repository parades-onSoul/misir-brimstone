"""
FastAPI Error Handlers using RFC 9457 (Problem Details for HTTP APIs).

Converts domain errors (Result pattern) to standardized HTTP responses.
"""
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi_problem.error import Problem
from pydantic import ValidationError

from core.error_types import ErrorDetail, DomainError
from core.logging_config import get_logger

logger = get_logger(__name__)


# Error type to HTTP status code mapping
ERROR_TYPE_TO_STATUS = {
    # Validation errors
    DomainError.VALIDATION_ERROR: status.HTTP_400_BAD_REQUEST,
    DomainError.INVALID_INPUT: status.HTTP_400_BAD_REQUEST,
    DomainError.INVALID_RANGE: status.HTTP_400_BAD_REQUEST,
    DomainError.INVALID_DIMENSION: status.HTTP_400_BAD_REQUEST,
    
    # Not found errors
    DomainError.NOT_FOUND: status.HTTP_404_NOT_FOUND,
    DomainError.SPACE_NOT_FOUND: status.HTTP_404_NOT_FOUND,
    DomainError.ARTIFACT_NOT_FOUND: status.HTTP_404_NOT_FOUND,
    DomainError.SUBSPACE_NOT_FOUND: status.HTTP_404_NOT_FOUND,
    DomainError.SIGNAL_NOT_FOUND: status.HTTP_404_NOT_FOUND,
    
    # Conflict errors
    DomainError.ALREADY_EXISTS: status.HTTP_409_CONFLICT,
    DomainError.CONFLICT: status.HTTP_409_CONFLICT,
    DomainError.BUSINESS_RULE_VIOLATION: status.HTTP_422_UNPROCESSABLE_CONTENT,
    
    # Authorization errors
    DomainError.UNAUTHORIZED: status.HTTP_401_UNAUTHORIZED,
    DomainError.FORBIDDEN: status.HTTP_403_FORBIDDEN,
    
    # Infrastructure errors (server errors)
    DomainError.REPOSITORY_ERROR: status.HTTP_500_INTERNAL_SERVER_ERROR,
    DomainError.DATABASE_ERROR: status.HTTP_500_INTERNAL_SERVER_ERROR,
    DomainError.EMBEDDING_SERVICE_ERROR: status.HTTP_500_INTERNAL_SERVER_ERROR,
    DomainError.EXTERNAL_SERVICE_ERROR: status.HTTP_502_BAD_GATEWAY,
    DomainError.CONFIGURATION_ERROR: status.HTTP_500_INTERNAL_SERVER_ERROR,
    DomainError.INVALID_CONFIGURATION: status.HTTP_500_INTERNAL_SERVER_ERROR,
}


def get_status_code(error_type: str) -> int:
    """Get HTTP status code for an error type."""
    return ERROR_TYPE_TO_STATUS.get(error_type, status.HTTP_500_INTERNAL_SERVER_ERROR)


def create_problem_response(error: ErrorDetail, request_path: str = None) -> Problem:
    """
    Convert ErrorDetail to RFC 9457 Problem response.
    
    Args:
        error: Domain error detail
        request_path: Optional request path for logging
        
    Returns:
        Problem response with standardized format
    """
    status_code = get_status_code(error.error_type)
    
    # Log errors at appropriate levels
    if status_code >= 500:
        logger.error(
            f"Server error: {error.message}",
            error_type=error.error_type,
            context=error.context,
            path=request_path
        )
    elif status_code >= 400:
        logger.warning(
            f"Client error: {error.message}",
            error_type=error.error_type,
            context=error.context,
            path=request_path
        )
    
    return Problem(
        status=status_code,
        title=_get_title_for_status(status_code),
        detail=error.message,
        type_=error.error_type,
        extra=error.context if error.context else None
    )


def _get_title_for_status(status_code: int) -> str:
    """Get a human-readable title for a status code."""
    titles = {
        400: "Bad Request",
        401: "Unauthorized",
        403: "Forbidden",
        404: "Not Found",
        409: "Conflict",
        422: "Unprocessable Entity",
        500: "Internal Server Error",
        502: "Bad Gateway",
    }
    return titles.get(status_code, "Error")


# Exception handlers for FastAPI

async def pydantic_validation_error_handler(request: Request, exc: ValidationError):
    """
    Handle Pydantic validation errors from request parsing.
    
    This catches errors from FastAPI's automatic request validation.
    """
    logger.warning(
        "Request validation failed",
        method=request.method,
        path=str(request.url.path),
        errors=exc.errors()
    )
    
    # Format validation errors nicely
    error_messages = []
    for error in exc.errors():
        field = " -> ".join(str(loc) for loc in error["loc"])
        message = f"{field}: {error['msg']}"
        error_messages.append(message)
    
    return Problem(
        status=status.HTTP_422_UNPROCESSABLE_CONTENT,
        title="Validation Error",
        detail="Request validation failed. Please check your input.",
        type_="validation-error",
        extra={"errors": error_messages}
    )


async def value_error_handler(request: Request, exc: ValueError):
    """
    Handle ValueError exceptions (legacy error handling).
    
    Eventually, these should be converted to Result pattern.
    """
    logger.warning(
        "ValueError raised",
        message=str(exc),
        path=str(request.url.path)
    )
    
    return Problem(
        status=status.HTTP_400_BAD_REQUEST,
        title="Bad Request",
        detail=str(exc),
        type_="value-error"
    )


async def generic_exception_handler(request: Request, exc: Exception):
    """
    Catch-all handler for unexpected exceptions.
    
    Logs the full exception details but returns a safe error to the client.
    """
    logger.exception(
        "Unhandled exception",
        exception_type=type(exc).__name__,
        method=request.method,
        path=str(request.url.path),
        exc_info=exc
    )
    
    return Problem(
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        title="Internal Server Error",
        detail="An unexpected error occurred. Please try again later.",
        type_="internal-error",
        extra={
            "exception_type": type(exc).__name__,
            # Only include exception message in development
            # In production, you might want to hide this
        }
    )
