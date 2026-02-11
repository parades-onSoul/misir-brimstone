'use client';

import { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { CHART_COLORS } from '@/lib/colors';

interface Artifact {
    id: number;
    space_id: number;
    created_at: string;
}

interface Space {
    id: number;
    name: string;
}

interface ActivityChartProps {
    artifacts: Artifact[];
    spaces: Space[];
}

export function ActivityChart({ artifacts, spaces }: ActivityChartProps) {
    const chartData = useMemo(() => {
        // Get last 30 days
        const today = new Date();
        const days: { date: Date; label: string; counts: Map<number, number> }[] = [];
        
        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);
            
            days.push({
                date,
                label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                counts: new Map()
            });
        }
        
        // Count artifacts per day per space
        artifacts.forEach(artifact => {
            const artifactDate = new Date(artifact.created_at);
            artifactDate.setHours(0, 0, 0, 0);
            
            const dayIndex = days.findIndex(d => d.date.getTime() === artifactDate.getTime());
            if (dayIndex !== -1) {
                const currentCount = days[dayIndex].counts.get(artifact.space_id) || 0;
                days[dayIndex].counts.set(artifact.space_id, currentCount + 1);
            }
        });
        
        // Calculate totals
        const totalCounts = days.map(d => {
            let total = 0;
            d.counts.forEach(count => total += count);
            return total;
        });
        
        const maxCount = Math.max(...totalCounts, 1);
        
        return { days, maxCount };
    }, [artifacts]);
    
    // Get top 5 spaces by artifact count + "Other"
    const topSpaces = useMemo(() => {
        const spaceCounts = new Map<number, number>();
        
        artifacts.forEach(artifact => {
            const count = spaceCounts.get(artifact.space_id) || 0;
            spaceCounts.set(artifact.space_id, count + 1);
        });
        
        const sorted = Array.from(spaceCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([spaceId]) => spaces.find(s => s.id === spaceId))
            .filter(Boolean) as Space[];
        
        return sorted;
    }, [artifacts, spaces]);
    
    // Calculate this week's summary
    const thisWeekCount = useMemo(() => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        
        return artifacts.filter(a => new Date(a.created_at) >= sevenDaysAgo).length;
    }, [artifacts]);
    
    const uniqueSpacesThisWeek = useMemo(() => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        
        const spaceIds = new Set(
            artifacts
                .filter(a => new Date(a.created_at) >= sevenDaysAgo)
                .map(a => a.space_id)
        );
        return spaceIds.size;
    }, [artifacts]);
    
    return (
        <div className="space-y-4">
            {/* Weekly Summary */}
            <div className="flex items-center gap-2 text-[13px] text-[#EEEEF0] bg-white/2 px-4 py-3 rounded-lg border border-white/5">
                <TrendingUp className="size-4 text-emerald-500" />
                <span>
                    This week: <span className="font-medium">{thisWeekCount} items</span> saved across{' '}
                    <span className="font-medium">{uniqueSpacesThisWeek} {uniqueSpacesThisWeek === 1 ? 'space' : 'spaces'}</span>
                </span>
            </div>
            
            {/* Chart */}
            <div className="bg-[#141517] border border-white/5 rounded-lg p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-[13px] font-medium text-[#EEEEF0]">30-Day Activity</h3>
                    
                    {/* Legend */}
                    <div className="flex items-center gap-4 text-[11px]">
                        {topSpaces.slice(0, 5).map((space, idx) => {
                            const color = CHART_COLORS[idx];
                            return (
                                <div key={space.id} className="flex items-center gap-1.5">
                                    <div 
                                        className="size-2 rounded-full"
                                        style={{ backgroundColor: color }}
                                    />
                                    <span className="text-[#8A8F98]">{space.name}</span>
                                </div>
                            );
                        })}
                        {spaces.length > 5 && (
                            <div className="flex items-center gap-1.5">
                                <div className="size-2 rounded-full bg-gray-500" />
                                <span className="text-[#8A8F98]">Other</span>
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Bar Chart */}
                <div className="h-48 flex items-end gap-1">
                    {chartData.days.map((day, idx) => {
                        let totalCount = 0;
                        day.counts.forEach(count => totalCount += count);
                        
                        const heightPercent = chartData.maxCount > 0 
                            ? (totalCount / chartData.maxCount) * 100 
                            : 0;
                        
                        // Build stacked bars
                        const bars: { spaceId: number; count: number; color: string }[] = [];
                        
                        topSpaces.forEach((space, spaceIdx) => {
                            const count = day.counts.get(space.id) || 0;
                            if (count > 0) {
                                bars.push({
                                    spaceId: space.id,
                                    count,
                                    color: CHART_COLORS[spaceIdx]
                                });
                            }
                        });
                        
                        // Add "Other" category
                        let otherCount = 0;
                        day.counts.forEach((count, spaceId) => {
                            if (!topSpaces.some(s => s.id === spaceId)) {
                                otherCount += count;
                            }
                        });
                        if (otherCount > 0) {
                            bars.push({
                                spaceId: -1,
                                count: otherCount,
                                color: CHART_COLORS[5]
                            });
                        }
                        
                        return (
                            <div 
                                key={idx} 
                                className="flex-1 flex flex-col justify-end group relative"
                                style={{ height: '100%' }}
                            >
                                {/* Tooltip */}
                                {totalCount > 0 && (
                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#1A1B1E] border border-white/10 rounded px-2 py-1 text-[11px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                        <div className="font-medium text-[#EEEEF0] mb-1">{day.label}</div>
                                        <div className="text-[#8A8F98]">{totalCount} {totalCount === 1 ? 'item' : 'items'}</div>
                                    </div>
                                )}
                                
                                {/* Stacked Bar */}
                                <div 
                                    className="w-full rounded-t flex flex-col-reverse transition-all"
                                    style={{ 
                                        height: `${heightPercent}%`,
                                        minHeight: totalCount > 0 ? '4px' : '0px'
                                    }}
                                >
                                    {bars.map((bar, barIdx) => {
                                        const segmentHeight = (bar.count / totalCount) * 100;
                                        return (
                                            <div
                                                key={barIdx}
                                                style={{
                                                    height: `${segmentHeight}%`,
                                                    backgroundColor: bar.color
                                                }}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
                
                {/* X-axis labels (show every 5 days) */}
                <div className="flex mt-3 text-[10px] text-[#5F646D]">
                    {chartData.days.map((day, idx) => (
                        <div 
                            key={idx} 
                            className="flex-1 text-center"
                        >
                            {idx % 5 === 0 ? day.label : ''}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
