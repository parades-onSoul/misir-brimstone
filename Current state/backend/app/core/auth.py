"""
Authentication utilities for FastAPI backend.
Separated into its own module to avoid circular imports.
"""

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client
from app.core.config import settings

oauth2_scheme = HTTPBearer(auto_error=False)

# Initialize Supabase for auth
try:
    supabase_auth = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
except Exception as e:
    print(f"[Auth] Failed to init Supabase: {e}")
    supabase_auth = None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(oauth2_scheme)
) -> dict:
    """
    Decode Bearer token and return user info.
    Extension sends: Authorization: Bearer <supabase_access_token>
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    if not supabase_auth:
        raise HTTPException(status_code=503, detail="Auth service unavailable")
    
    try:
        token = credentials.credentials
        user_response = supabase_auth.auth.get_user(token)
        
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        return {
            "id": str(user_response.user.id),
            "email": user_response.user.email,
            "user_metadata": user_response.user.user_metadata or {}
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token validation failed: {e}")
