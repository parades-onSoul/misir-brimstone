"""
Insights API — actionable intelligence.

Endpoint:
- GET /insights
"""
from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
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
    
    class Config:
        from_attributes = True

def get_supabase_client() -> Client:
    settings = get_settings()
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY or settings.SUPABASE_KEY)

@router.get("/", response_model=List[InsightResponse])
@limiter.limit("20/minute")
async def list_insights(
    request: Request,
    user_id: str = Query(..., description="User ID"),
    status: str = Query("active", description="Status filter (active/dismissed)"),
    limit: int = Query(5, description="Max insights to return"),
    client: Client = Depends(get_supabase_client),
):
    """
    Get active insights for the user.
    """
    response = client.schema("misir").table("insight")\
        .select("*")\
        .eq("user_id", user_id)\
        .eq("status", status)\
        .order("created_at", desc=True)\
        .limit(limit)\
        .execute()
        
    return response.data

@router.post("/generate")
@limiter.limit("5/minute")
async def generate_insights(
    request: Request,
    user_id: str = Query(..., description="User ID"),
    client: Client = Depends(get_supabase_client),
):
    """
    Trigger manual generation of insights for a user.
    """
    service = InsightService(client)
    insights = await service.generate_insights_for_user(user_id)
    return {"count": len(insights), "generated": insights}

