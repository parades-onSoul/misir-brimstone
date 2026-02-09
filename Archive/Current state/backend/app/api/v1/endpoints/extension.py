"""
Extension API Endpoints

Dedicated endpoints for the browser extension.
Handles: UserMap download, artifact sync, heartbeat.
Aligned with Supabase schema.
"""

from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid
from supabase import create_client
from app.core.config import settings
from app.core.auth import get_current_user
from intelligence.embeddings import embedding_service

router = APIRouter()

# Initialize Supabase client
try:
    supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
except Exception as e:
    print(f"[Extension] Failed to init Supabase: {e}")
    supabase = None


# ============================================================================
# REQUEST/RESPONSE MODELS (aligned with Supabase schema)
# ============================================================================

class SpaceResponse(BaseModel):
    """Maps to public.spaces table."""
    id: str
    name: str
    intention: Optional[str] = None
    embedding: Optional[List[float]] = None  # 384-dim vector
    created_at: str
    last_updated_at: str


class SubspaceResponse(BaseModel):
    """Maps to public.subspaces table."""
    id: str
    space_id: str
    name: str
    markers: List[str]  # jsonb array of marker labels
    display_order: int = 0
    centroid_embedding: Optional[List[float]] = None
    centroid_artifact_count: int = 0
    centroid_updated_at: Optional[str] = None


class MarkerResponse(BaseModel):
    """Maps to public.markers table."""
    id: str
    label: str
    space_id: str  # Single space (per DB constraint)
    embedding: Optional[List[float]] = None
    created_at: str
    updated_at: str


class CentroidResponse(BaseModel):
    """A Space's semantic center as weighted keywords for local matching."""
    spaceId: str
    spaceName: str
    vector: Dict[str, float]  # term -> weight (0-1)
    threshold: float = Field(default=0.15, ge=0, le=1)
    lastUpdated: int  # Unix timestamp ms


class UserMapResponse(BaseModel):
    """The user's mental map for local matching."""
    userId: str
    spaces: List[SpaceResponse]
    subspaces: List[SubspaceResponse]
    markers: List[MarkerResponse]
    centroids: List[CentroidResponse]
    lastUpdated: int  # Unix timestamp ms


class ArtifactSyncRequest(BaseModel):
    """
    Single artifact from extension sync.
    Aligned with public.artifacts table.
    """
    # Core
    url: str
    title: str
    domain: str
    captured_at: str  # ISO timestamp -> created_at
    
    # Classification
    artifact_type: str  # 'ambient' | 'engaged' | 'committed'
    content_source: str  # 'web' | 'ai' | 'video' | 'pdf'
    
    # Weights
    base_weight: float  # 0.2, 1.0, or 2.0
    decay_rate: str  # 'high' | 'medium' | 'low'
    
    # Engagement metrics
    dwell_time_ms: int
    scroll_depth: float  # 0-1
    reading_depth: float  # 0-1
    
    # Content
    extracted_text: Optional[str] = None
    word_count: Optional[int] = None
    
    # Relevance
    relevance: float  # 0-1
    
    # Matching suggestions
    suggested_space_ids: Optional[List[str]] = None
    matched_marker_ids: Optional[List[str]] = None  # Markers found in content (for subspace matching)
    top_similarity_score: Optional[float] = None
    
    # Session
    session_id: Optional[str] = None


class BatchSyncRequest(BaseModel):
    """Batch artifact sync request."""
    artifacts: List[ArtifactSyncRequest]


class BatchSyncResponse(BaseModel):
    """Batch sync result."""
    success: bool
    synced_count: int
    failed_urls: List[str] = []
    errors: List[str] = []


# ============================================================================
# ENDPOINTS
# ============================================================================

@router.get("/map", response_model=UserMapResponse)
async def get_user_map(
    current_user: dict = Depends(get_current_user)
):
    """
    Download the user's mental map for local matching.
    
    Extension calls this on startup and periodically to refresh.
    Returns spaces, subspaces, markers, and centroids.
    """
    if not supabase:
        raise HTTPException(status_code=503, detail="Database service unavailable")
    
    user_id = current_user["id"]
    now_ms = int(datetime.utcnow().timestamp() * 1000)
    
    try:
        # 1. Fetch spaces
        spaces_result = supabase.table("spaces").select(
            "id, name, intention, embedding, created_at, updated_at"
        ).eq("user_id", user_id).execute()
        
        spaces = [
            SpaceResponse(
                id=str(s["id"]),
                name=s["name"],
                intention=s.get("intention"),
                embedding=s.get("embedding"),
                created_at=s["created_at"],
                last_updated_at=s.get("updated_at", s["created_at"]),
            )
            for s in (spaces_result.data or [])
        ]
        
        # 2. Fetch subspaces with centroid info
        subspaces_result = supabase.table("subspaces").select(
            "id, space_id, name, markers, display_order, centroid_embedding, centroid_artifact_count, centroid_updated_at"
        ).eq("user_id", user_id).execute()
        
        subspaces = []
        for sub in (subspaces_result.data or []):
            # markers is JSONB array of strings
            marker_labels = sub.get("markers", [])
            if isinstance(marker_labels, str):
                import json
                marker_labels = json.loads(marker_labels)
            
            subspaces.append(SubspaceResponse(
                id=str(sub["id"]),
                space_id=str(sub["space_id"]),
                name=sub["name"],
                markers=marker_labels,
                display_order=sub.get("display_order", 0),
                centroid_embedding=sub.get("centroid_embedding"),
                centroid_artifact_count=sub.get("centroid_artifact_count", 0),
                centroid_updated_at=sub.get("centroid_updated_at"),
            ))
        
        # 3. Fetch markers (with join to subspace_markers)
        markers_result = supabase.table("markers").select(
            "id, label, embedding, created_at, updated_at, subspace_markers(subspace_id, weight)"
        ).execute()
        
        markers = []
        for m in (markers_result.data or []):
            # Get space_id from subspace_markers join
            sm_links = m.get("subspace_markers", [])
            if sm_links:
                # Find which space this marker belongs to
                for link in sm_links:
                    subspace_id = link.get("subspace_id")
                    # Look up the space from our subspaces
                    for sub in subspaces:
                        if sub.id == str(subspace_id):
                            markers.append(MarkerResponse(
                                id=str(m["id"]),
                                label=m["label"],
                                space_id=sub.space_id,  # Use space_id from subspace
                                embedding=m.get("embedding"),
                                created_at=m["created_at"],
                                updated_at=m.get("updated_at", m["created_at"]),
                            ))
                            break
        
        # 4. Build centroids from subspace markers (weighted TF-IDF-like vectors)
        centroids = []
        
        # Group subspaces by space
        space_subspaces: Dict[str, List[SubspaceResponse]] = {}
        for sub in subspaces:
            if sub.space_id not in space_subspaces:
                space_subspaces[sub.space_id] = []
            space_subspaces[sub.space_id].append(sub)
        
        for space in spaces:
            space_id = space.id
            space_subs = space_subspaces.get(space_id, [])
            
            # Build weighted keyword vector from all subspace markers
            keyword_weights: Dict[str, float] = {}
            total_artifacts = 0
            
            for sub in space_subs:
                sub_weight = max(sub.centroid_artifact_count, 1)  # At least 1
                total_artifacts += sub_weight
                
                for marker_label in sub.markers:
                    label_lower = marker_label.lower()
                    # Weight by subspace's artifact count
                    current = keyword_weights.get(label_lower, 0)
                    keyword_weights[label_lower] = current + sub_weight
            
            # Normalize to 0-1 range
            if keyword_weights and total_artifacts > 0:
                max_weight = max(keyword_weights.values())
                normalized = {
                    k: round(v / max_weight, 3)
                    for k, v in keyword_weights.items()
                }
            else:
                normalized = {}
            
            # Get latest updated timestamp from subspaces
            latest_update = max(
                (sub.centroid_updated_at or "" for sub in space_subs),
                default=None
            )
            updated_ms = now_ms
            if latest_update:
                try:
                    updated_ms = int(datetime.fromisoformat(
                        latest_update.replace("Z", "+00:00")
                    ).timestamp() * 1000)
                except:
                    pass
            
            centroids.append(CentroidResponse(
                spaceId=space_id,
                spaceName=space.name,
                vector=normalized,
                threshold=0.15,  # Default matching threshold
                lastUpdated=updated_ms,
            ))
        
        return UserMapResponse(
            userId=user_id,
            spaces=spaces,
            subspaces=subspaces,
            markers=markers,
            centroids=centroids,
            lastUpdated=now_ms,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Extension] Failed to load user map: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load user map: {e}")


@router.post("/sync", response_model=BatchSyncResponse)
async def sync_artifacts(
    request: BatchSyncRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Receive batch of artifacts from extension.
    
    Extension calls this every 30 minutes (configurable).
    Stores artifacts aligned with public.artifacts schema.
    """
    if not request.artifacts:
        return BatchSyncResponse(success=True, synced_count=0)
    
    if not supabase:
        return BatchSyncResponse(
            success=False, 
            synced_count=0, 
            errors=["Database not initialized"]
        )
    
    # Get authenticated user_id from JWT token
    auth_user_id = current_user["id"]
    
    synced = 0
    failed_urls = []
    errors = []
    
    # Session cache: extension_session_id -> db_session_uuid
    # This maps the extension's string IDs to actual DB session UUIDs
    session_cache: Dict[str, str] = {}
    
    for item in request.artifacts:
        try:
            print(f"[Sync] Received: {item.title[:50]} ({item.artifact_type})")
            print(f"       URL: {item.url}")
            print(f"       Dwell: {item.dwell_time_ms}ms, Relevance: {item.relevance}")
            
            # Use authenticated user_id
            user_id = auth_user_id
            space_id = None
            subspace_id = None
            
            # Get space_id from suggested spaces (validated against user ownership)
            if item.suggested_space_ids and len(item.suggested_space_ids) > 0:
                suggested_space_id = item.suggested_space_ids[0]
                # Verify the user owns this space
                try:
                    space_result = supabase.table("spaces").select("id, user_id").eq("id", suggested_space_id).single().execute()
                    if space_result.data and space_result.data.get("user_id") == user_id:
                        space_id = suggested_space_id
                    else:
                        print(f"[Sync] Space {suggested_space_id} not owned by user {user_id}")
                except Exception as e:
                    print(f"[Sync] Could not verify space {suggested_space_id}: {e}")
            
            # If no valid space_id, get user's first space as fallback
            if not space_id:
                try:
                    first_space = supabase.table("spaces").select("id").eq("user_id", user_id).limit(1).execute()
                    if first_space.data and len(first_space.data) > 0:
                        space_id = first_space.data[0].get("id")
                        print(f"[Sync] Using fallback space_id: {space_id}")
                except Exception as e:
                    print(f"[Sync] Could not get fallback space: {e}")
            
            if not user_id or not space_id:
                failed_urls.append(item.url)
                errors.append(f"{item.url}: No user_id or space_id available")
                continue
            
            # Find best matching subspace based on matched markers
            # The extension provides matchedMarkerIds - use those to find the subspace
            subspace_id = None
            
            if item.matched_marker_ids and len(item.matched_marker_ids) > 0:
                try:
                    # Get all subspaces for this space
                    subspaces_result = supabase.table("subspaces").select("id, markers").eq("space_id", space_id).execute()
                    
                    if subspaces_result.data:
                        best_subspace = None
                        best_match_count = 0
                        
                        # Find subspace with most matching markers
                        for subspace in subspaces_result.data:
                            subspace_markers = subspace.get("markers", [])
                            # Count how many of the matched markers are in this subspace
                            match_count = sum(1 for marker_id in item.matched_marker_ids if marker_id in subspace_markers)
                            
                            if match_count > best_match_count:
                                best_match_count = match_count
                                best_subspace = subspace
                        
                        if best_subspace:
                            subspace_id = best_subspace.get("id")
                            print(f"[Sync] Matched {best_match_count} markers → Subspace: {subspace_id}")
                        
                except Exception as e:
                    print(f"[Sync] Could not match markers to subspace: {e}")
            
            # Fallback: get first subspace if no markers matched
            if not subspace_id:
                try:
                    subspaces = supabase.table("subspaces").select("id").eq("space_id", space_id).limit(1).execute()
                    if subspaces.data and len(subspaces.data) > 0:
                        subspace_id = subspaces.data[0].get("id")
                except Exception as e:
                    print(f"[Sync] Could not look up fallback subspace: {e}")
            
            # Generate embedding for the extracted text
            content_embedding = None
            try:
                if item.extracted_text and len(item.extracted_text) > 50:  # Only embed if meaningful content
                    embedding_vector = embedding_service.embed(item.extracted_text[:10000])  # Limit to 10k chars
                    content_embedding = embedding_vector.tolist()  # Convert numpy array to list
                    print(f"[Sync] Generated embedding: {len(content_embedding)} dimensions")
            except Exception as e:
                print(f"[Sync] Warning: Could not generate embedding: {e}")
                # Continue without embedding - it's optional
            
            # Map content_source: extension sends 'web'|'ai'|'video'|'pdf'
            # DB constraint allows: 'web'|'ai'|'video'|'pdf'
            # Direct mapping (no translation needed)
            valid_sources = {"web", "ai", "video", "pdf"}
            db_source = item.content_source if item.content_source in valid_sources else "web"
            
            # Handle session tracking
            # Extension sends a string-based session ID; DB expects UUID reference to sessions table
            db_session_id = None
            if item.session_id and user_id:
                # Check cache first
                if item.session_id in session_cache:
                    db_session_id = session_cache[item.session_id]
                    # Increment artifact count for existing session
                    try:
                        current = supabase.table("sessions").select("artifact_count").eq("id", db_session_id).single().execute()
                        if current.data:
                            new_count = (current.data.get("artifact_count") or 0) + 1
                            supabase.table("sessions").update({"artifact_count": new_count}).eq("id", db_session_id).execute()
                    except Exception:
                        pass  # Non-critical
                else:
                    # Create new session in DB
                    try:
                        new_session = supabase.table("sessions").insert({
                            "user_id": user_id,
                            "started_at": item.captured_at,  # Use artifact timestamp as session start
                            "artifact_count": 1,
                            "focus_space_id": space_id,
                        }).execute()
                        
                        if new_session.data and len(new_session.data) > 0:
                            db_session_id = new_session.data[0].get("id")
                            session_cache[item.session_id] = db_session_id
                            print(f"[Sync] Created session: {db_session_id}")
                    except Exception as e:
                        print(f"[Sync] Warning: Could not create session: {e}")
                        # Continue without session - it's optional
            
            # Insert into artifacts table
            artifact_data = {
                "user_id": user_id,
                "space_id": space_id,
                "subspace_id": subspace_id,  # Now includes subspace
                "session_id": db_session_id,  # DB session UUID (or None)
                "url": item.url,
                "title": item.title,
                "extracted_text": item.extracted_text[:10000] if item.extracted_text else None,
                "content_source": db_source,
                "content_embedding": content_embedding,  # Now includes embedding
                "relevance": item.relevance,
                "base_weight": item.base_weight,
                "word_count": item.word_count,
                "created_at": item.captured_at,
            }
            
            # UPSERT: Insert if new, update if exists (handles re-synced final metrics)
            # Conflict on (url, user_id) - assumes unique constraint exists
            result = supabase.table("artifacts").upsert(
                artifact_data,
                on_conflict="url,user_id"
            ).execute()
            
            if result.data:
                print(f"[Sync] ✓ Saved: {item.title[:40]}")
                synced += 1
            else:
                failed_urls.append(item.url)
                errors.append(f"{item.url}: Insert returned no data")
                
        except Exception as e:
            print(f"[Sync] Error saving {item.url}: {e}")
            failed_urls.append(item.url)
            errors.append(f"{item.url}: {str(e)}")
    
    return BatchSyncResponse(
        success=len(failed_urls) == 0,
        synced_count=synced,
        failed_urls=failed_urls,
        errors=errors[:10],
    )


@router.get("/health")
async def extension_health():
    """
    Quick health check for extension connectivity test.
    """
    return {
        "status": "healthy",
        "service": "extension-api",
        "timestamp": datetime.utcnow().isoformat(),
    }
