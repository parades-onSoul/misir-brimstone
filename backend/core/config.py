"""
Core configuration from environment variables.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
from functools import lru_cache


class Settings(BaseSettings):
    """Environment configuration."""
    
    # API
    PROJECT_NAME: str = "Misir Orientation Engine"
    VERSION: str = "1.0.0"
    CODENAME: str = "shiro.exe"
    API_V1_STR: str = "/api/v1"
    
    # Supabase
    SUPABASE_URL: str
    SUPABASE_KEY: str  # anon key for client
    SUPABASE_SERVICE_KEY: str = ""  # service role for admin ops
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
    ]
    
    # Embedding Service
    EMBEDDING_MODEL: str = "nomic-ai/nomic-embed-text-v1.5"
    
    # ConfigDict replaces deprecated class Config
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )


@lru_cache()
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()


settings = get_settings()
