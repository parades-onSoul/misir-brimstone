import pypdf
from typing import Tuple, Dict, Any
from io import BytesIO
import httpx
import os
from ingestion.loaders.base import Loader

class PDFLoader(Loader):
    """
    Loads text from PDF files (URL or Local Path).
    """
    def validate_source(self, source: str) -> bool:
        return source.lower().endswith(".pdf")

    def load(self, source: str, **kwargs) -> Tuple[str, Dict[str, Any]]:
        try:
            stream = None
            
            # 1. Handle URL
            if source.startswith("http://") or source.startswith("https://"):
                 headers = {"User-Agent": "Misir/1.0"}
                 response = httpx.get(source, headers=headers, follow_redirects=True)
                 response.raise_for_status()
                 stream = BytesIO(response.content)
            
            # 2. Handle Local File
            elif os.path.exists(source):
                 with open(source, 'rb') as f:
                     stream = BytesIO(f.read())
            
            else:
                raise ValueError("Source is neither a valid URL nor a local file.")
            
            # 3. Extract Text
            reader = pypdf.PdfReader(stream)
            text = ""
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
                
            metadata = {
                "source": source,
                "pages": len(reader.pages),
                "type": "pdf",
                "meta": reader.metadata
            }
            return text, metadata
            
        except Exception as e:
            raise ValueError(f"Failed to load PDF {source}: {e}")
