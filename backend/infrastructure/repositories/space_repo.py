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
    intention: Optional[str]
    user_id: str
    artifact_count: int
    evidence: float = 0.0  # Average confidence of subspaces


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
        intention: Optional[str] = None,
        embedding: Optional[list[float]] = None
    ) -> SpaceResult:
        """
        Create a new space.
        
        Args:
            user_id: Owner user ID
            name: Space name
            intention: Optional user learning goal/objective
        
        Returns:
            SpaceResult with created space details
        """
        try:
            data = {
                'user_id': user_id,
                'name': name,
            }
            if intention:
                data['intention'] = intention
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
                # Calculate evidence as average confidence of subspaces
                evidence = await self._calculate_space_evidence(row['id'], user_id)
                return SpaceResult(
                    id=row['id'],
                    name=row['name'],
                    intention=row.get('intention'),
                    user_id=row['user_id'],
                    artifact_count=row.get('artifact_count', 0),
                    evidence=evidence
                )
            else:
                raise ValueError("Insert returned no data")
                
        except Exception as e:
            logger.error(f"Failed to create space: {e}")
            raise
    
    async def _calculate_space_evidence(self, space_id: int, user_id: str) -> float:
        """
        Calculate space evidence as weighted average of subspace confidences.
        
        Evidence = weighted average of subspace.confidence 
        weighted by subspace.artifact_count
        
        If no subspaces, returns 0.0
        """
        try:
            response = (
                self._client.schema('misir')
                .from_('subspace')
                .select('artifact_count, confidence')
                .eq('space_id', space_id)
                .eq('user_id', user_id)
                .execute()
            )
            
            subspaces = response.data or []
            if not subspaces:
                return 0.0
            
            total_artifacts = sum(s.get('artifact_count', 0) for s in subspaces)
            if total_artifacts == 0:
                return 0.0
            
            weighted_sum = sum(
                s.get('confidence', 0.0) * s.get('artifact_count', 0)
                for s in subspaces
            )
            
            return weighted_sum / total_artifacts
            
        except Exception as e:
            logger.warning(f"Failed to calculate space evidence: {e}")
            return 0.0
    
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
            
            results = []
            for row in (response.data or []):
                evidence = await self._calculate_space_evidence(row['id'], user_id)
                results.append(SpaceResult(
                    id=row['id'],
                    name=row['name'],
                    intention=row.get('intention'),
                    user_id=row['user_id'],
                    artifact_count=row.get('artifact_count', 0),
                    evidence=evidence
                ))
            return results
            
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
                evidence = await self._calculate_space_evidence(space_id, user_id)
                return SpaceResult(
                    id=row['id'],
                    name=row['name'],
                    intention=row.get('intention'),
                    user_id=row['user_id'],
                    artifact_count=row.get('artifact_count', 0),
                    evidence=evidence
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
        intention: Optional[str] = None,
    ) -> Optional[SpaceResult]:
        """Update mutable fields of a space and return updated row."""
        try:
            data = {}
            if name is not None:
                data["name"] = name
            if intention is not None:
                data["intention"] = intention

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
                evidence = await self._calculate_space_evidence(space_id, user_id)
                return SpaceResult(
                    id=row['id'],
                    name=row['name'],
                    intention=row.get('intention'),
                    user_id=row['user_id'],
                    artifact_count=row.get('artifact_count', 0),
                    evidence=evidence
                )
            return None
        except Exception as e:
            logger.error(f"Failed to update space: {e}")
            raise
