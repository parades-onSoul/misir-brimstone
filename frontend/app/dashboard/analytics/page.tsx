'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/use-auth';
import { useSpaces } from '@/lib/api/spaces';
import { useSpaceAnalytics } from '@/lib/api/analytics';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    StateDistributionBar,
    ActivitySparkline,
    ConcentrationIndicator,
    DomainBar,
} from '@/components/report/report-visuals';
import { ActivityHeatmap } from '@/components/dashboard/activity-heatmap';
import { 
    BarChart3, 
    TrendingUp, 
    Activity, 
    FileText, 
    Layers, 
    Globe, 
    Calendar 
} from 'lucide-react';
import type { SpaceResponse } from '@/types/api';

type Period = 'daily' | 'weekly' | 'monthly';

export default function AnalyticsPage() {
    const { user } = useAuth();
    const { data: spaces, isLoading } = useSpaces(user?.id);
    const [period, setPeriod] = useState<Period>('weekly');
    const [selectedSpaceId, setSelectedSpaceId] = useState<string>('all');

    const { data: analyticsResult, isLoading: isAnalyticsLoading } = useSpaceAnalytics(
        selectedSpaceId !== 'all' ? parseInt(selectedSpaceId) : undefined,
        user?.id
    );

    // Aggregate data (Global or Specific)
    const displayData = useMemo(() => {
        if (selectedSpaceId !== 'all' && analyticsResult) {
            return {
                totalArtifacts: analyticsResult.total_artifacts,
                engagement: analyticsResult.engagement_distribution,
                topDomains: analyticsResult.top_domains,
                // activity: analyticsResult.activity_level 
            };
        }
        
        // Fallback: Aggregate from spaces list (Mock/Heuristic for global view)
        const total = spaces?.spaces.reduce((sum, s) => sum + s.artifact_count, 0) ?? 0;
        return {
            totalArtifacts: total,
            engagement: {
                latent: Math.floor(total * 0.4),
                discovered: Math.floor(total * 0.25),
                engaged: Math.floor(total * 0.25),
                saturated: Math.floor(total * 0.1),
            },
            topDomains: total > 0 ? [
                { domain: 'github.com', count: Math.floor(total * 0.25) || 0 },
                { domain: 'arxiv.org', count: Math.floor(total * 0.15) || 0 },
            ] : []
        };
    }, [spaces, selectedSpaceId, analyticsResult]);

    // Derived values for UI
    const totalArtifacts = displayData.totalArtifacts;
    const engagementDistribution = displayData.engagement;
    const topDomains = displayData.topDomains;
    const spacesCount = spaces?.count ?? 0;
    
    // Mock velocity/drift for now (until API provides it in v1.1)
    const velocityScore = totalArtifacts > 0 ? Math.min(100, (totalArtifacts / 50) * 100) : 0;
    const driftScore = totalArtifacts > 5 ? 65 : 20;
    const confidenceScore = totalArtifacts > 10 ? 80 : 40;

    // Stable heatmap data (seeded from totalArtifacts so it doesn't flicker)
    const heatmapData = useMemo(() => {
        const now = new Date();
        const baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return Array.from({ length: 90 }, (_, i) => {
            const d = new Date(baseDate.getTime() - (89 - i) * 86400000);
            // Deterministic pseudo-random from day index + totalArtifacts
            const seed = ((i * 7 + totalArtifacts * 3) % 11);
            return {
                date: d.toISOString().split('T')[0],
                count: seed > 7 ? 0 : seed,
            };
        });
    }, [totalArtifacts]);

    return (
        <div className="min-h-full w-full bg-[#0B0C0E] text-[#EEEEF0]">
            
            {/* 1. Header (Sticky) */}
            <header className="h-12 flex items-center justify-between px-6 border-b border-white/5 bg-[#0B0C0E]/80 backdrop-blur-md sticky top-0 z-10">
                <nav className="flex items-center gap-2 text-[13px]">
                    <BarChart3 className="size-4 text-[#8A8F98]" strokeWidth={1.5} />
                    <span className="text-[#8A8F98]">Dashboard</span>
                    <span className="text-[#5F646D]">/</span>
                    <span className="text-[#EEEEF0] font-medium">Analytics</span>

                    {/* Space Selector */}
                    <div className="ml-4 w-40">
                        <Select value={selectedSpaceId} onValueChange={setSelectedSpaceId}>
                            <SelectTrigger className="h-7 text-xs bg-[#141517] border-white/10 hover:border-white/20 transition-colors">
                                <SelectValue placeholder="Select space" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Spaces</SelectItem>
                                {spaces?.spaces.map((space) => (
                                    <SelectItem key={space.id} value={String(space.id)}>
                                        {space.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </nav>

                <div className="flex items-center gap-1 bg-[#141517] rounded-md border border-white/5 p-0.5">
                    {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`
                                h-6 px-2.5 text-[11px] font-medium rounded capitalize transition-all
                                ${period === p 
                                    ? 'bg-[#5E6AD2]/10 text-[#5E6AD2]' 
                                    : 'text-[#8A8F98] hover:text-[#EEEEF0] hover:bg-white/[0.02]'
                                }
                            `}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </header>

            {/* 2. Content Canvas */}
            <div className="p-6 space-y-6">
                
                {isLoading ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="h-24 rounded-lg bg-[#141517] animate-pulse border border-white/5" />
                        ))}
                    </div>
                ) : (
                    <>
                        {/* Stats Row */}
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <StatBox
                                label="Total Artifacts"
                                value={totalArtifacts}
                                change="+12 this week"
                                trend="up"
                                icon={FileText}
                            />
                            <StatBox
                                label="Active Spaces"
                                value={spacesCount}
                                change={`${spacesCount} total`}
                                trend="neutral"
                                icon={Layers}
                            />
                            <StatBox
                                label="Avg. Engagement"
                                value={totalArtifacts > 0 ? 'Engaged' : '—'}
                                change="Steady"
                                trend="neutral"
                                icon={Activity}
                            />
                            <StatBox
                                label="Domains Tracked"
                                value={topDomains.length}
                                change="+2 new"
                                trend="up"
                                icon={Globe}
                            />
                        </div>

                        {/* Core Metrics: Drift, Velocity, Confidence */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                            className="bg-[#141517] border border-white/5 rounded-lg p-5"
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <TrendingUp className="size-4 text-[#5E6AD2]" strokeWidth={1.5} />
                                <h3 className="text-[13px] font-medium text-[#EEEEF0]">Core Knowledge Metrics</h3>
                            </div>
                            <p className="text-[11px] text-[#8A8F98] mb-6">Drift, velocity, and confidence scores</p>
                            
                            <div className="space-y-6">
                                <MetricRow label="Velocity" value={velocityScore} desc="Rate of knowledge acquisition over time" />
                                <MetricRow label="Drift" value={driftScore} desc="Measure of attention shift between topics" />
                                <MetricRow label="Confidence" value={confidenceScore} desc="Reliability score for knowledge signals" />
                            </div>
                        </motion.div>

                        {/* Main Content Grid */}
                        <div className="grid gap-6 lg:grid-cols-3">
                            
                            {/* Activity Heatmap - Full Width */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="lg:col-span-3 bg-[#141517] border border-white/5 rounded-lg overflow-hidden"
                            >
                                <div className="h-10 flex items-center px-4 border-b border-white/5 bg-[#141517]">
                                    <h3 className="text-[11px] font-medium text-[#5F646D] uppercase tracking-wider">Activity</h3>
                                </div>
                                <div className="p-4">
                                     <ActivityHeatmap data={heatmapData} />
                                </div>
                            </motion.div>

                            {/* Engagement Distribution */}
                            <div className="lg:col-span-2 bg-[#141517] border border-white/5 rounded-lg overflow-hidden">
                                <div className="h-10 flex items-center px-4 border-b border-white/5 bg-[#141517]">
                                    <h3 className="text-[11px] font-medium text-[#5F646D] uppercase tracking-wider">Engagement Distribution</h3>
                                </div>
                                <div className="p-5">
                                    <StateDistributionBar distribution={engagementDistribution} />
                                    <div className="mt-6 grid grid-cols-4 gap-4">
                                        <ConcentrationIndicator
                                            value={totalArtifacts > 0 ? engagementDistribution.saturated / totalArtifacts : 0}
                                            label="Saturated"
                                        />
                                        <ConcentrationIndicator
                                            value={totalArtifacts > 0 ? engagementDistribution.engaged / totalArtifacts : 0}
                                            label="Engaged"
                                        />
                                        <ConcentrationIndicator
                                            value={totalArtifacts > 0 ? engagementDistribution.discovered / totalArtifacts : 0}
                                            label="Discovered"
                                        />
                                        <ConcentrationIndicator
                                            value={totalArtifacts > 0 ? engagementDistribution.latent / totalArtifacts : 0}
                                            label="Latent"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Top Domains */}
                            <div className="bg-[#141517] border border-white/5 rounded-lg overflow-hidden h-full">
                                <div className="h-10 flex items-center px-4 border-b border-white/5 bg-[#141517]">
                                    <h3 className="text-[11px] font-medium text-[#5F646D] uppercase tracking-wider">Top Sources</h3>
                                </div>
                                <div className="p-4">
                                    <DomainBar domains={topDomains} />
                                </div>
                            </div>

                            {/* Spaces Overview */}
                            <div className="lg:col-span-3 bg-[#141517] border border-white/5 rounded-lg overflow-hidden">
                                <div className="h-10 flex items-center px-4 border-b border-white/5 bg-[#141517]">
                                    <h3 className="text-[11px] font-medium text-[#5F646D] uppercase tracking-wider">Spaces Overview</h3>
                                </div>
                                <div className="p-4">
                                    {spaces && spaces.count > 0 ? (
                                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                            {spaces.spaces.map((space: SpaceResponse, i: number) => (
                                                <motion.div
                                                    key={space.id}
                                                    initial={{ opacity: 0, scale: 0.95 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ delay: 0.2 + i * 0.05 }}
                                                    className="flex items-center gap-3 rounded border border-white/10 bg-white/[0.02] p-3 hover:bg-white/[0.04] transition-colors"
                                                >
                                                    <div className="flex h-8 w-8 items-center justify-center rounded bg-[#5E6AD2]/10 text-xs font-medium text-[#5E6AD2]">
                                                        {space.name[0].toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-[13px] font-medium text-[#EEEEF0] truncate">{space.name}</div>
                                                        <div className="text-[11px] text-[#8A8F98]">
                                                            {space.artifact_count} artifact{space.artifact_count !== 1 ? 's' : ''}
                                                        </div>
                                                    </div>
                                                    <ActivitySparkline
                                                        data={Array.from({ length: 7 }, () => Math.floor(Math.random() * 5))}
                                                        height={20}
                                                        className="opacity-40"
                                                    />
                                                </motion.div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-[#5F646D] text-[13px]">
                                            No spaces yet. Create one to start tracking.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// --- Helper Components ---

const StatBox = ({ label, value, change, trend, icon: Icon }: any) => (
    <div className="bg-[#141517] border border-white/5 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-[#8A8F98] uppercase tracking-wide">{label}</span>
            <Icon className="size-3.5 text-[#5F646D]" strokeWidth={1.5} />
        </div>
        <div className="flex items-end justify-between">
            <div className="text-2xl font-semibold text-[#EEEEF0] tracking-tight">{value}</div>
            <div className={`text-[11px] font-medium ${trend === 'up' ? 'text-emerald-500' : 'text-[#8A8F98]'}`}>
                {change}
            </div>
        </div>
    </div>
);

const MetricRow = ({ label, value, desc }: any) => (
    <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[13px]">
            <span className="font-medium text-[#EEEEF0]">{label}</span>
            <span className="text-[#8A8F98] font-mono">{value.toFixed(0)}%</span>
        </div>
        <Progress value={value} className="h-1.5 bg-white/5" />
        <p className="text-[11px] text-[#5F646D]">{desc}</p>
    </div>
);
