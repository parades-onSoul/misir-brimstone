from typing import Optional, List, Dict, Any
import uuid
import logging
from supabase import create_client, Client
from app.core.config import settings
from domain.models import Artifact, Subspace, Signal

logger = logging.getLogger(__name__)

class SupabaseRepository:
    """
    Persistence adapter for Supabase.
    Maps Domain Models -> Existing DB Schema.
    """
    def __init__(self):
        try:
            self.client: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {e}")
            # Non-blocking for now, but fatal in prod
            self.client = None

    def save_artifact(self, artifact: Artifact, user_id: uuid.UUID, space_id: uuid.UUID) -> bool:
        """
        Persists an artifact to the existing public.artifacts table.
        Requires user_id and space_id as they are NOT NULL in schema.
        """
        if not self.client: return False
        
        # Map internal Enum to DB Constraint
        # Constraint: blog, video, ai, document, note
        type_map = {
            "web_page": "blog",
            "pdf": "document",
            "video": "video",
            "chat_log": "ai",
            "text_snippet": "note"
        }
        db_source = type_map.get(artifact.artifact_type.value, "note")
        
        data = {
            "id": str(artifact.id),
            "content_source": db_source, 
            "extracted_text": artifact.content,             
            "url": artifact.source_url or "https://manual.ingest",
            "title": artifact.metadata.get("title", "Untitled Artifact"),
            
            # Foreign Keys (Required by Schema)
            "user_id": str(user_id),
            "space_id": str(space_id),
            "subspace_id": artifact.metadata.get("subspace_id"), # Optional
            
            # Defaults
            "relevance": artifact.metadata.get("relevance", 1.0),
            "base_weight": 1.0, 
            "created_at": artifact.created_at.isoformat(),
            # "content_hash": artifact.content_hash # Schema might not have this yet? Added to metadata if not.
        }
        
        try:
            self.client.table("artifacts").insert(data).execute()
            return True
        except Exception as e:
            logger.error(f"DB Error saving artifact: {e}")
            return False

    def save_signal(self, signal: Signal) -> bool:
        """
        Persists a Signal to the NEW 'signals' table.
        """
        if not self.client: return False

        data = {
            "id": str(signal.id),
            "artifact_id": str(signal.artifact_id),
            "space_id": str(signal.space_id),
            "vector": signal.vector.tolist(), 
            "magnitude": signal.magnitude,
            "signal_type": signal.signal_type.value,
            "created_at": signal.timestamp.isoformat()
        }
        
        try:
            self.client.table("signals").insert(data).execute()
            return True
        except Exception as e:
            logger.error(f"DB Error saving signal: {e}")
            return False

# Singleton
repository = SupabaseRepository()
