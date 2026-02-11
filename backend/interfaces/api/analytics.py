"""
Analytics API — Space-level metrics and insights.

Endpoint:
- GET /spaces/{space_id}/analytics
- GET /spaces/{space_id}/analytics/drift
- GET /spaces/{space_id}/analytics/velocity
- GET /spaces/{space_id}/analytics/confidence
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
from application.handlers.topology_handler import TopologyHandler
from infrastructure.repositories.subspace_repo import SubspaceRepository
from infrastructure.repositories.signal_repo import SignalRepository
from infrastructure.repositories.artifact_repo import ArtifactRepository

# Import domain entities
from domain.entities.analytics import SubspaceVelocity, SubspaceDrift, SubspaceConfidence

router = APIRouter(prefix="", tags=["analytics"])

class DomainStat(BaseModel):
    domain: str
    count: int

class AnalyticsResponse(BaseModel):
    total_artifacts: int
    engagement_distribution: Dict[str, int]
    top_domains: List[DomainStat]
    activity_level: str # "High", "Medium", "Low" based on recent signals
    subspace_health: List[Dict] # {name: str, confidence: float}


class TopologyNode(BaseModel):
    subspace_id: int
    name: str
    artifact_count: int
    confidence: float
    x: float
    y: float

class TopologyResponse(BaseModel):
    nodes: List[TopologyNode]

# New Models for Job 45
class DriftEvent(BaseModel):
    id: Optional[int]
    subspace_id: int
    subspace_name: str
    drift_magnitude: float
    occurred_at: datetime
    trigger_signal_id: Optional[int]

class VelocityPoint(BaseModel):
    subspace_id: int
    subspace_name: str
    velocity: float
    measured_at: datetime

class ConfidencePoint(BaseModel):
    subspace_id: int
    subspace_name: str
    confidence: float
    computed_at: datetime

class MarginDistribution(BaseModel):
    distribution: Dict[str, int]
    total: int

class Alert(BaseModel):
    type: str
    title: str
    message: str
    severity: str
    trigger_value: float

# Models for Global Analytics (Job 24)
class OverviewMetrics(BaseModel):
    total_artifacts: int
    active_spaces: int
    overall_focus: float
    system_health: str

class TimeAllocationItem(BaseModel):
    space_id: int
    space_name: str
    space_color: str # Hex
    minutes: int
    percentage: float

class HeatmapItem(BaseModel):
    date: str # YYYY-MM-DD
    count: int

class WeaknessItem(BaseModel):
    id: int
    title: str
    space_name: str
    margin: float
    created_at: datetime

class PaceItem(BaseModel):
    space_name: str
    count: int
    trend: str # "up", "down", "flat"

class GlobalAnalyticsResult(BaseModel):
    overview: OverviewMetrics
    time_allocation: List[TimeAllocationItem]
    activity_heatmap: List[HeatmapItem]
    weak_items: List[WeaknessItem]
    pace_by_space: List[PaceItem]


def get_supabase_client() -> Client:
    settings = get_settings()
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY or settings.SUPABASE_KEY)

# Create a new router for global analytics
global_router = APIRouter(prefix="/analytics", tags=["analytics"])

@global_router.get("/global", response_model=GlobalAnalyticsResult)
@limiter.limit("10/minute")
async def get_global_analytics(
    request: Request,
    user_id: str = Query(..., description="User ID"),
    client: Client = Depends(get_supabase_client),
):
    """
    Get aggregated analytics across all of a user's spaces.
    """
    artifact_repo = ArtifactRepository(client)
    
    # 1. Overview Metrics
    all_artifacts = await artifact_repo.get_all_by_user_id(user_id)
    spaces_res = client.schema("misir").from_("space").select("id, name, description").eq("user_id", user_id).execute()
    spaces = spaces_res.data or []
    
    total_artifacts = len(all_artifacts)
    
    # Compute artifact_count per space
    space_counts = Counter(a.get('space_id') for a in all_artifacts if a.get('space_id'))
    active_spaces = len([s for s in spaces if space_counts.get(s['id'], 0) > 5])
    
    # Dummy focus & health for now
    overall_focus = 0.78 
    system_health = "healthy"

    overview = OverviewMetrics(
        total_artifacts=total_artifacts,
        active_spaces=active_spaces,
        overall_focus=overall_focus,
        system_health=system_health,
    )

    # 2. Time Allocation (Dummy Data)
    time_allocation = [
        TimeAllocationItem(space_id=s['id'], space_name=s['name'], space_color="#3B82F6", minutes=s.get('artifact_count', 0) * 5, percentage=0)
        for s in spaces
    ]
    total_minutes = sum(item.minutes for item in time_allocation)
    if total_minutes > 0:
        for item in time_allocation:
            item.percentage = round((item.minutes / total_minutes) * 100, 1)

    # 3. Activity Heatmap (Dummy Data)
    activity_heatmap = []
    today = datetime.utcnow()
    for i in range(90):
        date = today - timedelta(days=i)
        count = len([a for a in all_artifacts if a.created_at.date() == date.date()])
        if count > 0:
            activity_heatmap.append(HeatmapItem(date=date.strftime("%Y-%m-%d"), count=count))

    # 4. Weak Items
    weak_items_data = await artifact_repo.get_weak_artifacts_for_user(user_id, limit=5)
    weak_items = [
        WeaknessItem(
            id=item['id'],
            title=item['title'] or 'Untitled',
            space_name=item['space_name'] or 'Unknown Space',
            margin=item['margin'],
            created_at=item['created_at']
        ) for item in weak_items_data
    ]

    # 5. Pace by Space (Dummy Data)
    pace_by_space = [
        PaceItem(space_name=s['name'], count=s.get('artifact_count', 0), trend="flat")
        for s in spaces
    ]

    return GlobalAnalyticsResult(
        overview=overview,
        time_allocation=time_allocation,
        activity_heatmap=activity_heatmap,
        weak_items=weak_items,
        pace_by_space=pace_by_space,
    )


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

@router.get("/{space_id}/topology", response_model=TopologyResponse)
@limiter.limit("30/minute")
async def get_space_topology(
    request: Request,
    space_id: int = Path(..., description="Space ID"),
    user_id: str = Query(..., description="User ID"),
    client: Client = Depends(get_supabase_client),
):
    """
    Get 2D topology map for knowledge graph visualization.
    Uses cached t-SNE projection of subspace centroids.
    """
    # Setup handler
    repo = SubspaceRepository(client)
    handler = TopologyHandler(repo)
    
    # Get topology
    result = await handler.get_topology(space_id, user_id)
    
    return TopologyResponse(nodes=result.get("nodes", []))

@router.get("/{space_id}/analytics/drift", response_model=List[DriftEvent])
@limiter.limit("20/minute")
async def get_space_drift(
    request: Request,
    space_id: int = Path(..., description="Space ID"),
    user_id: str = Query(..., description="User ID"),
    client: Client = Depends(get_supabase_client),
):
    """Get drift history for all subspaces in the space."""
    repo = SubspaceRepository(client)
    
    # 1. Get all subspaces in space
    subspaces = await repo.get_by_space(space_id, user_id)
    if not subspaces.is_ok():
        return []
    
    # 2. Get history for each (TODO: Optimize to bulk query)
    events = []
    for sub in subspaces.value:
        history = await repo.get_drift_history(sub.id)
        for h in history:
            events.append(DriftEvent(
                id=h.id,
                subspace_id=sub.id,
                subspace_name=sub.name,
                drift_magnitude=h.drift_magnitude,
                occurred_at=h.occurred_at,
                trigger_signal_id=h.trigger_signal_id
            ))
            
    # Sort by date desc
    events.sort(key=lambda x: x.occurred_at, reverse=True)
    return events

@router.get("/{space_id}/analytics/velocity", response_model=List[VelocityPoint])
@limiter.limit("20/minute")
async def get_space_velocity(
    request: Request,
    space_id: int = Path(..., description="Space ID"),
    user_id: str = Query(..., description="User ID"),
    client: Client = Depends(get_supabase_client),
):
    """Get velocity history for all subspaces in the space."""
    repo = SubspaceRepository(client)
    
    # 1. Get all subspaces
    subspaces = await repo.get_by_space(space_id, user_id)
    if not subspaces.is_ok():
        return []
        
    points = []
    for sub in subspaces.value:
        history = await repo.get_velocity_history(sub.id)
        for h in history:
            points.append(VelocityPoint(
                subspace_id=sub.id,
                subspace_name=sub.name,
                velocity=h.velocity,
                measured_at=h.measured_at
            ))
            
    points.sort(key=lambda x: x.measured_at, reverse=True)
    return points

@router.get("/{space_id}/analytics/confidence", response_model=List[ConfidencePoint])
@limiter.limit("20/minute")
async def get_space_confidence(
    request: Request,
    space_id: int = Path(..., description="Space ID"),
    user_id: str = Query(..., description="User ID"),
    client: Client = Depends(get_supabase_client),
):
    """Get confidence history for all subspaces in the space."""
    repo = SubspaceRepository(client)
    
    subspaces = await repo.get_by_space(space_id, user_id)
    if not subspaces.is_ok():
        return []
        
    points = []
    for sub in subspaces.value:
        history = await repo.get_confidence_history(sub.id)
        for h in history:
            points.append(ConfidencePoint(
                subspace_id=sub.id,
                subspace_name=sub.name,
                confidence=h.confidence,
                computed_at=h.computed_at
            ))
            
    points.sort(key=lambda x: x.computed_at, reverse=True)
    return points

@router.get("/{space_id}/analytics/margin_distribution", response_model=MarginDistribution)
@limiter.limit("20/minute")
async def get_margin_distribution(
    request: Request,
    space_id: int = Path(..., description="Space ID"),
    user_id: str = Query(..., description="User ID"),
    client: Client = Depends(get_supabase_client),
):
    """Get margin score distribution for the space."""
    repo = SignalRepository(client)
    
    # Get distribution from repo
    # Note: Repo returns {categories: {...}, total: int}
    # Categories are 'ambiguous', 'low', 'medium', 'high'
    # We map them to 'weak', 'moderate', 'strong' to match JTD spec if needed,
    # or just return as is if the frontend embraces the 4-level split.
    # For JTD compliance (weak/moderate/strong):
    # Weak (<0.3) = Ambiguous (<0.1) + Low (<0.2) + ~33% Medium (<0.5) -- approximations
    # Actually, let's just use the repo's logic directly if it's more precise, 
    # OR map: Ambiguous+Low -> Weak, Medium -> Moderate, High -> Strong.
    
    result = await repo.get_margin_distribution(space_id, user_id)
    cats = result.get('categories', {})
    
    # Mapping to JTD Spec (Week, Moderate, Strong)
    # Weak (<0.3) includes <0.1 and <0.2. 
    # Moderate (0.3-0.5). Repo's Medium is 0.2-0.5. 
    # Strong (>0.5). Repo's High is >0.5.
    
    distribution = {
        "weak": cats.get('ambiguous', 0) + cats.get('low', 0),
        "moderate": cats.get('medium', 0),
        "strong": cats.get('high', 0)
    }
    
    return MarginDistribution(
        distribution=distribution,
        total=result.get('total', 0)
    )

@router.get("/{space_id}/analytics/alerts", response_model=List[Alert])
@limiter.limit("20/minute")
async def get_space_alerts(
    request: Request,
    space_id: int = Path(..., description="Space ID"),
    user_id: str = Query(..., description="User ID"),
    client: Client = Depends(get_supabase_client),
):
    """
    Get smart alerts for the space based on recent metrics.
    """
    alerts = []
    
    # 1. Low Assignment Margin (Avg margin < 0.3 for last 5 items)
    response = client.schema("misir").table("artifact")\
        .select("title, signal(margin)")\
        .eq("space_id", space_id)\
        .order("created_at", desc=True)\
        .limit(5)\
        .execute()
    
    recent_artifacts = response.data or []
    if recent_artifacts:
        margins = [a.get("signal", {}).get("margin") for a in recent_artifacts if a.get("signal") and a.get("signal", {}).get("margin") is not None]
        if margins:
            avg_margin = sum(margins) / len(margins)
            if avg_margin < 0.3:
                alerts.append(Alert(
                    type="low_margin",
                    title="Low Assignment Margin",
                    message="Your last items don't fit neatly into existing topics.",
                    severity="info",
                    trigger_value=avg_margin
                ))
    
    # For Drift/Velocity/Confidence, we need to check sub-spaces
    repo = SubspaceRepository(client)
    subspaces_result = await repo.get_by_space(space_id, user_id)
    
    if subspaces_result.is_ok():
        subspaces = subspaces_result.value
        for sub in subspaces:
            # 2. High Drift (Drift > 0.3 in last update)
            drift_hist = await repo.get_drift_history(sub.id)
            if drift_hist:
                drift_hist.sort(key=lambda x: x.occurred_at, reverse=True)
                latest = drift_hist[0]
                if latest.drift_magnitude > 0.3:
                    alerts.append(Alert(
                        type="high_drift",
                        title=f"High Drift in {sub.name}",
                        message=f"Focus is shifting in '{sub.name}'.",
                        severity="info", 
                        trigger_value=latest.drift_magnitude
                    ))

            # 3. Velocity Drop (Current < 50% of 30d avg)
            vel_hist = await repo.get_velocity_history(sub.id)
            if vel_hist and len(vel_hist) > 1:
                vel_hist.sort(key=lambda x: x.measured_at, reverse=True)
                current_vel = vel_hist[0].velocity
                
                # Calculate avg of available history (up to 30 points as proxy for 30 days if daily)
                relevant = [v.velocity for v in vel_hist[:30]]
                avg_vel = sum(relevant) / len(relevant) if relevant else 0
                
                if avg_vel > 0.1 and current_vel < (avg_vel * 0.5):
                        alerts.append(Alert(
                        type="velocity_drop",
                        title=f"Velocity Drop in {sub.name}",
                        message=f"Slowing down in '{sub.name}'.",
                        severity="warning",
                        trigger_value=current_vel
                    ))

            # 4. Confidence Drop (Drop > 0.2 vs previous check)
            conf_hist = await repo.get_confidence_history(sub.id)
            if conf_hist and len(conf_hist) > 1:
                conf_hist.sort(key=lambda x: x.computed_at, reverse=True)
                current_conf = conf_hist[0].confidence
                prev_conf = conf_hist[1].confidence
                
                drop = prev_conf - current_conf
                if drop > 0.2:
                        alerts.append(Alert(
                        type="confidence_drop",
                        title=f"Confidence Drop in {sub.name}",
                        message=f"Topic '{sub.name}' might need splitting.",
                        severity="warning",
                        trigger_value=drop
                    ))

    return alerts
