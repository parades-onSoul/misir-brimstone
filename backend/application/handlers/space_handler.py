"""
Space Handler — Use cases for space operations.

Handles:
- Create space
- List spaces
- Delete space
"""
from dataclasses import dataclass
from typing import Optional
import logging

from supabase import Client
from infrastructure.repositories.space_repo import SpaceRepository, SpaceResult

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CreateSpaceCommand:
    """Command to create a new space."""
    user_id: str
    name: str
    description: Optional[str] = None
    
    def __post_init__(self):
        if not self.user_id:
            raise ValueError("user_id is required")
        if not self.name or not self.name.strip():
            raise ValueError("name is required and cannot be empty")


@dataclass(frozen=True)
class ListSpacesCommand:
    """Command to list spaces for a user."""
    user_id: str
    
    def __post_init__(self):
        if not self.user_id:
            raise ValueError("user_id is required")


class SpaceHandler:
    """
    Handler for space operations.
    
    Validates commands and delegates to repository.
    """
    
    def __init__(self, client: Client):
        self._repository = SpaceRepository(client)
    
    async def create(self, cmd: CreateSpaceCommand) -> SpaceResult:
        """
        Create a new space.
        
        Args:
            cmd: CreateSpaceCommand with user_id and name
        
        Returns:
            SpaceResult with created space
        """
        logger.info(f"Creating space '{cmd.name}' for user {cmd.user_id[:8]}...")
        
        result = await self._repository.create(
            user_id=cmd.user_id,
            name=cmd.name.strip(),
            description=cmd.description.strip() if cmd.description else None
        )
        
        logger.info(f"Created space {result.id}: {result.name}")
        return result
    
    async def list(self, cmd: ListSpacesCommand) -> list[SpaceResult]:
        """
        List all spaces for a user.
        
        Args:
            cmd: ListSpacesCommand with user_id
        
        Returns:
            List of SpaceResult
        """
        logger.debug(f"Listing spaces for user {cmd.user_id[:8]}...")
        return await self._repository.list_by_user(cmd.user_id)
    
    async def get(self, space_id: int, user_id: str) -> Optional[SpaceResult]:
        """
        Get a specific space.
        
        Args:
            space_id: Space ID
            user_id: Owner user ID
        
        Returns:
            SpaceResult or None
        """
        return await self._repository.get_by_id(space_id, user_id)

    async def delete(self, space_id: int, user_id: str) -> bool:
        """Delete a space scoped to the user."""
        logger.info(f"Deleting space {space_id} for user {user_id[:8]}...")
        return await self._repository.delete(space_id, user_id)
