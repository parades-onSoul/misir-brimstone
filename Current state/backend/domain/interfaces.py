from abc import ABC, abstractmethod
from typing import List, Optional, Tuple
import numpy as np
from uuid import UUID
from domain.models import Signal

class VectorStore(ABC):
    """
    Abstract interface for vector persistence and search.
    Decouples the Core Math from the specific DB (Supabase/pgvector).
    """
    
    @abstractmethod
    def add_signals(self, signals: List[Signal]) -> bool:
        """Persists a batch of signals."""
        pass
    
    @abstractmethod
    def search(self, 
               query_vector: np.ndarray, 
               space_id: Optional[UUID] = None, 
               limit: int = 10, 
               threshold: float = 0.0) -> List[Tuple[Signal, float]]:
        """
        Semantic search. Returns list of (Signal, SimilarityScore).
        """
        pass
    
    @abstractmethod
    def get_space_centroid(self, space_id: UUID) -> Optional[np.ndarray]:
        """
        Retrieves the pre-calculated centroid for a space.
        """
        pass

class EmbeddingProvider(ABC):
    """
    Abstract interface for generating embeddings.
    Allows swapping models (MiniLM, OpenAI, Cohere) without changing business logic.
    """
    
    @property
    @abstractmethod
    def model_name(self) -> str:
        """Returns the identifier of the active model."""
        pass
        
    @property
    @abstractmethod
    def dimension(self) -> int:
        """Returns the output vector dimension."""
        pass

    @abstractmethod
    def embed(self, text: str) -> np.ndarray:
        """Generates embedding for a single text."""
        pass
        
    @abstractmethod
    def embed_batch(self, texts: List[str]) -> List[np.ndarray]:
        """Generates embeddings for a batch of texts."""
        pass
