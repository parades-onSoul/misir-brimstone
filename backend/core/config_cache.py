"""
SystemConfigCache — Whole-config fetch with TTL, fail-soft.

Loads all configuration from misir.system_config table.
"""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Optional

from supabase import create_client, Client
from core.config import settings

logger = logging.getLogger(__name__)


class SystemConfigCache:
    """
    Caches system_config values from database.
    
    Design principles:
    - Fetch whole config, not per-key (reduces DB calls)
    - Fail soft with sane defaults (never block ingestion)
    - TTL-based refresh (background, non-blocking)
    """
    
    # Mirror defaults from database (single source of truth)
    DEFAULTS = {
        'embedding_model': {
            'name': 'nomic-ai/nomic-embed-text-v1.5',
            'dimension': 768,
            'context_length': 8192
        },
        'vector_index_params': {
            'm': 16,
            'ef_construction': 128
        },
        'reading_depth_constants': {
            'avg_wpm': 200,
            'time_weight': 0.6,
            'scroll_weight': 0.4,
            'max_ratio': 1.5
        },
        'centroid_history_threshold': {
            'distance_threshold': 0.05,
            'min_signals_between_logs': 5
        }
    }
    
    def __init__(self, ttl_seconds: int = 60):
        self._cache: dict[str, Any] = {}
        self._last_fetch: Optional[datetime] = None
        self._ttl = timedelta(seconds=ttl_seconds)
        self._client: Optional[Client] = None
        self._refreshing = False
    
    def _get_client(self) -> Client:
        """Lazy client initialization."""
        if self._client is None:
            self._client = create_client(
                settings.SUPABASE_URL,
                settings.SUPABASE_KEY
            )
        return self._client
    
    def _is_expired(self) -> bool:
        """Check if cache needs refresh."""
        if self._last_fetch is None:
            return True
        return datetime.now() - self._last_fetch > self._ttl
    
    async def refresh(self) -> None:
        """
        Fetch all config from database.
        Fail-soft: logs error but doesn't raise.
        """
        if self._refreshing:
            return  # Prevent concurrent refreshes
        
        self._refreshing = True
        try:
            client = self._get_client()
            response = client.schema('misir').from_('system_config').select('key, value').execute()
            
            if response.data:
                self._cache = {row['key']: row['value'] for row in response.data}
                self._last_fetch = datetime.now()
                logger.info(f"SystemConfigCache refreshed: {len(self._cache)} keys")
            else:
                logger.warning("system_config returned no rows, using defaults")
                
        except Exception as e:
            logger.warning(f"Config fetch failed, using cached/defaults: {e}")
            # Don't clear cache — keep stale data over no data
        finally:
            self._refreshing = False
    
    def get(self, key: str, default: Any = None) -> Any:
        """
        Get config value by key.
        
        Priority:
        1. Cached value from DB
        2. Provided default
        3. Built-in DEFAULTS
        """
        # Trigger background refresh if expired
        if self._is_expired() and not self._refreshing:
            asyncio.create_task(self.refresh())
        
        # Return from cache or defaults
        if key in self._cache:
            return self._cache[key]
        if default is not None:
            return default
        return self.DEFAULTS.get(key)
    
    def get_embedding_dimension(self) -> int:
        """Shortcut for embedding dimension."""
        config = self.get('embedding_model', self.DEFAULTS['embedding_model'])
        return config.get('dimension', 768)
    
    def get_embedding_model_name(self) -> str:
        """Shortcut for embedding model name."""
        config = self.get('embedding_model', self.DEFAULTS['embedding_model'])
        return config.get('name', 'nomic-ai/nomic-embed-text-v1.5')
    
    def get_reading_depth_constants(self) -> dict:
        """Shortcut for reading depth formula constants."""
        return self.get('reading_depth_constants', self.DEFAULTS['reading_depth_constants'])


# Singleton instance
config_cache = SystemConfigCache()
