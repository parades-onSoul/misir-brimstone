"""
Rate limiter configuration.

Uses slowapi (limits) to provide per-IP/user rate limiting.
Supports memory (default) or Redis storage for horizontal scaling.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from core.config import get_settings
import logging

logger = logging.getLogger(__name__)


def _get_limiter() -> Limiter:
    """
    Create rate limiter with appropriate storage backend.
    
    Uses RATE_LIMIT_STORAGE config:
    - "memory": In-memory storage (single instance only)
    - "redis": Redis storage (for horizontal scaling)
    """
    settings = get_settings()
    
    if settings.RATE_LIMIT_STORAGE == "redis":
        try:
            from slowapi.middleware import SlowAPIMiddleware
            # Redis URI format: redis://[[username]:[password]@]host[:port][/database]
            storage_uri = settings.REDIS_URL
            logger.info(f"Rate limiter using Redis: {storage_uri.split('@')[-1]}")
            return Limiter(
                key_func=get_remote_address,
                storage_uri=storage_uri
            )
        except ImportError:
            logger.warning("Redis not available, falling back to memory storage")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}, falling back to memory storage")
    
    # Default: in-memory storage
    logger.info("Rate limiter using in-memory storage")
    return Limiter(key_func=get_remote_address)


# Initialize limiter
limiter = _get_limiter()
