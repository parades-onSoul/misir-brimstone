"""
Space Repository — CRUD operations for spaces.

Spaces are top-level containers for knowledge organization.
"""
from dataclasses import dataclass
from typing import Optional
import logging

from supabase import Client

logger = logging.getLogger(__name__)


@dataclass
class SpaceResult:
    """Result of space operation."""
    id: int
    name: str
    description: Optional[str]
    user_id: str
    artifact_count: int


class SpaceRepository:
    """
    Repository for space operations.
    
    Minimal viable set:
    - create(name, owner_id)
    - list(owner_id)
    - get_by_id(space_id)
    """
    
    def __init__(self, client: Client):
        self._client = client
    
    async def create(
        self, 
        user_id: str, 
        name: str, 
        description: Optional[str] = None
    ) -> SpaceResult:
        """
        Create a new space.
        
        Args:
            user_id: Owner user ID
            name: Space name
            description: Optional description
        
        Returns:
            SpaceResult with created space details
        """
        try:
            data = {
                'user_id': user_id,
                'name': name,
            }
            if description:
                data['description'] = description
            
            response = (
                self._client.schema('misir')
                .from_('space')
                .insert(data)
                .execute()
            )
            
            if response.data and len(response.data) > 0:
                row = response.data[0]
                return SpaceResult(
                    id=row['id'],
                    name=row['name'],
                    description=row.get('description'),
                    user_id=row['user_id'],
                    artifact_count=row.get('artifact_count', 0)
                )
            else:
                raise ValueError("Insert returned no data")
                
        except Exception as e:
            logger.error(f"Failed to create space: {e}")
            raise
    
    async def list_by_user(self, user_id: str) -> list[SpaceResult]:
        """
        List all spaces for a user.
        
        Args:
            user_id: Owner user ID
        
        Returns:
            List of SpaceResult
        """
        try:
            response = (
                self._client.schema('misir')
                .from_('space')
                .select('*')
                .eq('user_id', user_id)
                .is_('deleted_at', 'null')
                .order('created_at', desc=True)
                .execute()
            )
            
            return [
                SpaceResult(
                    id=row['id'],
                    name=row['name'],
                    description=row.get('description'),
                    user_id=row['user_id'],
                    artifact_count=row.get('artifact_count', 0)
                )
                for row in (response.data or [])
            ]
            
        except Exception as e:
            logger.error(f"Failed to list spaces: {e}")
            raise
    
    async def get_by_id(self, space_id: int, user_id: str) -> Optional[SpaceResult]:
        """
        Get space by ID (user-scoped).
        
        Args:
            space_id: Space ID
            user_id: Owner user ID (for RLS)
        
        Returns:
            SpaceResult or None if not found
        """
        try:
            response = (
                self._client.schema('misir')
                .from_('space')
                .select('*')
                .eq('id', space_id)
                .eq('user_id', user_id)
                .is_('deleted_at', 'null')
                .execute()
            )
            
            if response.data and len(response.data) > 0:
                row = response.data[0]
                return SpaceResult(
                    id=row['id'],
                    name=row['name'],
                    description=row.get('description'),
                    user_id=row['user_id'],
                    artifact_count=row.get('artifact_count', 0)
                )
            return None
            
        except Exception as e:
            logger.error(f"Failed to get space: {e}")
            raise
