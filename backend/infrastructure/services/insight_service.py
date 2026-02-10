"""
Insight Service — Generates actionable intelligence from space activity.

Analyzes patterns in:
- Velocity (rapid learning)
- Stagnation (forgotten spaces)
- Drift (changing topics)
- Density (overloaded subspaces)
"""
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from supabase import Client

from core.logging_config import get_logger
from domain.entities.models import Space, Insight

logger = get_logger(__name__)

class InsightService:
    def __init__(self, client: Client):
        self.client = client

    async def generate_insights_for_user(self, user_id: str) -> List[dict]:
        """
        Run all analysis rules for a user and insert new insights.
        Returns list of generated insights.
        """
        generated = []
        
        # 1. Fetch all spaces for user
        spaces_resp = self.client.schema("misir").table("space").select("*").eq("user_id", user_id).execute()
        spaces = spaces_resp.data
        
        for space in spaces:
            # Analyze each space
            result = await self._analyze_space(space, user_id)
            if result:
                generated.extend(result)
        
        return generated

    async def _analyze_space(self, space: dict, user_id: str) -> List[dict]:
        insights = []
        space_id = space["id"]
        
        # Fetch stats
        # Check last artifact time
        artifacts_resp = self.client.schema("misir").table("artifact")\
            .select("created_at")\
            .eq("space_id", space_id)\
            .order("created_at", desc=True)\
            .limit(1)\
            .execute()
            
        last_artifact_time = None
        if artifacts_resp.data:
            last_artifact_time = datetime.fromisoformat(artifacts_resp.data[0]["created_at"].replace('Z', '+00:00'))
            
        # Rule 1: Stagnation (No activity for 14 days)
        if last_artifact_time:
            days_inactive = (datetime.now(timezone.utc) - last_artifact_time).days
            if days_inactive > 14:
                insights.append({
                    "user_id": user_id,
                    "space_id": space_id,
                    "headline": f"Space '{space['name']}' is stagnating",
                    "description": f"No new artifacts captured in {days_inactive} days. Consider reviewing or archiving.",
                    "severity": "low",
                    "insight_data": {"days_inactive": days_inactive}
                })

        # Rule 2: High Velocity (More than 5 items in 24h)
        # We need a generic count query for last 24h
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        recent_count_resp = self.client.table("artifact")\
            .select("id", count="exact")\
            .eq("space_id", space_id)\
            .gte("created_at", yesterday)\
            .execute()
            
        recent_count = recent_count_resp.count or 0
        if recent_count >= 5:
            insights.append({
                "user_id": user_id,
                "space_id": space_id,
                "headline": f"High velocity in '{space['name']}'",
                "description": f"You captured {recent_count} items recently. A new subspace might be forming.",
                "severity": "medium",
                "insight_data": {"recent_count": recent_count}
            })

        # Insert insights if they don't already exist (deduplication logic needed in real prod)
        # For v1, we just insert.
        created_insights = []
        for i in insights:
            # Simple check to avoid spamming the same insight today
            # (In production, use a hash or dedicated logic)
            res = self.client.schema("misir").table("insight").insert(i).execute()
            if res.data:
                created_insights.append(res.data[0])
                
        return created_insights
