"""
Analytics API — Space-level metrics and insights.

Endpoint:
- GET /spaces/{space_id}/analytics
- GET /spaces/{space_id}/analytics/drift
- GET /spaces/{space_id}/analytics/velocity
- GET /spaces/{space_id}/analytics/confidence
"""
from fastapi import APIRouter, Depends, Path, Query, Request, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Dict, List, Optional
from collections import Counter
from datetime import datetime, timedelta, timezone

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


def _parse_iso_timestamp(value: object) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value
    if not value:
        return None
    try:
        text = str(value).replace("Z", "+00:00")
        parsed = datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed
    except Exception:
        return None

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

def get_current_user(
    authorization: str = Header(None),
    client: Client = Depends(get_supabase_client)
) -> str:
    """
    Extract user_id from JWT token and validate with Supabase.
    """
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

# Create a new router for global analytics
global_router = APIRouter(prefix="/analytics", tags=["analytics"])

@global_router.get("/global", response_model=GlobalAnalyticsResult)
@limiter.limit("10/minute")
async def get_global_analytics(
    request: Request,
    current_user_id: str = Depends(get_current_user),
    client: Client = Depends(get_supabase_client),
):
    """
    Get aggregated analytics across all of a user's spaces.
    """
    artifact_repo = ArtifactRepository(client)
    
    # 1. Overview Metrics
    all_artifacts = await artifact_repo.get_all_by_user_id(current_user_id)
    spaces_res = client.schema("misir").from_("space").select("id, name, description").eq("user_id", current_user_id).execute()
    spaces = spaces_res.data or []

    total_artifacts = len(all_artifacts)

    def parse_dt(value):
        if not value:
            return None
        if isinstance(value, datetime):
            return value
        try:
            # Handle "Z" suffix and timezone-aware strings
            if isinstance(value, str) and value.endswith("Z"):
                value = value.replace("Z", "+00:00")
            return datetime.fromisoformat(value)
        except Exception:
            return None

    def minutes_for_artifact(artifact: dict) -> float:
        # Prefer explicit reading_time_min, then dwell_time_ms, then estimate via word_count
        reading_time = artifact.get("reading_time_min")
        if isinstance(reading_time, (int, float)) and reading_time > 0:
            return float(reading_time)

        dwell_ms = artifact.get("dwell_time_ms")
        if isinstance(dwell_ms, (int, float)) and dwell_ms > 0:
            return float(dwell_ms) / 60000.0

        word_count = artifact.get("word_count")
        if isinstance(word_count, (int, float)) and word_count > 0:
            return float(word_count) / 200.0  # 200 wpm baseline

        return 0.0

    # Compute artifact_count per space
    space_counts = Counter(a.get('space_id') for a in all_artifacts if a.get('space_id'))
    active_spaces = len([s for s in spaces if space_counts.get(s['id'], 0) >= 3])

    # Compute overall focus from engagement levels
    engagement_weights = {
        "latent": 0.25,
        "discovered": 0.5,
        "engaged": 0.75,
        "saturated": 1.0,
    }
    if total_artifacts > 0:
        weighted_sum = 0.0
        for a in all_artifacts:
            level = a.get("engagement_level", "latent")
            weighted_sum += engagement_weights.get(level, 0.25)
        overall_focus = max(0.0, min(1.0, weighted_sum / total_artifacts))
    else:
        overall_focus = 0.0

    # System health heuristic
    if total_artifacts == 0:
        system_health = "new"
    elif overall_focus >= 0.7 and active_spaces >= 1:
        system_health = "healthy"
    elif overall_focus >= 0.45:
        system_health = "stable"
    else:
        system_health = "at_risk"

    overview = OverviewMetrics(
        total_artifacts=total_artifacts,
        active_spaces=active_spaces,
        overall_focus=overall_focus,
        system_health=system_health,
    )

    # 2. Time Allocation (Computed from artifacts)
    space_minutes = {s["id"]: 0.0 for s in spaces}
    for a in all_artifacts:
        space_id = a.get("space_id")
        if space_id in space_minutes:
            space_minutes[space_id] += minutes_for_artifact(a)

    # Use frontend palette order for consistency
    palette = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316"]
    time_allocation = [
        TimeAllocationItem(
            space_id=s['id'],
            space_name=s['name'],
            space_color=palette[idx % len(palette)],
            minutes=int(round(space_minutes.get(s['id'], 0.0))),
            percentage=0
        )
        for idx, s in enumerate(spaces)
    ]
    total_minutes = sum(item.minutes for item in time_allocation)
    if total_minutes > 0:
        for item in time_allocation:
            item.percentage = round((item.minutes / total_minutes) * 100, 1)

    # 3. Activity Heatmap (Last 90 days, computed)
    activity_heatmap = []
    today = datetime.now(timezone.utc).date()
    for i in range(90):
        target = today - timedelta(days=i)
        count = 0
        for a in all_artifacts:
            created = parse_dt(a.get("created_at"))
            if created and created.date() == target:
                count += 1
        if count > 0:
            activity_heatmap.append(HeatmapItem(date=target.strftime("%Y-%m-%d"), count=count))

    # 4. Weak Items
    weak_items_data = await artifact_repo.get_weak_artifacts_for_user(current_user_id, limit=5)
    weak_items = [
        WeaknessItem(
            id=item['id'],
            title=item['title'] or 'Untitled',
            space_name=item['space_name'] or 'Unknown Space',
            margin=item['margin'],
            created_at=item['created_at']
        ) for item in weak_items_data
    ]

    # 5. Pace by Space (Last 7 days + trend vs previous 7)
    now = datetime.now(timezone.utc)
    last_7_start = now - timedelta(days=7)
    prev_7_start = now - timedelta(days=14)

    pace_by_space = []
    for s in spaces:
        sid = s["id"]
        last_7 = 0
        prev_7 = 0
        for a in all_artifacts:
            if a.get("space_id") != sid:
                continue
            created = parse_dt(a.get("created_at"))
            if not created:
                continue
            if created >= last_7_start:
                last_7 += 1
            elif created >= prev_7_start:
                prev_7 += 1

        if last_7 > prev_7:
            trend = "up"
        elif last_7 < prev_7:
            trend = "down"
        else:
            trend = "flat"

        pace_by_space.append(PaceItem(space_name=s["name"], count=last_7, trend=trend))

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
    current_user_id: str = Depends(get_current_user),
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
    
    # Activity Level (recent behavior first, then total-volume fallback)
    # Logic:
    # - High: >= 5 artifacts in last 7 days
    # - Medium: 1-4 artifacts in last 7 days
    # - Low: 0 artifacts in last 7 days
    recent_count = 0
    now = datetime.now(timezone.utc)
    one_week_ago = now - timedelta(days=7)

    for a in artifacts:
        created_raw = a.get("created_at")
        if not created_raw:
            continue
        try:
            if isinstance(created_raw, datetime):
                created_at = created_raw
            else:
                created_text = str(created_raw).replace("Z", "+00:00")
                created_at = datetime.fromisoformat(created_text)

            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)

            if created_at >= one_week_ago:
                recent_count += 1
        except Exception:
            continue

    activity = "Low"
    if recent_count >= 5:
        activity = "High"
    elif recent_count > 0:
        activity = "Medium"
    elif total > 50:
        # Fallback for legacy datasets with missing timestamps.
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
    current_user_id: str = Depends(get_current_user),
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
    result = await handler.get_topology(space_id, current_user_id)
    
    return TopologyResponse(nodes=result.get("nodes", []))

@router.get("/{space_id}/analytics/drift", response_model=List[DriftEvent])
@limiter.limit("20/minute")
async def get_space_drift(
    request: Request,
    space_id: int = Path(..., description="Space ID"),
    current_user_id: str = Depends(get_current_user),
    client: Client = Depends(get_supabase_client),
):
    """Get drift history for all subspaces in the space."""
    repo = SubspaceRepository(client)
    
    subspaces_result = await repo.get_by_space(space_id, current_user_id)
    if not subspaces_result.is_ok():
        return []

    subspaces = subspaces_result.ok_value
    if not subspaces:
        return []

    subspace_name_map = {sub.id: sub.name for sub in subspaces}
    subspace_ids = list(subspace_name_map.keys())

    history_rows = (
        client.schema("misir")
        .from_("subspace_drift")
        .select("id, subspace_id, drift_magnitude, occurred_at, trigger_signal_id")
        .in_("subspace_id", subspace_ids)
        .order("occurred_at", desc=True)
        .limit(500)
        .execute()
    ).data or []

    events = [
        DriftEvent(
            id=row.get("id"),
            subspace_id=row["subspace_id"],
            subspace_name=subspace_name_map.get(row["subspace_id"], f"Subspace {row['subspace_id']}"),
            drift_magnitude=row["drift_magnitude"],
            occurred_at=row["occurred_at"],
            trigger_signal_id=row.get("trigger_signal_id"),
        )
        for row in history_rows
    ]

    events.sort(key=lambda x: x.occurred_at, reverse=True)
    return events

@router.get("/{space_id}/analytics/velocity", response_model=List[VelocityPoint])
@limiter.limit("20/minute")
async def get_space_velocity(
    request: Request,
    space_id: int = Path(..., description="Space ID"),
    current_user_id: str = Depends(get_current_user),
    client: Client = Depends(get_supabase_client),
):
    """Get velocity history for all subspaces in the space."""
    repo = SubspaceRepository(client)
    
    subspaces_result = await repo.get_by_space(space_id, current_user_id)
    if not subspaces_result.is_ok():
        return []

    subspaces = subspaces_result.ok_value
    if not subspaces:
        return []

    subspace_name_map = {sub.id: sub.name for sub in subspaces}
    subspace_ids = list(subspace_name_map.keys())

    history_rows = (
        client.schema("misir")
        .from_("subspace_velocity")
        .select("subspace_id, velocity, measured_at")
        .in_("subspace_id", subspace_ids)
        .order("measured_at", desc=True)
        .limit(500)
        .execute()
    ).data or []

    points = [
        VelocityPoint(
            subspace_id=row["subspace_id"],
            subspace_name=subspace_name_map.get(row["subspace_id"], f"Subspace {row['subspace_id']}"),
            velocity=row["velocity"],
            measured_at=row["measured_at"],
        )
        for row in history_rows
    ]

    # Fallback for environments where velocity logging is not yet enabled:
    # derive daily pace from signal creation counts.
    if not points:
        signal_rows = (
            client.schema("misir")
            .from_("signal")
            .select("subspace_id,created_at")
            .eq("user_id", current_user_id)
            .eq("space_id", space_id)
            .in_("subspace_id", subspace_ids)
            .is_("deleted_at", "null")
            .order("created_at", desc=True)
            .limit(2000)
            .execute()
        ).data or []

        pace_buckets: dict[tuple[int, str], int] = {}
        for row in signal_rows:
            subspace_id = row.get("subspace_id")
            if not isinstance(subspace_id, int):
                continue
            parsed = _parse_iso_timestamp(row.get("created_at"))
            if parsed is None:
                continue
            day_key = parsed.date().isoformat()
            key = (subspace_id, day_key)
            pace_buckets[key] = pace_buckets.get(key, 0) + 1

        for (subspace_id, day_key), count in pace_buckets.items():
            measured_at = _parse_iso_timestamp(f"{day_key}T00:00:00+00:00")
            if measured_at is None:
                continue
            points.append(
                VelocityPoint(
                    subspace_id=subspace_id,
                    subspace_name=subspace_name_map.get(subspace_id, f"Subspace {subspace_id}"),
                    velocity=float(count),
                    measured_at=measured_at,
                )
            )

    points.sort(key=lambda x: x.measured_at, reverse=True)
    return points

@router.get("/{space_id}/analytics/confidence", response_model=List[ConfidencePoint])
@limiter.limit("20/minute")
async def get_space_confidence(
    request: Request,
    space_id: int = Path(..., description="Space ID"),
    current_user_id: str = Depends(get_current_user),
    client: Client = Depends(get_supabase_client),
):
    """Get confidence history for all subspaces in the space."""
    repo = SubspaceRepository(client)
    
    subspaces_result = await repo.get_by_space(space_id, current_user_id)
    if not subspaces_result.is_ok():
        return []

    subspaces = subspaces_result.ok_value
    if not subspaces:
        return []

    subspace_name_map = {sub.id: sub.name for sub in subspaces}
    subspace_ids = list(subspace_name_map.keys())

    history_rows = (
        client.schema("misir")
        .from_("subspace_centroid_history")
        .select("subspace_id, confidence, computed_at")
        .in_("subspace_id", subspace_ids)
        .order("computed_at", desc=True)
        .limit(500)
        .execute()
    ).data or []

    points = [
        ConfidencePoint(
            subspace_id=row["subspace_id"],
            subspace_name=subspace_name_map.get(row["subspace_id"], f"Subspace {row['subspace_id']}"),
            confidence=row["confidence"],
            computed_at=row["computed_at"],
        )
        for row in history_rows
    ]

    # Fallback for fresh spaces with no centroid history rows yet.
    if not points:
        for subspace in subspaces:
            timestamp = (
                _parse_iso_timestamp(subspace.centroid_updated_at)
                or _parse_iso_timestamp(subspace.updated_at)
                or _parse_iso_timestamp(subspace.created_at)
            )
            if timestamp is None:
                continue
            points.append(
                ConfidencePoint(
                    subspace_id=subspace.id,
                    subspace_name=subspace.name,
                    confidence=float(subspace.confidence or 0.0),
                    computed_at=timestamp,
                )
            )

    points.sort(key=lambda x: x.computed_at, reverse=True)
    return points

@router.get("/{space_id}/analytics/margin_distribution", response_model=MarginDistribution)
@limiter.limit("20/minute")
async def get_margin_distribution(
    request: Request,
    space_id: int = Path(..., description="Space ID"),
    current_user_id: str = Depends(get_current_user),
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
    
    result = await repo.get_margin_distribution(space_id, current_user_id)
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
    current_user_id: str = Depends(get_current_user),
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
        margins = []
        for artifact in recent_artifacts:
            signal_data = artifact.get("signal")
            if isinstance(signal_data, dict):
                margin = signal_data.get("margin")
                if isinstance(margin, (int, float)):
                    margins.append(margin)
            elif isinstance(signal_data, list):
                for signal_item in signal_data:
                    if isinstance(signal_item, dict):
                        margin = signal_item.get("margin")
                        if isinstance(margin, (int, float)):
                            margins.append(margin)
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
    subspaces_result = await repo.get_by_space(space_id, current_user_id)
    
    if subspaces_result.is_ok():
        subspaces = subspaces_result.ok_value
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
