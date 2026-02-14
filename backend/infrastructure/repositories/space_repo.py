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
    - delete(space_id, owner_id)
    """
    
    def __init__(self, client: Client):
        self._client = client
    
    async def create(
        self, 
        user_id: str, 
        name: str, 
        description: Optional[str] = None,
        embedding: Optional[list[float]] = None
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
            if embedding:
                data['embedding'] = embedding
            
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
                # No soft-delete column in schema; return all user spaces
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

    async def delete(self, space_id: int, user_id: str) -> bool:
        """Delete a space for a user.

        Returns True if a row was deleted, False otherwise.
        """
        try:
            response = (
                self._client.schema('misir')
                .from_('space')
                .delete()
                .eq('id', space_id)
                .eq('user_id', user_id)
                .execute()
            )

            # Supabase returns deleted rows when `returning` default; treat presence as success
            return bool(response.data)
        except Exception as e:
            logger.error(f"Failed to delete space: {e}")
            raise

    async def update(
        self,
        space_id: int,
        user_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Optional[SpaceResult]:
        """Update mutable fields of a space and return updated row."""
        try:
            data = {}
            if name is not None:
                data["name"] = name
            if description is not None:
                data["description"] = description

            if not data:
                return await self.get_by_id(space_id, user_id)

            response = (
                self._client.schema('misir')
                .from_('space')
                .update(data)
                .eq('id', space_id)
                .eq('user_id', user_id)
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
            logger.error(f"Failed to update space: {e}")
            raise
