"""
Embedding Service — Thread-safe, deterministic text embedding.

This is cross-cutting infrastructure that:
- Loads model ONCE (thread-safe)
- Enforces dimension invariants
- Applies Matryoshka truncation + L2 renormalization
- Guarantees determinism (same input → same vector)
"""
import threading
import logging
from typing import Optional
from dataclasses import dataclass
from functools import lru_cache
import hashlib

import numpy as np

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EmbeddingResult:
    """Immutable result of embedding operation."""
    vector: list[float]
    dimension: int
    model: str
    text_hash: str  # For caching/deduplication


class EmbeddingService:
    """
    Thread-safe embedding service with Matryoshka dimension support.
    
    Design:
    - Model loaded lazily, guarded by lock
    - Matryoshka truncation: 768 → 384 → 256
    - L2 renormalization after truncation
    - Deterministic (same text → same vector)
    """
    
    # Supported Matryoshka dimensions (in order)
    SUPPORTED_DIMS = (768, 384, 256, 128, 64)
    DEFAULT_DIM = 768
    DEFAULT_MODEL = "nomic-ai/nomic-embed-text-v1.5"
    
    def __init__(
        self, 
        model_name: str = DEFAULT_MODEL,
        default_dim: int = DEFAULT_DIM,
        cache_size: int = 10000
    ):
        self._model_name = model_name
        self._default_dim = default_dim
        self._cache_size = cache_size
        
        # Thread-safe lazy loading
        self._model_lock = threading.Lock()
        self._model_instance = None
        self._loaded = False
        
        # Validate default dimension
        if default_dim not in self.SUPPORTED_DIMS:
            raise ValueError(
                f"Unsupported dimension {default_dim}. "
                f"Supported: {self.SUPPORTED_DIMS}"
            )
    
    @property
    def model_name(self) -> str:
        return self._model_name
    
    @property
    def default_dimension(self) -> int:
        return self._default_dim
    
    def _load_model(self):
        """Load model with double-check locking for thread safety."""
        if self._model_instance is None:
            with self._model_lock:
                # Double-check after acquiring lock
                if self._model_instance is None:
                    logger.info(f"Loading embedding model: {self._model_name}")
                    try:
                        from sentence_transformers import SentenceTransformer
                        self._model_instance = SentenceTransformer(
                            self._model_name,
                            trust_remote_code=True
                        )
                        self._loaded = True
                        logger.info(f"Model loaded successfully: {self._model_name}")
                    except Exception as e:
                        logger.error(f"Failed to load model: {e}")
                        raise
        return self._model_instance
    
    @property
    def _model(self):
        """Thread-safe model accessor."""
        return self._load_model()
    
    @property
    def is_loaded(self) -> bool:
        """Check if model is loaded (without triggering load)."""
        return self._loaded
    
    def _hash_text(self, text: str) -> str:
        """Create deterministic hash of text for caching."""
        return hashlib.md5(text.encode('utf-8')).hexdigest()[:16]
    
    def _truncate_and_normalize(
        self, 
        vector: np.ndarray, 
        target_dim: int
    ) -> np.ndarray:
        """
        Apply Matryoshka truncation and L2 renormalization.
        
        Matryoshka embeddings are designed so that truncating
        to smaller dimensions preserves semantic quality:
        - 768 → 100% quality
        - 384 → ~98% quality  
        - 256 → ~96% quality
        """
        if target_dim > len(vector):
            raise ValueError(
                f"Target dimension {target_dim} exceeds vector size {len(vector)}"
            )
        
        # Truncate to target dimension
        truncated = vector[:target_dim]
        
        # L2 renormalize (critical for cosine similarity)
        norm = np.linalg.norm(truncated)
        if norm > 0:
            truncated = truncated / norm
        
        return truncated
    
    @lru_cache(maxsize=10000)
    def _cached_encode(self, prefixed_text: str) -> np.ndarray:
        """
        Cached encoding of text.
        
        Uses LRU cache to avoid re-computing embeddings for:
        - Frequent queries
        - Duplicate content
        
        Returns:
            Full-dimension embedding vector
        """
        return self._model.encode(
            prefixed_text,
            normalize_embeddings=True,
            show_progress_bar=False
        )

    def embed_text(
        self, 
        text: str, 
        *, 
        dim: Optional[int] = None
    ) -> EmbeddingResult:
        """
        Embed text into vector space.
        
        Args:
            text: Text to embed
            dim: Target dimension (default: self._default_dim)
                 Must be one of SUPPORTED_DIMS
        
        Returns:
            EmbeddingResult with vector, dimension, model, and text hash
        """
        target_dim = dim or self._default_dim
        
        if target_dim not in self.SUPPORTED_DIMS:
            raise ValueError(
                f"Unsupported dimension {target_dim}. "
                f"Supported: {self.SUPPORTED_DIMS}"
            )
        
        # Compute text hash for caching/deduplication
        text_hash = self._hash_text(text)
        
        # Get full-dimension embedding from model
        # Nomic models expect "search_document: " or "search_query: " prefix
        # For general embedding, use document prefix
        prefixed_text = f"search_document: {text}"
        
        # Use cached encoding
        raw_vector = self._cached_encode(prefixed_text)
        
        # Apply Matryoshka truncation if needed
        if target_dim < len(raw_vector):
            final_vector = self._truncate_and_normalize(raw_vector, target_dim)
        else:
            final_vector = raw_vector
        
        return EmbeddingResult(
            vector=final_vector.tolist(),
            dimension=target_dim,
            model=self._model_name,
            text_hash=text_hash
        )
    
    def embed_query(
        self, 
        query: str, 
        *, 
        dim: Optional[int] = None
    ) -> EmbeddingResult:
        """
        Embed search query (uses different prefix for asymmetric search).
        
        Nomic models use asymmetric search:
        - Documents: "search_document: <text>"
        - Queries: "search_query: <query>"
        """
        target_dim = dim or self._default_dim
        
        if target_dim not in self.SUPPORTED_DIMS:
            raise ValueError(f"Unsupported dimension {target_dim}")
        
        text_hash = self._hash_text(query)
        
        # Use query prefix for search queries
        prefixed_query = f"search_query: {query}"
        
        raw_vector = self._cached_encode(prefixed_query)
        
        if target_dim < len(raw_vector):
            final_vector = self._truncate_and_normalize(raw_vector, target_dim)
        else:
            final_vector = raw_vector
        
        return EmbeddingResult(
            vector=final_vector.tolist(),
            dimension=target_dim,
            model=self._model_name,
            text_hash=text_hash
        )
    
    def embed_batch(
        self, 
        texts: list[str], 
        *, 
        dim: Optional[int] = None
    ) -> list[EmbeddingResult]:
        """
        Embed multiple texts efficiently.
        
        Uses batch encoding for better GPU utilization.
        """
        target_dim = dim or self._default_dim
        
        if target_dim not in self.SUPPORTED_DIMS:
            raise ValueError(f"Unsupported dimension {target_dim}")
        
        # Prefix all texts
        prefixed = [f"search_document: {t}" for t in texts]
        
        # Batch encode
        raw_vectors = self._model.encode(
            prefixed,
            normalize_embeddings=True,
            show_progress_bar=False,
            batch_size=32
        )
        
        results = []
        for text, raw_vec in zip(texts, raw_vectors):
            if target_dim < len(raw_vec):
                vec = self._truncate_and_normalize(raw_vec, target_dim)
            else:
                vec = raw_vec
            
            results.append(EmbeddingResult(
                vector=vec.tolist(),
                dimension=target_dim,
                model=self._model_name,
                text_hash=self._hash_text(text)
            ))
        
        return results


# Singleton instance (lazy loaded)
_embedding_service: Optional[EmbeddingService] = None
_service_lock = threading.Lock()


def get_embedding_service(
    model_name: str = EmbeddingService.DEFAULT_MODEL,
    default_dim: int = EmbeddingService.DEFAULT_DIM
) -> EmbeddingService:
    """
    Get singleton embedding service instance.
    
    Thread-safe factory for global service access.
    """
    global _embedding_service
    
    if _embedding_service is None:
        with _service_lock:
            if _embedding_service is None:
                _embedding_service = EmbeddingService(
                    model_name=model_name,
                    default_dim=default_dim
                )
    
    return _embedding_service
