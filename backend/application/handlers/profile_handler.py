"""
Profile Handler — Use cases for profile operations.

Handles:
- Get profile
- Update settings
- Mark onboarded
- Update profile metadata
"""
from dataclasses import dataclass
from typing import Optional, Dict, Any
import logging

from supabase import Client
from infrastructure.repositories.profile_repo import ProfileRepository, ProfileResult

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class GetProfileCommand:
    """Command to get user profile."""
    user_id: str
    
    def __post_init__(self):
        if not self.user_id:
            raise ValueError("user_id is required")


@dataclass(frozen=True)
class UpdateSettingsCommand:
    """Command to update user settings."""
    user_id: str
    settings: Dict[str, Any]
    
    def __post_init__(self):
        if not self.user_id:
            raise ValueError("user_id is required")
        if not isinstance(self.settings, dict):
            raise ValueError("settings must be a dictionary")


@dataclass(frozen=True)
class MarkOnboardedCommand:
    """Command to mark user as onboarded."""
    user_id: str
    
    def __post_init__(self):
        if not self.user_id:
            raise ValueError("user_id is required")


@dataclass(frozen=True)
class UpdateProfileCommand:
    """Command to update profile metadata."""
    user_id: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    timezone: Optional[str] = None
    
    def __post_init__(self):
        if not self.user_id:
            raise ValueError("user_id is required")


class ProfileHandler:
    """
    Handler for profile operations.
    
    Validates commands and delegates to repository.
    """
    
    def __init__(self, client: Client):
        self._client = client
        self._repository = ProfileRepository(client)
    
    async def get_profile(self, cmd: GetProfileCommand) -> ProfileResult:
        """
        Get user profile, creating if not exists.
        
        Args:
            cmd: GetProfileCommand with user_id
        
        Returns:
            ProfileResult
        """
        logger.info(f"Getting profile for user {cmd.user_id[:8]}...")
        result = await self._repository.create_or_get(cmd.user_id)
        logger.info(f"Profile retrieved: onboarded={result.onboarding_completed}")
        return result
    
    async def update_settings(self, cmd: UpdateSettingsCommand) -> ProfileResult:
        """
        Update user settings.
        
        Args:
            cmd: UpdateSettingsCommand with user_id and settings dict
        
        Returns:
            Updated ProfileResult
        """
        logger.info(f"Updating settings for user {cmd.user_id[:8]}: {list(cmd.settings.keys())}")
        result = await self._repository.update_settings(cmd.user_id, cmd.settings)
        logger.info(f"Settings updated successfully")
        return result
    
    async def mark_onboarded(self, cmd: MarkOnboardedCommand) -> ProfileResult:
        """
        Mark user as having completed onboarding.
        
        Args:
            cmd: MarkOnboardedCommand with user_id
        
        Returns:
            Updated ProfileResult
        """
        logger.info(f"Marking user {cmd.user_id[:8]} as onboarded")
        result = await self._repository.mark_onboarded(cmd.user_id)
        logger.info(f"User marked as onboarded at {result.onboarded_at}")
        return result
    
    async def update_profile(self, cmd: UpdateProfileCommand) -> ProfileResult:
        """
        Update profile metadata (display name, avatar, timezone).
        
        Args:
            cmd: UpdateProfileCommand with user_id and optional fields
        
        Returns:
            Updated ProfileResult
        """
        logger.info(f"Updating profile metadata for user {cmd.user_id[:8]}")
        result = await self._repository.update_profile(
            user_id=cmd.user_id,
            display_name=cmd.display_name,
            avatar_url=cmd.avatar_url,
            timezone=cmd.timezone
        )
        logger.info(f"Profile metadata updated")
        return result
