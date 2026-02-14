'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api/client';
import { useAuth } from '@/hooks/use-auth';
import {
    FOCUS_CONFIDENCE_HIGH_THRESHOLD,
    FOCUS_CONFIDENCE_MEDIUM_THRESHOLD,
} from '@/lib/focus-thresholds';
import { ActivityHeatmap } from '@/components/dashboard/activity-heatmap';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { 
    TrendingUp, 
    PieChart, 
    Activity, 
    Zap, 
    AlertTriangle,
    Clock,
    Layers,
    ArrowUpRight
} from 'lucide-react';
import { 
    PieChart as RePieChart, 
    Pie, 
    Cell, 
    ResponsiveContainer, 
    Tooltip as ReTooltip,
    Legend
} from 'recharts';

export default function AnalyticsPage() {
    const { user } = useAuth();
    
    const { data: analytics, isLoading, error } = useQuery({
        queryKey: ['analytics', 'global', user?.id],
        queryFn: () => {
            if (!user?.id) throw new Error("User not authenticated");
            return api.analytics.global();
        },
        enabled: !!user?.id,
    });

    if (isLoading) {
        return <AnalyticsSkeleton />;
    }

    if (error) {
        return (
            <div className="p-8 text-center text-red-400">
                Failed to load analytics: {error instanceof Error ? error.message : 'Unknown error'}
            </div>
        );
    }

    if (!analytics) return null;

    const { overview, time_allocation, activity_heatmap, weak_items, pace_by_space } = analytics;

    return (
        <div className="min-h-full w-full bg-[#0B0C0E] text-[#EEEEF0] p-6 space-y-8">
            <div className="max-w-7xl mx-auto space-y-8">
                <div>
                    <h1 className="text-2xl font-semibold text-[#EEEEF0]">System Analytics</h1>
                    <p className="text-[14px] text-[#8A8F98] mt-1">Cross-space insights and performance metrics</p>
                </div>

                {/* 1. System Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <OverviewCard 
                        title="Total Items" 
                        value={overview.total_artifacts} 
                        icon={Layers} 
                        trend="+12% this week" // Placeholder
                    />
                    <OverviewCard 
                        title="Active Spaces" 
                        value={overview.active_spaces} 
                        icon={Zap} 
                    />
                    <OverviewCard 
                        title="Overall Focus" 
                        value={`${Math.round(overview.overall_focus * 100)}%`} 
                        icon={TrendingUp}
                        // Helper to show color based on score
                        color={
                            overview.overall_focus > FOCUS_CONFIDENCE_HIGH_THRESHOLD
                                ? "text-green-400"
                                : (overview.overall_focus < FOCUS_CONFIDENCE_MEDIUM_THRESHOLD ? "text-red-400" : "text-amber-400")
                        }
                    />
                    <OverviewCard 
                        title="System Health" 
                        value={overview.system_health} 
                        icon={Activity} 
                        valueSize="text-2xl"
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 2. Time Allocation (Pie Chart) */}
                    <Card className="bg-[#141517] border-white/5 lg:col-span-1">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <PieChart className="size-4 text-primary" />
                                Time Allocation
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="h-75">
                            {time_allocation.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <RePieChart>
                                        <Pie
                                            data={time_allocation}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="minutes"
                                        >
                                            {time_allocation.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.space_color} stroke="none" />
                                            ))}
                                        </Pie>
                                        <ReTooltip 
                                            contentStyle={{ backgroundColor: '#1A1B1E', border: '1px solid #2C2D31' }}
                                            itemStyle={{ color: '#EEEEF0' }}
                                        />
                                        <Legend 
                                            layout="horizontal" 
                                            verticalAlign="bottom" 
                                            align="center"
                                            wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
                                        />
                                    </RePieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                                    No reading data available
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* 3. Activity Heatmap */}
                    <Card className="bg-[#141517] border-white/5 lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Activity className="size-4 text-green-400" />
                                Activity Heatmap (90 Days)
                            </CardTitle>
                            <CardDescription>Daily item capture volume</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-center p-4">
                                <ActivityHeatmap data={activity_heatmap} />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 4. Cross-space Weak Items */}
                    <Card className="bg-[#141517] border-white/5">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base text-amber-400">
                                <AlertTriangle className="size-4" />
                                Weak Connections (Low Margin)
                            </CardTitle>
                            <CardDescription>Items that don&apos;t fit well in their spaces</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {weak_items.length === 0 ? (
                                <p className="text-sm text-muted-foreground">All items are well-placed!</p>
                            ) : (
                                weak_items.map(item => (
                                    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-white/2 border border-white/5">
                                        <div className="flex-1 min-w-0 mr-4">
                                            <div className="text-sm font-medium text-[#EEEEF0] truncate">{item.title}</div>
                                            <div className="text-xs text-[#8A8F98] flex items-center gap-2 mt-1">
                                                <span>in {item.space_name}</span>
                                                <span className="text-white/10">•</span>
                                                <span>{new Date(item.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-mono text-amber-400 bg-amber-400/10 px-2 py-1 rounded">
                                                Fit: {(item.margin).toFixed(2)}
                                            </span>
                                            <a href={`/dashboard/artifacts/${item.id}`} className="p-2 hover:bg-white/5 rounded text-muted-foreground hover:text-white transition-colors">
                                                <ArrowUpRight className="size-4" />
                                            </a>
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    {/* 5. Pace by Space */}
                    <Card className="bg-[#141517] border-white/5">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Clock className="size-4 text-blue-400" />
                                Week&apos;s Pace by Space
                            </CardTitle>
                            <CardDescription>Items captured in last 7 days</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             {pace_by_space.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No recent activity</p>
                            ) : (
                                pace_by_space.map((item) => (
                                    <div key={item.space_name} className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-[#EEEEF0]">{item.space_name}</span>
                                            <span className="text-[#8A8F98]">{item.count} items</span>
                                        </div>
                                        <Progress value={Math.min(item.count * 10, 100)} className="h-1.5" />
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

interface OverviewCardProps {
    title: string;
    value: string | number;
    icon: React.ElementType;
    trend?: string;
    color?: string;
    valueSize?: string;
}

function OverviewCard({ title, value, icon: Icon, trend, color, valueSize = "text-3xl" }: OverviewCardProps) {
    return (
        <Card className="bg-[#141517] border-white/5">
            <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-[#8A8F98]">{title}</span>
                    <Icon className={`size-4 ${color || "text-[#5F646D]"}`} />
                </div>
                <div className={`font-bold text-[#EEEEF0] ${valueSize}`}>
                    {value}
                </div>
                {trend && (
                    <p className="text-xs text-green-400 mt-2 font-medium">
                        {trend}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

function AnalyticsSkeleton() {
    return (
        <div className="p-6 space-y-8 max-w-7xl mx-auto">
            <Skeleton className="h-10 w-48" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
            </div>
            <div className="grid grid-cols-3 gap-6">
                <Skeleton className="h-80 col-span-1" />
                <Skeleton className="h-80 col-span-2" />
            </div>
        </div>
    );
}
