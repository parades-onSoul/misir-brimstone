import httpx
from bs4 import BeautifulSoup
from typing import Tuple, Dict, Any
from ingestion.loaders.base import Loader

class WebLoader(Loader):
    """
    Loads content from URLs using HTTPlib and BeautifulSoup.
    """
    
    def validate_source(self, source: str) -> bool:
        return source.startswith("http://") or source.startswith("https://")

    def load(self, source: str, **kwargs) -> Tuple[str, Dict[str, Any]]:
        try:
            # Add headers to mimic browser/prevent naive blocks
            headers = {
                "User-Agent": "Misir/1.0 (Orientation Engine)"
            }
            response = httpx.get(source, headers=headers, follow_redirects=True, timeout=10.0)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Remove script and style elements
            for script in soup(["script", "style", "nav", "footer"]):
                script.decompose()
            
            # Extract text
            text = soup.get_text(separator=' ', strip=True)
            
            # Extract Title
            title = soup.title.string if soup.title else source
            
            metadata = {
                "title": title,
                "url": source,
                "content_type": response.headers.get("content-type", "text/html"),
                "status_code": response.status_code
            }
            
            return text, metadata
            
        except Exception as e:
            # Re-raise or handle. For now, simplistic handling.
            raise ValueError(f"Failed to load URL {source}: {str(e)}")
