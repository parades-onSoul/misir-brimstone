"""
Space API — Endpoints for space management.

Endpoints:
- GET /spaces — List user's spaces
- POST /spaces — Create new space
- GET /spaces/{id} — Get space by ID

Uses RFC 9457 Problem Details for standardized error responses.
"""
from fastapi import APIRouter, Depends, Path, Query, Request, Header, HTTPException
from fastapi_problem.error import Problem
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta, timezone

from supabase import create_client, Client
from core.config import get_settings
from core.logging_config import get_logger
from application.handlers.space_handler import (
    SpaceHandler, 
    CreateSpaceCommand, 
    ListSpacesCommand,
    UpdateSpaceCommand,
)
from application.handlers.artifact_handler import ArtifactHandler
from infrastructure.repositories import ArtifactRepository

logger = get_logger(__name__)
router = APIRouter(prefix="/spaces", tags=["spaces"])


# Request/Response models
class CreateMarkerInput(BaseModel):
    """Marker to create for a subspace."""
    text: str
    weight: float = 1.0


class CreateSubspaceInput(BaseModel):
    """Subspace to create with a space."""
    name: str
    description: Optional[str] = None
    markers: list[CreateMarkerInput] = []
    depth: Optional[str] = None
    prerequisites: list[str] = []
    suggested_study_order: Optional[int] = None


class CreateSpaceRequest(BaseModel):
    """Request to create a space."""
    user_id: Optional[str] = None  # Deprecated: user identity comes from JWT
    name: str
    intention: Optional[str] = None  # User's learning goal or objective
    subspaces: list[CreateSubspaceInput] = []
    
    # Deprecated fields (kept for backward compatibility)
    description: Optional[str] = None  # Maps to intention internally


class UpdateSpaceRequest(BaseModel):
    """Request to update mutable space fields."""
    name: Optional[str] = None
    intention: Optional[str] = None  # User's learning goal or objective


class SpaceResponse(BaseModel):
    """Space response."""
    id: int
    name: str
    intention: Optional[str]  # User's learning goal/objective
    user_id: str
    artifact_count: int
    evidence: float = 0.0  # Weighted average confidence of subspaces


class SpaceListResponse(BaseModel):
    """List of spaces response."""
    spaces: list[SpaceResponse]
    count: int
class DeleteSpaceResponse(BaseModel):
    deleted: bool


class TimelineArtifact(BaseModel):
    id: int
    title: Optional[str]
    url: str
    domain: str
    created_at: datetime
    engagement_level: str
    subspace_id: Optional[int]


class TimelineResponse(BaseModel):
    artifacts: list[TimelineArtifact]


class SpaceArtifactResponse(BaseModel):
    """Artifact response for space detail views with margin data."""
    id: int
    title: Optional[str]
    url: str
    domain: Optional[str] = None
    subspace_id: Optional[int]
    margin: Optional[float]
    engagement_level: str
    dwell_time_ms: int
    reading_depth: Optional[float] = None
    word_count: Optional[int] = None
    content_source: Optional[str] = None
    reading_time_min: Optional[float] = None
    captured_at: Optional[datetime] = None
    created_at: datetime


class SpaceArtifactsListResponse(BaseModel):
    """Paginated artifacts list for a space."""
    artifacts: list[SpaceArtifactResponse]
    count: int
    page: int
    page_size: int


class AlertAction(BaseModel):
    """Suggested action for an alert."""
    label: str
    action: str
    target: Optional[str] = None


class SpaceAlert(BaseModel):
    """Alert for a space."""
    id: str
    type: str  # low_margin, high_drift, velocity_drop, confidence_drop
    severity: str  # info, warning, danger
    title: str
    message: str
    affected_artifacts: list[int]
    suggested_actions: list[AlertAction]
    space_id: int


class SpaceAlertsResponse(BaseModel):
    """List of alerts for a space."""
    alerts: list[SpaceAlert]
    count: int


# Dependency
def get_supabase_client() -> Client:
    """Get Supabase client."""
    settings = get_settings()
    # Use service role key on the backend to bypass RLS for server-side operations
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


from core.limiter import limiter

@router.get("", response_model=SpaceListResponse)
@limiter.limit("50/minute")
async def list_spaces(
    request: Request,
    current_user_id: str = Depends(get_current_user),
    client: Client = Depends(get_supabase_client)
):
    """
    List all spaces for a user.
    
    Args:
        user_id: User ID to list spaces for
    
    Returns:
        SpaceListResponse with list of spaces
        
    Raises:
        Problem (400): If user_id is invalid
        Problem (500): If an unexpected error occurs
    """
    handler = SpaceHandler(client)
    cmd = ListSpacesCommand(user_id=current_user_id)
    results = await handler.list(cmd)
    
    return SpaceListResponse(
        spaces=[
            SpaceResponse(
                id=r.id,
                name=r.name,
                intention=r.intention,
                user_id=r.user_id,
                artifact_count=r.artifact_count,
                evidence=r.evidence
            )
            for r in results
        ],
        count=len(results)
    )


@router.post("", response_model=SpaceResponse, status_code=201)
@limiter.limit("50/minute")
async def create_space(
    request: Request,
    body: CreateSpaceRequest,
    current_user_id: str = Depends(get_current_user),
    client: Client = Depends(get_supabase_client)
):
    """
    Create a new space.
    
    Args:
        body: CreateSpaceRequest with name and optional intention
    
    Returns:
        SpaceResponse with created space
        
    Raises:
        Problem (400): If validation fails
        Problem (500): If an unexpected error occurs
    """
    handler = SpaceHandler(client)
    
    # Convert subspaces to dict format
    subspaces_data = [
        {
            'name': sub.name,
            'description': sub.description,
            'markers': sub.markers,
            'depth': sub.depth,
            'prerequisites': sub.prerequisites,
            'suggested_study_order': sub.suggested_study_order
        }
        for sub in body.subspaces
    ] if body.subspaces else []
    
    cmd = CreateSpaceCommand(
        user_id=current_user_id,
        name=body.name,
        intention=body.intention or body.description,  # Support both for backward compat
        subspaces=subspaces_data
    )
    result = await handler.create(cmd)
    
    return SpaceResponse(
        id=result.id,
        name=result.name,
        intention=result.intention,
        user_id=result.user_id,
        artifact_count=result.artifact_count,
        evidence=result.evidence
    )


@router.delete("/{space_id}", response_model=DeleteSpaceResponse)
@limiter.limit("50/minute")
async def delete_space(
    request: Request,
    space_id: int = Path(..., description="Space ID"),
    current_user_id: str = Depends(get_current_user),
    client: Client = Depends(get_supabase_client)
):
    """Delete a space for the given user."""
    handler = SpaceHandler(client)
    try:
        deleted = await handler.delete(space_id, current_user_id)
    except Exception as e:
        logger.error("Failed to delete space", extra={"space_id": space_id, "user_id": current_user_id, "error": str(e)})
        raise Problem(
            status=500,
            title="Delete Failed",
            detail="An unexpected error occurred while deleting the space.",
            type_="delete-space-error"
        )

    if not deleted:
        raise Problem(
            status=404,
            title="Not Found",
            detail=f"Space with id {space_id} not found",
            type_="space-not-found"
        )

    return DeleteSpaceResponse(deleted=True)


@router.get("/{space_id}", response_model=SpaceResponse)
@limiter.limit("50/minute")
async def get_space(
    request: Request,
    space_id: int,
    current_user_id: str = Depends(get_current_user),
    client: Client = Depends(get_supabase_client)
):
    """
    Get a specific space by ID.
    
    Args:
        space_id: Space ID
        user_id: User ID (for ownership check)
    
    Returns:
        SpaceResponse
        
    Raises:
        Problem (404): If space not found
        Problem (500): If an unexpected error occurs
    """
    handler = SpaceHandler(client)
    result = await handler.get(space_id, current_user_id)
    
    if result is None:
        raise Problem(
            status=404,
            title="Not Found",
            detail=f"Space with id {space_id} not found",
            type_="space-not-found"
        )
    
    return SpaceResponse(
        id=result.id,
        name=result.name,
        intention=result.intention,
        user_id=result.user_id,
        artifact_count=result.artifact_count,
        evidence=result.evidence
    )


@router.patch("/{space_id}", response_model=SpaceResponse)
@limiter.limit("50/minute")
async def update_space(
    request: Request,
    body: UpdateSpaceRequest,
    space_id: int = Path(..., description="Space ID"),
    current_user_id: str = Depends(get_current_user),
    client: Client = Depends(get_supabase_client)
):
    """
    Update mutable fields for a space.

    Supported fields:
    - name
    - intention (user's learning goal)
    """
    if body.name is None and body.intention is None:
        raise Problem(
            status=400,
            title="Bad Request",
            detail="At least one field must be provided",
            type_="validation-error"
        )

    handler = SpaceHandler(client)
    cmd = UpdateSpaceCommand(
        space_id=space_id,
        user_id=current_user_id,
        name=body.name,
        intention=body.intention,
    )
    result = await handler.update(cmd)

    if result is None:
        raise Problem(
            status=404,
            title="Not Found",
            detail=f"Space with id {space_id} not found",
            type_="space-not-found"
        )

    return SpaceResponse(
        id=result.id,
        name=result.name,
        intention=result.intention,
        user_id=result.user_id,
        artifact_count=result.artifact_count,
        evidence=result.evidence
    )


@router.get("/{space_id}/timeline", response_model=TimelineResponse)
@limiter.limit("50/minute")
async def get_space_timeline(
    request: Request,
    space_id: int,
    current_user_id: str = Depends(get_current_user),
    client: Client = Depends(get_supabase_client)
):
    """
    Get artifacts timeline for a space.
    
    Args:
        space_id: Space ID
        user_id: User ID (for ownership check)
        
    Returns:
        TimelineResponse
        
    Raises:
        Problem (404): If space not found
        Problem (500): If an unexpected error occurs
    """
    handler = SpaceHandler(client)
    
    # Check if space exists first
    space = await handler.get(space_id, current_user_id)
    if space is None:
        raise Problem(
            status=404,
            title="Not Found",
            detail=f"Space with id {space_id} not found",
            type_="space-not-found"
        )
        
    artifacts = await handler.get_timeline(space_id, current_user_id)
    
    return TimelineResponse(
        artifacts=[
            TimelineArtifact(
                id=a['id'],
                title=a.get('title'),
                url=a['url'],
                domain=a['domain'],
                created_at=a['created_at'],
                engagement_level=a['engagement_level'],
                subspace_id=a.get('subspace_id')
            )
            for a in artifacts
        ]
    )

@router.get("/{space_id}/artifacts", response_model=SpaceArtifactsListResponse)
@limiter.limit("50/minute")
async def get_space_artifacts(
    request: Request,
    space_id: int,
    current_user_id: str = Depends(get_current_user),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    subspace_id: Optional[int] = Query(None, description="Filter by subspace"),
    engagement_level: Optional[str] = Query(None, description="Filter by engagement level"),
    min_margin: Optional[float] = Query(None, description="Filter by minimum margin"),
    sort: str = Query("recent", description="Sort order: recent, oldest, margin_desc, margin_asc"),
    client: Client = Depends(get_supabase_client)
):
    """
    Get artifacts for a space with margin data (paginated).
    
    This endpoint joins artifacts with their most recent signal to include
    assignment margin information. Used for Space Detail Library view.
    
    Args:
        space_id: Space ID
        user_id: User ID (for ownership check)
        page: Page number (1-indexed)
        page_size: Items per page (max 100)
        
    Returns:
        SpaceArtifactsListResponse with paginated artifacts
        
    Raises:
        Problem (404): If space not found
        Problem (500): If query fails
    """
    handler = SpaceHandler(client)
    
    # Check if space exists
    space = await handler.get(space_id, current_user_id)
    if space is None:
        raise Problem(
            status=404,
            title="Not Found",
            detail=f"Space with id {space_id} not found",
            type_="space-not-found"
        )
    
    # Use ArtifactHandler for paginated query
    repo = ArtifactRepository(client)
    artifact_handler = ArtifactHandler(repo)
    
    result = await artifact_handler.get_paginated(
        user_id=current_user_id,
        space_id=space_id,
        page=page,
        limit=page_size,
        subspace_id=subspace_id,
        engagement_level=engagement_level,
        min_margin=min_margin,
        sort=sort
    )
    
    if result.is_err():
        logger.error(f"Failed to get artifacts: {result.err().message}")
        raise Problem(
            status=500,
            title="Internal Server Error",
            detail="Failed to retrieve artifacts",
            type_="internal-server-error"
        )
        
    data = result.ok()
    items = data["items"]
    pagination = data["pagination"]
    
    # Map to response model
    artifacts_list = []
    for item in items:
        # Extract margin
        margin = None
        sig = item.get('signal')
        if sig:
            if isinstance(sig, list) and len(sig) > 0:
                margin = sig[0].get('margin')
            elif isinstance(sig, dict):
                margin = sig.get('margin')
                
        artifacts_list.append(SpaceArtifactResponse(
            id=item['id'],
            title=item.get('title'),
            url=item['url'],
            domain=item.get('domain'),
            created_at=item.get('created_at'),
            engagement_level=item.get('engagement_level', 'latent'),
            subspace_id=item.get('subspace_id'),
            margin=margin,
            dwell_time_ms=item.get('dwell_time_ms', 0),
            reading_depth=item.get('reading_depth'),
            word_count=item.get('word_count'),
            content_source=item.get('content_source'),
            reading_time_min=item.get('reading_time_min'),
            captured_at=item.get('captured_at'),
        ))
        
    return SpaceArtifactsListResponse(
        artifacts=artifacts_list,
        count=pagination["total"],
        page=pagination["page"],
        page_size=pagination["limit"]
    )


@router.get("/{space_id}/alerts", response_model=SpaceAlertsResponse)
@limiter.limit("50/minute")
async def get_space_alerts(
    request: Request,
    space_id: int,
    current_user_id: str = Depends(get_current_user),
    client: Client = Depends(get_supabase_client)
):
    """
    Get alerts for a space based on recent activity patterns.
    
    Detects:
    - Low margin: Recent items with avg margin < 0.3
    - High drift: Drift events with magnitude > 0.3
    - Velocity drop: Current velocity < 50% of 30-day average
    - Confidence drop: Topics with confidence drop > 0.2/week
    
    Args:
        space_id: Space ID
        user_id: User ID (for ownership check)
        
    Returns:
        SpaceAlertsResponse with detected alerts
        
    Raises:
        Problem (404): If space not found
        Problem (500): If query fails
    """
    handler = SpaceHandler(client)
    
    # Check if space exists
    space = await handler.get(space_id, current_user_id)
    if space is None:
        raise Problem(
            status=404,
            title="Not Found",
            detail=f"Space with id {space_id} not found",
            type_="space-not-found"
        )
    
    alerts = []
    
    try:
        # 0. Check existing persistent insights
        try:
            stored_insights = (
                client.schema('misir')
                .from_('insight')
                .select('*')
                .eq('space_id', space_id)
                .eq('status', 'active')
                .execute()
            ).data or []
            
            for i in stored_insights:
                data = i.get('insight_data', {}) or {}
                alerts.append(SpaceAlert(
                    id=str(i['id']),
                    type=data.get('type', 'system'),
                    severity=i['severity'],
                    title=i['headline'],
                    message=i.get('description', ''),
                    affected_artifacts=data.get('affected_artifacts', []),
                    suggested_actions=[
                        AlertAction(label=a.get('label', 'View'), action=a.get('action', 'view'), target=a.get('target'))
                        for a in data.get('suggested_actions', [])
                    ],
                    space_id=space_id
                ))
        except Exception:
             pass

        if alerts:
            return SpaceAlertsResponse(alerts=alerts, count=len(alerts))
            
        # --- On-Demand Generation ---

        # 1. Low Margin (Optimized)
        recent_signals = (
            client.schema('misir')
            .from_('signal')
            .select('margin, artifact_id, created_at')
            .eq('space_id', space_id)
            .is_('deleted_at', 'null')
            .order('created_at', desc=True)
            .limit(10)
            .execute()
        ).data or []
        
        margins = [s['margin'] for s in recent_signals if s.get('margin') is not None]
        
        if len(margins) >= 3:
            avg_margin = sum(margins) / len(margins)
            if avg_margin < 0.3:
                # Fetch artifact titles for context
                affected_ids = [s['artifact_id'] for s in recent_signals if s.get('margin', 1.0) < 0.3][:5]
                alerts.append(SpaceAlert(
                    id=f"low-margin-{space_id}-{int(datetime.now().timestamp())}",
                    type="low_margin",
                    severity="warning",
                    title="Exploring new territory",
                    message="Your recent items don't fit neatly into existing topics. This usually means you're discovering something new.",
                    affected_artifacts=affected_ids,
                    suggested_actions=[
                        AlertAction(label="Create new topic", action="create_topic"),
                        AlertAction(label="Review items", action="review", target=f"/spaces/{space_id}/library?filter=low-margin")
                    ],
                    space_id=space_id
                ))
        
        # 2. High Drift (Last 7 days)
        seven_days_ago = (datetime.now() - timedelta(days=7)).isoformat()
        
        # Get subspaces to filter (needed for name lookup too)
        subspaces = (
            client.schema('misir')
            .from_('subspace')
            .select('id, name')
            .eq('space_id', space_id)
            .execute()
        ).data or []
        subspace_map = {s['id']: s['name'] for s in subspaces}
        
        if subspace_map:
            drift_events = (
                client.schema('misir')
                .from_('subspace_drift')
                .select('*')
                .in_('subspace_id', list(subspace_map.keys()))
                .gte('drift_magnitude', 0.3)
                .gte('occurred_at', seven_days_ago)
                .order('occurred_at', desc=True)
                .limit(3)
                .execute()
            ).data or []
            
            for drift in drift_events:
                # Get artifact that triggered drift
                artifact_id = None
                if drift.get('trigger_signal_id'):
                    try:
                        sig_res = client.schema('misir').from_('signal').select('artifact_id').eq('id', drift['trigger_signal_id']).execute()
                        if sig_res.data:
                            artifact_id = sig_res.data[0]['artifact_id']
                    except Exception:
                        pass
                
                alerts.append(SpaceAlert(
                    id=f"drift-{drift['id']}",
                    type="high_drift",
                    severity="info",
                    title="Focus is shifting",
                    message=f"Your understanding of '{subspace_map.get(drift['subspace_id'], 'Topic')}' evolved significantly.",
                    affected_artifacts=[artifact_id] if artifact_id else [],
                    suggested_actions=[
                        AlertAction(label="See what changed", action="review", target=f"/spaces/{space_id}/map")
                    ],
                    space_id=space_id
                ))
                
        # 3. Velocity Drop
        # Compare last 7 days vs last 30 days
        if subspace_map:
            thirty_days_ago = (datetime.now() - timedelta(days=30)).isoformat()
            
            try:
                # Fetch all velocity entries for these subspaces in last 30 days
                velocity_data = (
                    client.schema('misir')
                    .from_('subspace_velocity')
                    .select('velocity, measured_at')
                    .in_('subspace_id', list(subspace_map.keys()))
                    .gte('measured_at', thirty_days_ago)
                    .execute()
                ).data or []
                
                if velocity_data:
                    # Parse dates and values
                    now = datetime.now(timezone.utc) if velocity_data and velocity_data[0]['measured_at'].endswith('Z') else datetime.now()
                    
                    all_velocities = [v['velocity'] for v in velocity_data]
                    avg_30d = sum(all_velocities) / len(all_velocities) if all_velocities else 0
                    
                    # 7d Avg
                    recent_velocities = []
                    for v in velocity_data:
                        try:
                            # Handle ISO format potentially with Z or offset
                            dt_str = v['measured_at'].replace('Z', '+00:00')
                            dt = datetime.fromisoformat(dt_str)
                             # Ensure aware vs naive comparison works
                            if dt.tzinfo is None:
                                dt = dt.replace(tzinfo=None) 
                                diff = (datetime.now() - dt).days
                            else:
                                diff = (datetime.now(dt.tzinfo) - dt).days
                                
                            if diff <= 7:
                                recent_velocities.append(v['velocity'])
                        except ValueError:
                            continue
                            
                    avg_7d = sum(recent_velocities) / len(recent_velocities) if recent_velocities else 0
                    
                    if avg_30d > 2.0 and avg_7d < (avg_30d * 0.5):
                        alerts.append(SpaceAlert(
                            id=f"velocity-drop-{space_id}",
                            type="velocity_drop",
                            severity="info",
                            title="You've slowed down",
                            message=f"You're collecting {avg_7d:.1f} items/week, down from your usual {avg_30d:.1f}.",
                            affected_artifacts=[],
                            suggested_actions=[],
                            space_id=space_id
                        ))
            except Exception as e:
                 logger.warning(f"Velocity check failed: {e}")
                 
        # 4. Confidence Drop
        try:
             seven_days_ago = (datetime.now() - timedelta(days=7)).isoformat()
             subspace_ids_list = list(subspace_map.keys())
             if subspace_ids_list:
                 current_subs = (
                    client.schema('misir')
                    .from_('subspace')
                    .select('id, name, confidence')
                    .in_('id', subspace_ids_list)
                    .execute()
                 ).data or []
                 
                 for sub in current_subs:
                     hist_res = (
                         client.schema('misir')
                         .from_('subspace_centroid_history')
                         .select('confidence')
                         .eq('subspace_id', sub['id'])
                         .lte('computed_at', seven_days_ago)
                         .order('computed_at', desc=True)
                         .limit(1)
                         .execute()
                     )
                     
                     if hist_res.data:
                         prev_conf = hist_res.data[0]['confidence']
                         curr_conf = sub.get('confidence', 0.0)
                         
                         if curr_conf < (prev_conf - 0.2):
                             alerts.append(SpaceAlert(
                                id=f"conf-drop-{sub['id']}",
                                type="confidence_drop",
                                severity="warning",
                                title="Topic is getting messy",
                                message=f"Recent reads in '{sub['name']}' cover very different angles.",
                                affected_artifacts=[],
                                suggested_actions=[AlertAction(label="Split topic", action="split_topic")],
                                space_id=space_id
                            ))
        except Exception as e:
            logger.warning(f"Confidence check failed: {e}")

        return SpaceAlertsResponse(
            alerts=alerts,
            count=len(alerts)
        )
        
    except Exception as e:
        logger.error(f"Failed to get alerts for space {space_id}: {e}", exc_info=e)
        raise Problem(
            status=500,
            title="Query Failed",
            detail="Failed to retrieve alerts",
            type_="query-error"
        )
