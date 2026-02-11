"""
Profile Repository — CRUD operations for user profiles.

Manages user preferences, onboarding status, and settings.
"""
from dataclasses import dataclass
from typing import Optional, Dict, Any
import logging
from datetime import datetime, timezone

from supabase import Client

logger = logging.getLogger(__name__)


@dataclass
class ProfileResult:
    """Result of profile operation."""
    id: str
    display_name: Optional[str]
    avatar_url: Optional[str]
    timezone: str
    onboarding_completed: bool
    onboarded_at: Optional[datetime]
    settings: Dict[str, Any]
    created_at: datetime
    updated_at: datetime


class ProfileRepository:
    """
    Repository for profile operations.
    
    Operations:
    - get_by_user_id(user_id)
    - create_or_get(user_id)
    - update_settings(user_id, settings)
    - mark_onboarded(user_id)
    - update_profile(user_id, display_name, avatar_url, timezone)
    """
    
    def __init__(self, client: Client):
        self._client = client
    
    async def get_by_user_id(self, user_id: str) -> Optional[ProfileResult]:
        """
        Get profile by user ID.
        
        Args:
            user_id: User UUID
        
        Returns:
            ProfileResult or None if not found
        """
        try:
            response = (
                self._client.schema('misir')
                .from_('profile')
                .select('*')
                .eq('id', user_id)
                .execute()
            )
            
            if response.data and len(response.data) > 0:
                row = response.data[0]
                return self._map_to_result(row)
            
            return None
                
        except Exception as e:
            logger.error(f"Failed to get profile for user {user_id[:8]}: {e}")
            raise
    
    async def create_or_get(self, user_id: str) -> ProfileResult:
        """
        Create profile if it doesn't exist, or return existing.
        
        Args:
            user_id: User UUID
        
        Returns:
            ProfileResult
        """
        try:
            # Try to get existing
            existing = await self.get_by_user_id(user_id)
            if existing:
                return existing
            
            # Create new profile with defaults
            data = {
                'id': user_id,
                'timezone': 'UTC',
                'onboarding_completed': False,
                'settings': {}
            }
            
            response = (
                self._client.schema('misir')
                .from_('profile')
                .insert(data)
                .execute()
            )
            
            if response.data and len(response.data) > 0:
                return self._map_to_result(response.data[0])
            else:
                raise ValueError("Insert returned no data")
                
        except Exception as e:
            logger.error(f"Failed to create/get profile: {e}")
            raise
    
    async def update_settings(self, user_id: str, settings: Dict[str, Any]) -> ProfileResult:
        """
        Update profile settings (merges with existing).
        
        Args:
            user_id: User UUID
            settings: Dict of settings to merge
        
        Returns:
            Updated ProfileResult
        """
        try:
            # First ensure profile exists
            await self.create_or_get(user_id)
            
            # Update settings (PostgreSQL JSONB merge)
            response = (
                self._client.schema('misir')
                .from_('profile')
                .update({
                    'settings': settings,
                    'updated_at': datetime.now(timezone.utc).isoformat()
                })
                .eq('id', user_id)
                .execute()
            )
            
            if response.data and len(response.data) > 0:
                return self._map_to_result(response.data[0])
            else:
                raise ValueError("Update returned no data")
                
        except Exception as e:
            logger.error(f"Failed to update settings: {e}")
            raise
    
    async def mark_onboarded(self, user_id: str) -> ProfileResult:
        """
        Mark user as having completed onboarding.
        
        Args:
            user_id: User UUID
        
        Returns:
            Updated ProfileResult
        """
        try:
            # First ensure profile exists
            await self.create_or_get(user_id)
            
            response = (
                self._client.schema('misir')
                .from_('profile')
                .update({
                    'onboarding_completed': True,
                    'onboarded_at': datetime.now(timezone.utc).isoformat(),
                    'updated_at': datetime.now(timezone.utc).isoformat()
                })
                .eq('id', user_id)
                .execute()
            )
            
            if response.data and len(response.data) > 0:
                return self._map_to_result(response.data[0])
            else:
                raise ValueError("Update returned no data")
                
        except Exception as e:
            logger.error(f"Failed to mark onboarded: {e}")
            raise
    
    async def update_profile(
        self, 
        user_id: str,
        display_name: Optional[str] = None,
        avatar_url: Optional[str] = None,
        timezone: Optional[str] = None
    ) -> ProfileResult:
        """
        Update profile metadata.
        
        Args:
            user_id: User UUID
            display_name: Optional new display name
            avatar_url: Optional new avatar URL
            timezone: Optional new timezone
        
        Returns:
            Updated ProfileResult
        """
        try:
            # First ensure profile exists
            await self.create_or_get(user_id)
            
            # Build update data
            update_data = {'updated_at': datetime.now(timezone.utc).isoformat()}
            if display_name is not None:
                update_data['display_name'] = display_name
            if avatar_url is not None:
                update_data['avatar_url'] = avatar_url
            if timezone is not None:
                update_data['timezone'] = timezone
            
            response = (
                self._client.schema('misir')
                .from_('profile')
                .update(update_data)
                .eq('id', user_id)
                .execute()
            )
            
            if response.data and len(response.data) > 0:
                return self._map_to_result(response.data[0])
            else:
                raise ValueError("Update returned no data")
                
        except Exception as e:
            logger.error(f"Failed to update profile: {e}")
            raise
    
    @staticmethod
    def _map_to_result(row: Dict[str, Any]) -> ProfileResult:
        """Map database row to ProfileResult."""
        return ProfileResult(
            id=row['id'],
            display_name=row.get('display_name'),
            avatar_url=row.get('avatar_url'),
            timezone=row.get('timezone', 'UTC'),
            onboarding_completed=row.get('onboarding_completed', False),
            onboarded_at=datetime.fromisoformat(row['onboarded_at']) if row.get('onboarded_at') else None,
            settings=row.get('settings', {}),
            created_at=datetime.fromisoformat(row['created_at']),
            updated_at=datetime.fromisoformat(row['updated_at'])
        )
