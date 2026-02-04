from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, Tuple

class Loader(ABC):
    """
    Abstract interface for fetching content from external sources.
    """
    
    @abstractmethod
    def load(self, source: str, **kwargs) -> Tuple[str, Dict[str, Any]]:
        """
        Fetches content from the source.
        Returns:
            Tuple[str, Dict]: (Raw Content, Metadata)
        """
        pass

    @abstractmethod
    def validate_source(self, source: str) -> bool:
        """
        Checks if the source is valid for this loader.
        """
        pass
