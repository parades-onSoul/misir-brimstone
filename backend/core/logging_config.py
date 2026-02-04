"""
Structured logging configuration using structlog.

Provides JSON-formatted logs with request context, suitable for production.
"""
import logging
import structlog
from typing import Any, Dict


def configure_logging(log_level: str = "INFO") -> None:
    """
    Configure structlog for JSON-formatted logging.
    
    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    """
    # Set up standard logging
    logging.basicConfig(
        format="%(message)s",
        level=getattr(logging, log_level.upper()),
    )
    
    # Configure structlog processors
    structlog.configure(
        processors=[
            # Add log level
            structlog.stdlib.add_log_level,
            # Add timestamp
            structlog.processors.TimeStamper(fmt="iso"),
            # Stack info for exceptions
            structlog.processors.StackInfoRenderer(),
            # Format exceptions
            structlog.processors.format_exc_info,
            # Render as JSON
            structlog.processors.JSONRenderer()
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """
    Get a structured logger instance.
    
    Args:
        name: Logger name (typically __name__)
        
    Returns:
        Structured logger instance
    """
    return structlog.get_logger(name)


# Context manager for adding request context
class RequestContext:
    """Context manager for adding request-specific fields to logs."""
    
    def __init__(self, request_id: str, **kwargs: Any):
        self.request_id = request_id
        self.context = kwargs
    
    def __enter__(self) -> None:
        structlog.threadlocal.bind_threadlocal(
            request_id=self.request_id,
            **self.context
        )
    
    def __exit__(self, *args: Any) -> None:
        structlog.threadlocal.clear_threadlocal()
