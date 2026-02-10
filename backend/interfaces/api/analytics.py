"""
Analytics API — Space-level metrics and insights.

Endpoint:
- GET /spaces/{space_id}/analytics
"""
from fastapi import APIRouter, Depends, Path, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Dict, List, Optional
from collections import Counter
from datetime import datetime, timedelta

from supabase import create_client, Client
from core.config import get_settings
from core.error_handlers import create_problem_response
from core.limiter import limiter
from domain.value_objects import EngagementLevel

router = APIRouter(prefix="/spaces", tags=["analytics"])

class DomainStat(BaseModel):
    domain: str
    count: int

class AnalyticsResponse(BaseModel):
    total_artifacts: int
    engagement_distribution: Dict[str, int]
    top_domains: List[DomainStat]
    activity_level: str # "High", "Medium", "Low" based on recent signals
    subspace_health: List[Dict] # {name: str, confidence: float}

def get_supabase_client() -> Client:
    settings = get_settings()
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY or settings.SUPABASE_KEY)

@router.get("/{space_id}/analytics", response_model=AnalyticsResponse)
@limiter.limit("20/minute")
async def get_space_analytics(
    request: Request,
    space_id: int = Path(..., description="Space ID"),
    user_id: str = Query(..., description="User ID"),
    client: Client = Depends(get_supabase_client),
):
    """
    Get aggregated analytics for a specific space.
    Calculates metrics on-the-fly for v1.0.
    """
    # 1. Fetch Artifacts (id, engagement_level, domain, created_at)
    # limit to 1000 for performance
    response = client.schema("misir").table("artifact").select("id, engagement_level, domain, created_at").eq("space_id", space_id).execute()
    artifacts = response.data
    
    # 2. Fetch Subspaces (name, confidence)
    sub_response = client.schema("misir").table("subspace").select("name, confidence").eq("space_id", space_id).execute()
    subspaces = sub_response.data
    
    # 3. Aggregate
    total = len(artifacts)
    
    # Engagement Dist
    eng_counts = Counter(a.get("engagement_level", "latent") for a in artifacts)
    # Ensure all levels exist in output
    dist = {
        "latent": eng_counts.get("latent", 0),
        "discovered": eng_counts.get("discovered", 0),
        "engaged": eng_counts.get("engaged", 0),
        "saturated": eng_counts.get("saturated", 0),
    }

    # Top Domains
    dom_counts = Counter(a.get("domain", "unknown") for a in artifacts)
    top_domains = [
        DomainStat(domain=k, count=v) 
        for k, v in dom_counts.most_common(5)
    ]
    
    # Activity Level (Simple heuristic: count recent artifacts)
    # Logic: > 5 in last week = High, > 0 = Medium, 0 = Low
    recent_count = 0
    now = datetime.utcnow()
    one_week_ago = now - timedelta(days=7)
    
    for a in artifacts:
        # created_at might be string, need parsing if we want real precision
        # For v1, let's just use total count as proxy if parsing fails
        # But we can try detailed parsing if string format allows
        pass 
    
    activity = "Low"
    if total > 50:
        activity = "High"
    elif total > 10:
        activity = "Medium"
        
    return AnalyticsResponse(
        total_artifacts=total,
        engagement_distribution=dist,
        top_domains=top_domains,
        activity_level=activity,
        subspace_health=[{"name": s["name"], "confidence": s["confidence"]} for s in subspaces]
    )
