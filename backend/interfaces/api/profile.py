"""
Profile API — Endpoints for user profile management.

Endpoints:
- GET /profile — Get current user's profile
- PATCH /profile — Update user settings
- POST /profile/onboard — Mark onboarding complete

Uses RFC 9457 Problem Details for standardized error responses.
"""
from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi_problem.error import Problem
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

from supabase import create_client, Client
from core.config import get_settings
from core.logging_config import get_logger
from application.handlers.profile_handler import (
    ProfileHandler,
    GetProfileCommand,
    UpdateSettingsCommand,
    MarkOnboardedCommand,
    UpdateProfileCommand
)

logger = get_logger(__name__)
router = APIRouter(prefix="/profile", tags=["profile"])


# Request/Response models
class ProfileResponse(BaseModel):
    """Profile response."""
    id: str
    display_name: Optional[str]
    avatar_url: Optional[str]
    timezone: str
    onboarding_completed: bool
    onboarded_at: Optional[datetime]
    settings: Dict[str, Any]
    created_at: datetime
    updated_at: datetime


class UpdateSettingsRequest(BaseModel):
    """Request to update settings."""
    settings: Dict[str, Any]


class UpdateProfileRequest(BaseModel):
    """Request to update profile metadata."""
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    timezone: Optional[str] = None


# Dependency for Supabase client
def get_supabase() -> Client:
    """Get Supabase client."""
    settings = get_settings()
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)


def get_current_user(
    authorization: str = Header(None),
    client: Client = Depends(get_supabase)
) -> str:
    """Extract user_id from Bearer JWT token."""
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="Authorization header required")

        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization format")

        token = authorization.split(" ")[1]
        user = client.auth.get_user(token)
        if not user or not user.user:
            raise HTTPException(status_code=401, detail="Invalid token")

        return user.user.id
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {e}")


@router.get("", response_model=ProfileResponse)
async def get_profile(
    current_user_id: str = Depends(get_current_user),
    client: Client = Depends(get_supabase)
):
    """
    Get user profile.
    
    Creates profile with defaults if it doesn't exist.
    """
    try:
        handler = ProfileHandler(client)
        cmd = GetProfileCommand(user_id=current_user_id)
        result = await handler.get_profile(cmd)
        
        return ProfileResponse(
            id=result.id,
            display_name=result.display_name,
            avatar_url=result.avatar_url,
            timezone=result.timezone,
            onboarding_completed=result.onboarding_completed,
            onboarded_at=result.onboarded_at,
            settings=result.settings,
            created_at=result.created_at,
            updated_at=result.updated_at
        )
    except ValueError as e:
        raise Problem(status=400, title="Bad Request", detail=str(e))
    except Exception as e:
        logger.error(f"Failed to get profile: {e}", exc_info=True)
        raise Problem(status=500, title="Internal Server Error", detail="Failed to get profile")


@router.patch("", response_model=ProfileResponse)
async def update_settings(
    request: UpdateSettingsRequest,
    current_user_id: str = Depends(get_current_user),
    client: Client = Depends(get_supabase)
):
    """
    Update user settings.
    
    Settings are merged with existing settings (not replaced).
    Common settings:
    - theme: "light" | "dark" | "auto"
    - density: "comfortable" | "compact" | "cozy"
    - notifications_enabled: boolean
    - retention_days: number
    """
    try:
        handler = ProfileHandler(client)
        cmd = UpdateSettingsCommand(user_id=current_user_id, settings=request.settings)
        result = await handler.update_settings(cmd)
        
        return ProfileResponse(
            id=result.id,
            display_name=result.display_name,
            avatar_url=result.avatar_url,
            timezone=result.timezone,
            onboarding_completed=result.onboarding_completed,
            onboarded_at=result.onboarded_at,
            settings=result.settings,
            created_at=result.created_at,
            updated_at=result.updated_at
        )
    except ValueError as e:
        raise Problem(status=400, title="Bad Request", detail=str(e))
    except Exception as e:
        logger.error(f"Failed to update settings: {e}", exc_info=True)
        raise Problem(status=500, title="Internal Server Error", detail="Failed to update settings")


@router.post("/onboard", response_model=ProfileResponse)
async def mark_onboarded(
    current_user_id: str = Depends(get_current_user),
    client: Client = Depends(get_supabase)
):
    """
    Mark user as having completed onboarding.
    
    Sets onboarding_completed=true and records timestamp.
    Called after user creates their first space.
    """
    try:
        handler = ProfileHandler(client)
        cmd = MarkOnboardedCommand(user_id=current_user_id)
        result = await handler.mark_onboarded(cmd)
        
        return ProfileResponse(
            id=result.id,
            display_name=result.display_name,
            avatar_url=result.avatar_url,
            timezone=result.timezone,
            onboarding_completed=result.onboarding_completed,
            onboarded_at=result.onboarded_at,
            settings=result.settings,
            created_at=result.created_at,
            updated_at=result.updated_at
        )
    except ValueError as e:
        raise Problem(status=400, title="Bad Request", detail=str(e))
    except Exception as e:
        logger.error(f"Failed to mark onboarded: {e}", exc_info=True)
        raise Problem(status=500, title="Internal Server Error", detail="Failed to mark onboarded")


@router.patch("/metadata", response_model=ProfileResponse)
async def update_profile_metadata(
    request: UpdateProfileRequest,
    current_user_id: str = Depends(get_current_user),
    client: Client = Depends(get_supabase)
):
    """
    Update profile metadata (display name, avatar, timezone).
    
    Only updates provided fields; others remain unchanged.
    """
    try:
        handler = ProfileHandler(client)
        cmd = UpdateProfileCommand(
            user_id=current_user_id,
            display_name=request.display_name,
            avatar_url=request.avatar_url,
            timezone=request.timezone
        )
        result = await handler.update_profile(cmd)
        
        return ProfileResponse(
            id=result.id,
            display_name=result.display_name,
            avatar_url=result.avatar_url,
            timezone=result.timezone,
            onboarding_completed=result.onboarding_completed,
            onboarded_at=result.onboarded_at,
            settings=result.settings,
            created_at=result.created_at,
            updated_at=result.updated_at
        )
    except ValueError as e:
        raise Problem(status=400, title="Bad Request", detail=str(e))
    except Exception as e:
        logger.error(f"Failed to update profile metadata: {e}", exc_info=True)
        raise Problem(status=500, title="Internal Server Error", detail="Failed to update profile metadata")
