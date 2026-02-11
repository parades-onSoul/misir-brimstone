"""
Analytics Handler — Use cases for global analytics.
"""
from datetime import datetime, timedelta
from typing import List, Dict
from collections import Counter, defaultdict
import logging

from supabase import Client
from domain.value_objects.analytics import (
    GlobalAnalyticsResult, OverviewMetrics, TimeAllocationItem, 
    HeatmapItem, WeaknessItem, PaceItem
)

logger = logging.getLogger(__name__)

class AnalyticsHandler:
    def __init__(self, client: Client):
        self._client = client

    async def get_global_analytics(self, user_id: str) -> GlobalAnalyticsResult:
        logger.info(f"Generating global analytics for user {user_id[:8]}...")
        
        # 1. Fetch all artifacts (lightweight fetch for stats)
        # We need: space_id, created_at, word_count, margin, engagement_level
        # Limit 2000 for performance in v1
        response = (
            self._client.schema('misir')
            .from_('artifact')
            .select('id, title, space_id, created_at, word_count, margin, engagement_level')
            .eq('user_id', user_id)
            .is_('deleted_at', 'null')
            .order('created_at', desc=True)
            .limit(2000)
            .execute()
        )
        artifacts = response.data or []
        
        # 2. Fetch Spaces (for names and colors)
        space_res = (
            self._client.schema('misir')
            .from_('space')
            .select('id, name, settings')
            .eq('user_id', user_id)
            .execute()
        )
        spaces = {s['id']: s for s in (space_res.data or [])}
        
        # --- CALCULATIONS ---
        
        # A. Overview
        total_artifacts = len(artifacts)
        active_space_ids = set(a['space_id'] for a in artifacts if a['space_id'])
        active_spaces = len(active_space_ids)
        
        # Calculate overall focus (avg margin)
        margins = [a['margin'] for a in artifacts if a.get('margin') is not None]
        overall_focus = sum(margins) / len(margins) if margins else 0.0
        
        system_health = "Healthy"
        if overall_focus < 0.3:
            system_health = "Drifting"
        elif overall_focus > 0.7:
            system_health = "Optimized"
            
        overview = OverviewMetrics(
            total_artifacts=total_artifacts,
            active_spaces=active_spaces,
            overall_focus=overall_focus,
            system_health=system_health
        )
        
        # B. Time Allocation
        time_by_space: Dict[int, int] = defaultdict(int)
        total_minutes = 0
        
        for a in artifacts:
            # Estimate reading time from word count (avg 200 wpm)
            wc = a.get('word_count') or 0
            if wc > 0:
                t = max(1, round(wc / 200))
            else:
                t = 5 # Default 5 min if missing
            
            sid = a.get('space_id')
            if sid:
                time_by_space[sid] += t
                total_minutes += t
                
        time_allocation = []
        for sid, mins in time_by_space.items():
            space = spaces.get(sid)
            if space:
                # Get color from settings or default
                color = space.get('settings', {}).get('color', '#5E6AD2')
                percentage = (mins / total_minutes * 100) if total_minutes > 0 else 0
                time_allocation.append(TimeAllocationItem(
                    space_id=sid,
                    space_name=space['name'],
                    space_color=color,
                    minutes=mins,
                    percentage=round(percentage, 1)
                ))
        
        # Sort by minutes desc
        time_allocation.sort(key=lambda x: x.minutes, reverse=True)
        
        # C. Activity Heatmap
        # Group by YYYY-MM-DD
        activity_counts: Dict[str, int] = defaultdict(int)
        for a in artifacts:
            # created_at is ISO string
            date_str = a['created_at'].split('T')[0]
            activity_counts[date_str] += 1
            
        activity_heatmap = [
            HeatmapItem(date=d, count=c) 
            for d, c in activity_counts.items()
        ]
        
        # D. Weak Items (margin < 0.3)
        weak_items = []
        for a in artifacts:
            if a.get('margin') is not None and a['margin'] < 0.3:
                sid = a.get('space_id')
                sname = spaces.get(sid, {}).get('name', 'Unknown')
                weak_items.append(WeaknessItem(
                    id=a['id'],
                    title=a['title'] or "Untitled",
                    space_name=sname,
                    margin=a['margin'],
                    created_at=a['created_at']
                ))
        # Top 10 most recent weak items
        weak_items = weak_items[:10]
        
        # E. Pace by Space (Last 7 days)
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        seven_days_ago_iso = seven_days_ago.isoformat()
        
        pace_counts: Dict[int, int] = defaultdict(int)
        for a in artifacts:
            if a['created_at'] >= seven_days_ago_iso:
                sid = a.get('space_id')
                if sid:
                    pace_counts[sid] += 1
                    
        pace_by_space = []
        for sid, count in pace_counts.items():
            space = spaces.get(sid)
            if space:
                pace_by_space.append(PaceItem(
                    space_name=space['name'],
                    count=count,
                    trend="stable" # Placeholder logic for trend
                ))
        
        return GlobalAnalyticsResult(
            overview=overview,
            time_allocation=time_allocation,
            activity_heatmap=activity_heatmap,
            weak_items=weak_items,
            pace_by_space=pace_by_space
        )
