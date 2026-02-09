from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, UUID4
from typing import Optional, Dict, Any
from domain.models import ArtifactType
from ingestion.pipeline import ingestion_pipeline
from storage.repositories import repository

router = APIRouter()

class IngestRequest(BaseModel):
    content: str
    source_type: str = "text_snippet"
    source_url: Optional[str] = None
    metadata: Dict[str, Any] = {}
    vector: list[float]  # Required: Extension must send embeddings
    
    # Required for existing DB Schema
    user_id: UUID4 
    space_id: UUID4

@router.post("/test", status_code=200)
def ingest_artifact(payload: IngestRequest):
    """
    Ingests a raw artifact into the existing system.
    """
    # Map 'text_snippet' to schema-compatible value if needed
    # (Schema has: blog, video, ai, document, note)
    schema_map = {
        "web_page": "blog",
        "pdf": "document",
        "video": "video",
        "chat_log": "ai",
        "text_snippet": "note"
    }
    
    mapped_type = schema_map.get(payload.source_type, "note")
    
    # Process (Normalization)
    # We use our internal ArtifactType for processing logic
    try:
        internal_type = ArtifactType[payload.source_type.upper()]
    except:
        internal_type = ArtifactType.TEXT_SNIPPET

    artifact = ingestion_pipeline.process(
        raw_content=payload.content,
        source_type=internal_type,
        source_url=payload.source_url,
        metadata={**payload.metadata, "title": "Ingested via API"}
    )

    if not artifact:
        raise HTTPException(status_code=400, detail="Artifact ignored (Duplicate or Empty)")

    # Persist Artifact
    success = repository.save_artifact(
        artifact, 
        user_id=payload.user_id, 
        space_id=payload.space_id
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="Database persistence failed (Artifact)")

    # 4. Generate Signal from Extension Embedding
    from domain.models import Signal, SignalType
    import uuid
    from datetime import datetime

    # MVP: Extension must provide embeddings
    if not payload.vector or len(payload.vector) == 0:
        raise HTTPException(status_code=400, detail="Vector embedding required (extension must send)")
    
    # Validate dimension (384 for bge-small-en-v1.5)
    if len(payload.vector) != 384:
        raise HTTPException(status_code=400, detail=f"Invalid vector dimension: expected 384, got {len(payload.vector)}")

    try:
        signal = Signal(
            id=uuid.uuid4(),
            artifact_id=artifact.id,
            space_id=payload.space_id,
            vector=payload.vector,
            magnitude=1.0,  # Default initial magnitude
            signal_type=SignalType.SEMANTIC,
            timestamp=datetime.utcnow()
        )
        
        sig_success = repository.save_signal(signal)
        if not sig_success:
             raise HTTPException(status_code=500, detail="Database persistence failed (Signal)")
             
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid signal data: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Signal creation failed: {e}")

    return {
        "status": "accepted", 
        "id": str(artifact.id),
        "db_mapped_type": mapped_type,
        "signal_id": str(signal.id)
    }
