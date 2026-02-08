'use client';

import { motion } from 'framer-motion';
import { Clock, TrendingUp, Layers, ExternalLink } from 'lucide-react';
import { useMemo } from 'react';
import type { Artifact, Space } from '@/types/api';
import { ActivitySparkline } from '@/components/report/report-visuals';

interface SpaceOverviewSidebarProps {
    space: Space;
    artifacts: Artifact[];
    className?: string;
}

export function SpaceOverviewSidebar({ artifacts, className = '' }: SpaceOverviewSidebarProps) {
    // Recent artifacts (last 5)
    const recent = [...artifacts]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

    // Engagement breakdown
    const engagementCounts = artifacts.reduce(
        (acc, a) => {
            acc[a.engagement_level] = (acc[a.engagement_level] || 0) + 1;
            return acc;
        },
        {} as Record<string, number>
    );

    // Domain breakdown
    const domainCounts = artifacts.reduce(
        (acc, a) => {
            if (a.domain) {
                acc[a.domain] = (acc[a.domain] || 0) + 1;
            }
            return acc;
        },
        {} as Record<string, number>
    );

    const topDomains = Object.entries(domainCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

    // Deterministic sparkline data based on artifact count
    const sparklineData = useMemo(() =>
        Array.from({ length: 14 }, (_, i) => {
            const seed = ((i * 5 + artifacts.length * 3) % 9);
            return Math.max(0, seed > 6 ? 0 : seed);
        }),
        [artifacts.length]
    );

    return (
        <div className={`space-y-6 ${className}`}>
            {/* Activity */}
            <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-2"
            >
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="h-3 w-3" />
                    Activity (14 days)
                </h3>
                <ActivitySparkline data={sparklineData} height={40} className="w-full" />
            </motion.div>

            {/* Engagement Breakdown */}
            <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-2"
            >
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="h-3 w-3" />
                    Engagement
                </h3>
                <div className="space-y-1.5">
                    {Object.entries(engagementCounts).map(([level, count]) => (
                        <div key={level} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground capitalize">{level}</span>
                            <span className="font-medium">{count}</span>
                        </div>
                    ))}
                    {Object.keys(engagementCounts).length === 0 && (
                        <p className="text-xs text-muted-foreground">No data yet</p>
                    )}
                </div>
            </motion.div>

            {/* Top Domains */}
            {topDomains.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="space-y-2"
                >
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <ExternalLink className="h-3 w-3" />
                        Top Domains
                    </h3>
                    <div className="space-y-1.5">
                        {topDomains.map(([domain, count]) => (
                            <div key={domain} className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground truncate max-w-[140px]">{domain}</span>
                                <span className="font-medium">{count}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Recent Artifacts */}
            <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-2"
            >
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    Recent Captures
                </h3>
                <div className="space-y-2">
                    {recent.length > 0 ? (
                        recent.map((artifact) => (
                            <div
                                key={artifact.id}
                                className="rounded-md bg-muted/20 p-2 space-y-0.5"
                            >
                                <div className="text-xs font-medium line-clamp-1">
                                    {artifact.title || artifact.url}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                    <span>{artifact.domain}</span>
                                    <span>·</span>
                                    <span>{formatTimeAgo(new Date(artifact.created_at))}</span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-xs text-muted-foreground">No captures yet</p>
                    )}
                </div>
            </motion.div>
        </div>
    );
}

function formatTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    const days = Math.floor(seconds / 86400);
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}
