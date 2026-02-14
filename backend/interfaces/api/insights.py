"""
Insights API — actionable intelligence.

Endpoint:
- GET /insights
"""
from fastapi import APIRouter, Depends, Query, Request, Header, HTTPException
from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime

from supabase import create_client, Client
from core.config import get_settings
from core.limiter import limiter
from infrastructure.services.insight_service import InsightService

router = APIRouter(prefix="/insights", tags=["Insights"])

class InsightResponse(BaseModel):
    id: int
    user_id: str
    space_id: Optional[int]
    subspace_id: Optional[int]
    headline: str
    description: Optional[str]
    insight_data: Dict[str, Any]
    severity: str
    status: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

def get_supabase_client() -> Client:
    settings = get_settings()
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY or settings.SUPABASE_KEY)


def get_current_user(
    authorization: str = Header(None),
    client: Client = Depends(get_supabase_client)
) -> str:
    """Extract user_id from Bearer JWT token."""
    try:
        if not authorization:
            raise HTTPException(status_code=401, detail="Authorization header required")

        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization format")

        token = authorization.split(" ")[1]
        user = client.auth.get_user(token)
        if not user or not user.user:
            raise HTTPException(status_code=401, detail="Invalid token")

        return user.user.id
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {e}")

@router.get("/", response_model=List[InsightResponse])
@limiter.limit("20/minute")
async def list_insights(
    request: Request,
    current_user_id: str = Depends(get_current_user),
    status: str = Query("active", description="Status filter (active/dismissed)"),
    limit: int = Query(5, description="Max insights to return"),
    client: Client = Depends(get_supabase_client),
):
    """
    Get active insights for the user.
    """
    response = client.schema("misir").table("insight")\
        .select("*")\
        .eq("user_id", current_user_id)\
        .eq("status", status)\
        .order("created_at", desc=True)\
        .limit(limit)\
        .execute()
        
    return response.data

@router.post("/generate")
@limiter.limit("5/minute")
async def generate_insights(
    request: Request,
    current_user_id: str = Depends(get_current_user),
    client: Client = Depends(get_supabase_client),
):
    """
    Trigger manual generation of insights for a user.
    """
    service = InsightService(client)
    insights = await service.generate_insights_for_user(current_user_id)
    return {"count": len(insights), "generated": insights}

