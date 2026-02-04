'use client';

import { useMemo, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Target, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { getStateFromEvidence, STATE_THRESHOLDS } from '@/lib/math';
import type { Space } from '@/lib/types';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

interface SpaceOverviewSidebarProps {
    space: Space | null;
    isLoading?: boolean;
}

interface RecentArtifact {
    id: string;
    title: string;
    subspace_name: string | null;
    created_at: string;
}

interface TrendData {
    values: number[];
    change: number;
    topMover: string | null;
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
}

// ─────────────────────────────────────────────────────────────────
// Sparkline Component
// ─────────────────────────────────────────────────────────────────

function Sparkline({ values, className }: { values: number[]; className?: string }) {
    if (!values.length) return null;

    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;

    const points = values.map((v, i) => {
        const x = (i / (values.length - 1)) * 100;
        const y = 100 - ((v - min) / range) * 100;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={cn("h-6 w-full", className)}>
            <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
            />
        </svg>
    );
}

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────

export function SpaceOverviewSidebar({ space, isLoading }: SpaceOverviewSidebarProps) {
    const [recentArtifacts, setRecentArtifacts] = useState<RecentArtifact[]>([]);
    const [trendData, setTrendData] = useState<TrendData | null>(null);
    const [loading, setLoading] = useState(true);
    const isSeriesADueDiligence = (space?.name || '').toLowerCase() === 'series a due diligence';

    // Fetch recent artifacts and snapshots
    useEffect(() => {
        if (!space?.id) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch recent artifacts
                const artifactsRes = await fetch(`/api/artifacts?spaceId=${space.id}`);
                if (artifactsRes.ok) {
                    const data = await artifactsRes.json();
                    // Take last 5, sorted by created_at desc
                    const sorted = (data.artifacts || [])
                        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .slice(0, 5);
                    setRecentArtifacts(sorted);
                }

                // Fetch snapshots for trend
                const snapshotsRes = await fetch(`/api/snapshots?spaceId=${space.id}&period=7d`);
                if (snapshotsRes.ok) {
                    const data = await snapshotsRes.json();
                    const snapshots = data.snapshots || [];

                    if (snapshots.length > 1) {
                        // Extract total evidence per day
                        const values = snapshots.map((s: any) => {
                            const spaceData = s.data?.spaces?.[0];
                            if (!spaceData) return 0;
                            return spaceData.subspaces?.reduce((sum: number, sub: any) => sum + (sub.evidence || 0), 0) || 0;
                        });

                        // Calculate change
                        const first = values[0] || 0;
                        const last = values[values.length - 1] || 0;
                        const change = first > 0 ? Math.round(((last - first) / first) * 100) : 0;

                        // Find top mover (subspace with most growth)
                        const latestSnapshot = snapshots[snapshots.length - 1];
                        const spaceData = latestSnapshot?.data?.spaces?.[0];
                        const topMover = spaceData?.subspaces?.sort((a: any, b: any) => (b.evidence || 0) - (a.evidence || 0))[0]?.name || null;

                        setTrendData({ values, change, topMover });
                    }
                }
            } catch (err) {
                console.error('Failed to fetch sidebar data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [space?.id]);

    // Calculate focus recommendation (latent subspaces with potential)
    const focusRecommendation = useMemo(() => {
        if (!space?.subspaces) return null;

        // Find latent subspaces (evidence < THETA_1)
        const latent = space.subspaces
            .filter(s => (s.evidence || 0) < STATE_THRESHOLDS.THETA_1)
            .sort((a, b) => (b.evidence || 0) - (a.evidence || 0));

        if (latent.length === 0) return null;

        const target = latent[0];
        const hasActivity = (target.evidence || 0) > 0;

        return {
            name: target.name,
            reason: hasActivity
                ? "Started but needs more exploration"
                : "Defined but no content captured yet"
        };
    }, [space?.subspaces]);

    // Loading state
    if (isLoading || !space) {
        return (
            <div className="h-full p-5 space-y-6">
                <div className="space-y-2">
                    <div className="h-3 w-16 bg-muted/40 rounded animate-pulse" />
                    <div className="h-16 w-full bg-muted/30 rounded animate-pulse" />
                </div>
                <div className="space-y-2">
                    <div className="h-3 w-16 bg-muted/40 rounded animate-pulse" />
                    <div className="h-12 w-full bg-muted/30 rounded animate-pulse" />
                </div>
                <div className="space-y-2">
                    <div className="h-3 w-16 bg-muted/40 rounded animate-pulse" />
                    <div className="h-32 w-full bg-muted/30 rounded animate-pulse" />
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto p-5 bg-background">
            <div className="space-y-6">

                {isSeriesADueDiligence && (
                    <section>
                        <div className="flex items-center gap-1.5 mb-2">
                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                                Project
                            </span>
                        </div>
                        <div className="p-3 rounded-lg border border-border/50 bg-muted/5">
                            <p className="text-[12px] font-medium text-foreground">Series A Due Diligence</p>
                            <div className="mt-3 space-y-3">
                                <div>
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                        <span>Market Sizing</span>
                                        <span className="text-emerald-500 font-medium">90%</span>
                                    </div>
                                    <div className="mt-1 h-2 w-full rounded-full bg-muted/30 overflow-hidden">
                                        <div className="h-full bg-emerald-500" style={{ width: '90%' }} />
                                    </div>
                                    <p className="mt-1 text-[9px] text-emerald-500">Saturated</p>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                        <span>Competitor Analysis</span>
                                        <span className="text-red-500 font-medium">20%</span>
                                    </div>
                                    <div className="mt-1 h-2 w-full rounded-full bg-muted/30 overflow-hidden">
                                        <div className="h-full bg-red-500" style={{ width: '20%' }} />
                                    </div>
                                    <p className="mt-1 text-[9px] text-red-500">Needs Focus</p>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* Focus Next */}
                {focusRecommendation && (
                    <section>
                        <div className="flex items-center gap-1.5 mb-2">
                            <Target className="w-3 h-3 text-muted-foreground" />
                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                                Focus Next
                            </span>
                        </div>
                        <div className="p-3 rounded-lg border border-border/50 bg-muted/5">
                            <p className="text-[12px] font-medium text-foreground">{focusRecommendation.name}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{focusRecommendation.reason}</p>
                        </div>
                    </section>
                )}

                {/* Momentum */}
                {trendData && trendData.values.length > 1 && (
                    <section>
                        <div className="flex items-center gap-1.5 mb-2">
                            <TrendingUp className="w-3 h-3 text-muted-foreground" />
                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                                Momentum
                            </span>
                        </div>
                        <div className="p-3 rounded-lg border border-border/50 bg-muted/5">
                            <div className="flex items-center gap-3">
                                <Sparkline values={trendData.values} className="flex-1 text-foreground/60" />
                                <span className={cn(
                                    "text-[11px] font-medium",
                                    trendData.change >= 0 ? "text-emerald-500" : "text-red-400"
                                )}>
                                    {trendData.change >= 0 ? '+' : ''}{trendData.change}%
                                </span>
                            </div>
                            {trendData.topMover && (
                                <p className="text-[10px] text-muted-foreground mt-2">
                                    Most active: <span className="text-foreground/80">{trendData.topMover}</span>
                                </p>
                            )}
                        </div>
                    </section>
                )}

                {/* Recent Activity */}
                <section>
                    <div className="flex items-center gap-1.5 mb-2">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                            Recent
                        </span>
                    </div>

                    {loading ? (
                        <div className="space-y-2">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-10 bg-muted/30 rounded animate-pulse" />
                            ))}
                        </div>
                    ) : recentArtifacts.length > 0 ? (
                        <div className="space-y-1">
                            {recentArtifacts.map(artifact => (
                                <div key={artifact.id} className="py-2 px-2.5 rounded border border-border/40 hover:bg-muted/10 transition-colors">
                                    <p className="text-[11px] text-foreground truncate">{artifact.title}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[9px] text-muted-foreground/60">{timeAgo(artifact.created_at)}</span>
                                        {artifact.subspace_name && (
                                            <>
                                                <span className="text-[9px] text-muted-foreground/40">→</span>
                                                <span className="text-[9px] text-muted-foreground">{artifact.subspace_name}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-6 text-center">
                            <AlertCircle className="w-4 h-4 text-muted-foreground/40 mx-auto mb-2" />
                            <p className="text-[10px] text-muted-foreground/60">No recent captures</p>
                            <p className="text-[9px] text-muted-foreground/40 mt-0.5">Start browsing to collect artifacts</p>
                        </div>
                    )}
                </section>

            </div>
        </div>
    );
}
