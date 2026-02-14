"""
Base Repository — Supabase client wrapper.
"""
from supabase import create_client, Client
from core.config import settings


def get_supabase_client() -> Client:
    """Create Supabase client instance for server-side repository operations."""
    return create_client(
        settings.SUPABASE_URL,
        # Server-side writes must use service role to avoid RLS blocking backend RPCs.
        settings.SUPABASE_SERVICE_KEY or settings.SUPABASE_KEY
    )


class BaseRepository:
    """Base repository with shared Supabase client."""
    
    def __init__(self, client: Client = None):
        self._client = client or get_supabase_client()
    
    @property
    def client(self) -> Client:
        return self._client
