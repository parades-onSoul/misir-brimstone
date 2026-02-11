from dataclasses import dataclass
from typing import List, Dict, Optional
from datetime import datetime

@dataclass
class TimeAllocationItem:
    space_id: int
    space_name: str
    space_color: str
    minutes: int
    percentage: float

@dataclass
class HeatmapItem:
    date: str  # YYYY-MM-DD
    count: int

@dataclass
class WeaknessItem:
    id: int
    title: str
    space_name: str
    margin: float
    created_at: str

@dataclass
class PaceItem:
    space_name: str
    count: int
    trend: str # "up", "down", "stable"

@dataclass
class OverviewMetrics:
    total_artifacts: int
    active_spaces: int
    overall_focus: float # 0.0 to 1.0
    system_health: str # "Healthy", "Drifting", etc.

@dataclass
class GlobalAnalyticsResult:
    overview: OverviewMetrics
    time_allocation: List[TimeAllocationItem]
    activity_heatmap: List[HeatmapItem]
    weak_items: List[WeaknessItem]
    pace_by_space: List[PaceItem]
