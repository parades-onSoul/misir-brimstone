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

import numpy as np
from supabase import Client
from infrastructure.repositories.space_repo import SpaceRepository, SpaceResult
from infrastructure.services.embedding_service import EmbeddingService

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CreateSpaceCommand:
    """Command to create a new space."""
    user_id: str
    name: str
    description: Optional[str] = None
    intention: Optional[str] = None
    subspaces: list[dict] = None  # List of {name, description, markers: [str], ...}
    
    def __post_init__(self):
        if not self.user_id:
            raise ValueError("user_id is required")
        if not self.name or not self.name.strip():
            raise ValueError("name is required and cannot be empty")
        # Handle mutable default
        if self.subspaces is None:
            object.__setattr__(self, 'subspaces', [])


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
        self._client = client
        self._repository = SpaceRepository(client)
        self._embedding_service = EmbeddingService()
    
    async def create(self, cmd: CreateSpaceCommand) -> SpaceResult:
        """
        Create a new space with optional subspaces and markers.
        
        Args:
            cmd: CreateSpaceCommand with user_id, name, and optional subspaces
        
        Returns:
            SpaceResult with created space
        """
        logger.info(f"Creating space '{cmd.name}' for user {cmd.user_id[:8]}...")
        
        # 1. Generate embedding for the intention (if provided)
        intention_embedding = None
        if cmd.intention:
            logger.info(f"🧠 Embedding intention: '{cmd.intention[:50]}...'")
            intention_result = self._embedding_service.embed_text(cmd.intention)
            intention_embedding = intention_result.vector
            logger.info(f"✅ Generated intention embedding: dim={intention_result.dimension}")
        
        # 2. Create the space
        result = await self._repository.create(
            user_id=cmd.user_id,
            name=cmd.name.strip(),
            description=cmd.description.strip() if cmd.description else None,
            embedding=intention_embedding
        )
        
        logger.info(f"Created space {result.id}: {result.name}")
        
        # 2. Create subspaces and markers if provided
        if cmd.subspaces:
            logger.info(f"🔧 Creating {len(cmd.subspaces)} subspaces with markers...")
            logger.info(f"📦 Subspaces data: {[s.get('name') for s in cmd.subspaces]}")
            for idx, subspace_data in enumerate(cmd.subspaces):
                logger.info(f"📝 Processing subspace {idx+1}/{len(cmd.subspaces)}: {subspace_data.get('name')}")
                try:
                    # Create subspace
                    subspace_response = (
                        self._client.schema('misir')
                        .from_('subspace')
                        .insert({
                            'space_id': result.id,
                            'user_id': cmd.user_id,
                            'name': subspace_data.get('name'),
                            'description': subspace_data.get('description'),
                            'confidence': 0.0,
                            'learning_rate': 0.1
                        })
                        .execute()
                    )
                    
                    if not subspace_response.data:
                        logger.warning(f"Failed to create subspace: {subspace_data.get('name')}")
                        continue
                    
                    subspace_id = subspace_response.data[0]['id']
                    logger.info(f"Created subspace {subspace_id}: {subspace_data.get('name')}")
                    
                    # Create markers for this subspace  
                    markers = subspace_data.get('markers', [])
                    if markers:
                        logger.info(f"Creating {len(markers)} markers for subspace {subspace_id}...")
                        marker_embeddings = []  # Collect embeddings for centroid computation
                        
                        for marker_text in markers:
                            try:
                                # Generate embedding for marker
                                embedding_result = self._embedding_service.embed_text(marker_text)
                                logger.info(f"Generated embedding for '{marker_text}': dim={embedding_result.dimension}")
                                
                                # Insert marker
                                marker_response = (
                                    self._client.schema('misir')
                                    .from_('marker')
                                    .insert({
                                        'space_id': result.id,
                                        'user_id': cmd.user_id,
                                        'label': marker_text,
                                        'embedding': embedding_result.vector,
                                        'weight': 1.0
                                    })
                                    .execute()
                                )
                                
                                if marker_response.data:
                                    marker_id = marker_response.data[0]['id']
                                    
                                    # Link marker to subspace
                                    self._client.schema('misir').from_('subspace_marker').insert({
                                        'subspace_id': subspace_id,
                                        'marker_id': marker_id,
                                        'weight': 1.0,
                                        'source': 'user_defined'
                                    }).execute()
                                    
                                    # Collect embedding for centroid
                                    marker_embeddings.append(embedding_result.vector)
                                    
                                    logger.info(f"Created marker {marker_id}: '{marker_text}' and linked to subspace {subspace_id}")
                                
                            except Exception as marker_error:
                                logger.error(f"Failed to create marker '{marker_text}': {marker_error}", exc_info=True)
                        
                        # Compute and store centroid embedding
                        if marker_embeddings:
                            centroid = np.mean(marker_embeddings, axis=0).tolist()
                            
                            self._client.schema('misir').from_('subspace').update({
                                'centroid_embedding': centroid,
                                'centroid_updated_at': 'NOW()'
                            }).eq('id', subspace_id).execute()
                            
                            logger.info(f"✅ Computed and stored centroid for subspace {subspace_id} from {len(marker_embeddings)} markers")
                        
                        logger.info(f"Created {len(markers)} markers for subspace {subspace_id}")
                    
                except Exception as subspace_error:
                    logger.error(f"Failed to create subspace: {subspace_error}", exc_info=True)
        
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
