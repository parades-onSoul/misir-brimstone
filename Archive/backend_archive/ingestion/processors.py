from abc import ABC, abstractmethod
from datetime import datetime
import uuid
from typing import Dict, Any, Optional

from domain.models import Artifact, ArtifactType

class BaseProcessor(ABC):
    """
    Abstract base class for converting raw content into an Artifact.
    """
    @abstractmethod
    def process(self, content: Any, **kwargs) -> Artifact:
        pass

class TextProcessor(BaseProcessor):
    """
    Simple processor for raw text content.
    """
    def process(self, content: str, source_url: Optional[str] = None, metadata: Dict[str, Any] = None) -> Artifact:
        if metadata is None:
            metadata = {}
            
        # Basic cleaning (can be expanded)
        cleaned_content = content.strip()
        
        return Artifact(
            id=uuid.uuid4(),
            content=cleaned_content,
            source_url=source_url,
            artifact_type=ArtifactType.TEXT_Snippet,
            created_at=datetime.utcnow(),
            metadata=metadata
        )
