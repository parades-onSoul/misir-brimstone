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
    
    # Authentication
    MOCK_AUTH: bool = True  # Set to False in production to require real JWT tokens
    MOCK_USER_ID: str = "test-user-123"  # Only used when MOCK_AUTH=True
    
    # Rate Limiting
    RATE_LIMIT_STORAGE: str = "memory"  # "memory" or "redis"
    REDIS_URL: str = "redis://localhost:6379"  # Only used when RATE_LIMIT_STORAGE=redis
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
    ]
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
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
