from typing import List, Union, Dict, Optional
import numpy as np
from sentence_transformers import SentenceTransformer
from domain.interfaces import EmbeddingProvider

class LocalEmbeddingService(EmbeddingProvider):
    """
    Concrete implementation using local SentenceTransformers.
    Supports model switching/versioning.
    
    Primary model: Nomic Embed v1.5 (768-dim)
    - 8192 token context window (vs 512 for BGE)
    - Superior long-document handling
    - Matryoshka dimensionality (can truncate to 256/512 if needed)
    
    Matryoshka Embeddings:
    ----------------------
    Nomic v1.5 uses Matryoshka representation learning, meaning the most
    important information is packed into the first dimensions. You can
    truncate vectors without re-training:
    
    - 768-dim: Full fidelity (database storage, centroid calculation)
    - 512-dim: ~99% quality, faster similarity search
    - 384-dim: ~98% quality, extension-compatible dimension
    - 256-dim: ~96% quality, ultra-fast local matching
    - 128-dim: ~92% quality, minimum viable for coarse filtering
    
    Usage:
        full = service.embed("text")              # 768-dim
        compact = service.embed("text", dim=384)  # Truncated to 384
    """
    
    # Registry of supported models
    # Nomic Embed is the production model for backend heavy-lifting
    MODELS = {
        'default': 'nomic-ai/nomic-embed-text-v1.5',  # 768-dim, 8k context
        'lightweight': 'BAAI/bge-small-en-v1.5',      # 384-dim, for extension fallback
        'performance': 'nomic-ai/nomic-embed-text-v1',  # 768-dim, original Nomic
        'multilingual': 'paraphrase-multilingual-MiniLM-L12-v2'
    }
    
    # Supported Matryoshka dimensions for Nomic v1.5
    MATRYOSHKA_DIMS = [768, 512, 384, 256, 128, 64]
    
    # Dimension for the default model
    DEFAULT_DIMENSION = 768

    def __init__(self, model_key: str = 'default'):
        self._model_key = model_key
        self._model_name = self.MODELS.get(model_key, self.MODELS['default'])
        self._model_instance = None
        print(f"Embedding Service Initialized with config: {self._model_key} -> {self._model_name}")

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def _model(self):
        """Lazy loader"""
        if self._model_instance is None:
            print(f"Loading model: {self._model_name}...")
            # trust_remote_code=True required for Nomic models (custom architecture)
            self._model_instance = SentenceTransformer(self._model_name, trust_remote_code=True)
        return self._model_instance

    @property
    def dimension(self) -> int:
        return self._model.get_sentence_embedding_dimension()
    
    def _truncate(self, vector: np.ndarray, dim: Optional[int]) -> np.ndarray:
        """
        Truncate vector using Matryoshka dimensionality.
        The first N dimensions contain the most important information.
        """
        if dim is None or dim >= len(vector):
            return vector
        
        truncated = vector[:dim]
        # Re-normalize after truncation for cosine similarity
        norm = np.linalg.norm(truncated)
        if norm > 0:
            truncated = truncated / norm
        return truncated

    def embed(self, text: str, dim: Optional[int] = None) -> np.ndarray:
        """
        Generate embedding for text.
        
        Args:
            text: Input text to embed
            dim: Optional target dimension (Matryoshka truncation)
                 Use 384 for extension-compatible, 256 for fast local matching
        
        Returns:
            np.ndarray of shape (dim,) or (768,) if dim not specified
        """
        if not text:
            raise ValueError("Input text cannot be empty.")
        
        vector = self._model.encode(text, convert_to_numpy=True)
        return self._truncate(vector, dim)

    def embed_batch(self, texts: List[str], dim: Optional[int] = None) -> List[np.ndarray]:
        """
        Generate embeddings for multiple texts.
        
        Args:
            texts: List of input texts
            dim: Optional target dimension (Matryoshka truncation)
        
        Returns:
            List of np.ndarray, each of shape (dim,) or (768,)
        """
        if not texts:
            return []
        
        # Returns a numpy matrix (N, D)
        embeddings = self._model.encode(texts, convert_to_numpy=True)
        
        # Apply Matryoshka truncation if requested
        if dim is not None and dim < embeddings.shape[1]:
            embeddings = embeddings[:, :dim]
            # Re-normalize each vector
            norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
            norms[norms == 0] = 1  # Avoid division by zero
            embeddings = embeddings / norms
        
        # Convert to list of arrays for interface compliance
        return list(embeddings)
    
    def embed_for_extension(self, text: str) -> np.ndarray:
        """
        Generate extension-compatible embedding (384-dim).
        Matches the dimension the extension expects for local storage.
        """
        return self.embed(text, dim=384)
    
    def embed_for_search(self, text: str) -> np.ndarray:
        """
        Generate fast search embedding (256-dim).
        Good for coarse filtering before full-fidelity comparison.
        """
        return self.embed(text, dim=256)

# Factory function to get service
def get_embedding_service(config: str = "default") -> EmbeddingProvider:
    return LocalEmbeddingService(config)

# Default instance
embedding_service = LocalEmbeddingService()
