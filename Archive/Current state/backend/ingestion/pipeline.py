import hashlib
import uuid
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
from domain.models import Artifact, ArtifactType
from ingestion.processors import TextProcessor

logger = logging.getLogger(__name__)

class IngestionPipeline:
    """
    Orchestrates the conversion of raw input into Normalized Artifacts.
    Enforces idempotency and error handling.
    """
    def __init__(self):
        self.text_processor = TextProcessor()
        # In-memory dedup cache for now (Mocking database unique check)
        self._seen_hashes = set()

    def _generate_hash(self, content: str) -> str:
        """MD5 hash for content deduplication."""
        return hashlib.md5(content.encode('utf-8')).hexdigest()

    def process(self, 
                raw_content: str, 
                source_type: ArtifactType, 
                source_url: Optional[str] = None,
                metadata: Dict[str, Any] = None) -> Optional[Artifact]:
        """
        Main entry point. Returns Artifact if successful, None if duplicate or error.
        """
        try:
            # 1. Normalize (Basic trim for now, can be complex pipelines later)
            if not raw_content:
                logger.warning("Empty content rejected.")
                return None

            # 2. Idempotency Check
            content_hash = self._generate_hash(raw_content)
            if content_hash in self._seen_hashes:
                logger.info(f"Duplicate artifact skipped. Hash: {content_hash}")
                return None
            
            # 3. Create Artifact
            artifact = Artifact(
                id=uuid.uuid4(),
                content=raw_content.strip(),
                source_url=source_url,
                artifact_type=source_type,
                created_at=datetime.utcnow(),
                metadata=metadata or {},
                content_hash=content_hash
            )
            
            # 4. Success -> Cache Hash
            self._seen_hashes.add(content_hash)
            return artifact

        except Exception as e:
            logger.error(f"Ingestion Failed: {str(e)}")
            # In production: write to Dead Letter Queue (DLQ)
            return None

# Singleton
ingestion_pipeline = IngestionPipeline()
