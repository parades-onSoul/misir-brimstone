'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    BarChart3,
    Calendar,
    TrendingUp,
    Globe,
    Activity,
    FileText,
    Layers,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useSpaces } from '@/lib/api/spaces';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
    StateDistributionBar,
    ActivitySparkline,
    ConcentrationIndicator,
    StatCard,
    DomainBar,
} from '@/components/report/report-visuals';
import { ActivityHeatmap } from '@/components/dashboard/activity-heatmap';
import type { SpaceResponse } from '@/types/api';

type Period = 'daily' | 'weekly' | 'monthly';

export default function AnalyticsPage() {
    const { user } = useAuth();
    const { data: spaces, isLoading } = useSpaces(user?.id);
    const [period, setPeriod] = useState<Period>('weekly');

    // Generate mock analytics data based on spaces
    const totalArtifacts = spaces?.spaces.reduce((sum: number, s: SpaceResponse) => sum + s.artifact_count, 0) ?? 0;
    const spacesCount = spaces?.length ?? 0;

    // Mock engagement distribution (Backend v1.0 levels)
    const engagementDistribution = {
        latent: Math.floor(totalArtifacts * 0.4),
        discovered: Math.floor(totalArtifacts * 0.25),
        engaged: Math.floor(totalArtifacts * 0.25),
        saturated: Math.floor(totalArtifacts * 0.1),
    };

    // Mock domains
    const topDomains = [
        { domain: 'github.com', count: Math.floor(totalArtifacts * 0.25) || 3 },
        { domain: 'arxiv.org', count: Math.floor(totalArtifacts * 0.15) || 2 },
        { domain: 'medium.com', count: Math.floor(totalArtifacts * 0.12) || 2 },
        { domain: 'stackoverflow.com', count: Math.floor(totalArtifacts * 0.1) || 1 },
        { domain: 'docs.python.org', count: Math.floor(totalArtifacts * 0.08) || 1 },
    ];

    // Mock velocity and drift metrics (Backend v1.0 concepts)
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
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                        <BarChart3 className="h-6 w-6 text-primary" />
                        Analytics
                    </h1>
                    <p className="text-muted-foreground">
                        Deep metrics on drift, velocity, and confidence
                    </p>
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
                    {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
                        <Button
                            key={p}
                            variant={period === p ? 'default' : 'ghost'}
                            size="sm"
                            className="h-7 px-3 text-xs capitalize"
                            onClick={() => setPeriod(p)}
                        >
                            {p}
                        </Button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-24 rounded-lg" />
                    ))}
                </div>
            ) : (
                <>
                    {/* Stats Row */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard
                            label="Total Artifacts"
                            value={totalArtifacts}
                            change="+12 this week"
                            trend="up"
                            icon={<FileText className="h-4 w-4" />}
                        />
                        <StatCard
                            label="Active Spaces"
                            value={spacesCount}
                            change={`${spacesCount} total`}
                            trend="neutral"
                            icon={<Layers className="h-4 w-4" />}
                        />
                        <StatCard
                            label="Avg. Engagement"
                            value={totalArtifacts > 0 ? 'Engaged' : '—'}
                            change="Steady"
                            trend="neutral"
                            icon={<Activity className="h-4 w-4" />}
                        />
                        <StatCard
                            label="Domains Tracked"
                            value={topDomains.length}
                            change="+2 new"
                            trend="up"
                            icon={<Globe className="h-4 w-4" />}
                        />
                    </div>

                    {/* Core Metrics: Drift, Velocity, Confidence */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                    >
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-primary" />
                                    Core Knowledge Metrics
                                </CardTitle>
                                <CardDescription>
                                    Drift, velocity, and confidence scores
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-medium">Velocity</span>
                                        <span className="text-muted-foreground">{velocityScore.toFixed(0)}%</span>
                                    </div>
                                    <Progress value={velocityScore} className="h-2" />
                                    <p className="text-xs text-muted-foreground">
                                        Rate of knowledge acquisition over time
                                    </p>
                                </div>
                                
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-medium">Drift</span>
                                        <span className="text-muted-foreground">{driftScore.toFixed(0)}%</span>
                                    </div>
                                    <Progress value={driftScore} className="h-2" />
                                    <p className="text-xs text-muted-foreground">
                                        Measure of attention shift between topics
                                    </p>
                                </div>
                                
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-medium">Confidence</span>
                                        <span className="text-muted-foreground">{confidenceScore.toFixed(0)}%</span>
                                    </div>
                                    <Progress value={confidenceScore} className="h-2" />
                                    <p className="text-xs text-muted-foreground">
                                        Reliability score for knowledge signals
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Main Content Grid */}
                    <div className="grid gap-6 lg:grid-cols-3">
                        {/* Activity Heatmap - Full Width */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="lg:col-span-3"
                        >
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-primary" />
                                        Activity
                                    </CardTitle>
                                    <CardDescription>
                                        Artifact capture frequency over the last 13 weeks
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ActivityHeatmap data={heatmapData} />
                                </CardContent>
                            </Card>
                        </motion.div>

                        {/* Engagement Distribution */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="lg:col-span-2"
                        >
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <TrendingUp className="h-4 w-4 text-primary" />
                                        Engagement Distribution
                                    </CardTitle>
                                    <CardDescription>
                                        How deeply you&apos;re engaging with content
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
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
                                </CardContent>
                            </Card>
                        </motion.div>

                        {/* Top Domains */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                        >
                            <Card className="h-full">
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Globe className="h-4 w-4 text-primary" />
                                        Top Sources
                                    </CardTitle>
                                    <CardDescription>
                                        Most captured domains
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <DomainBar domains={topDomains} />
                                </CardContent>
                            </Card>
                        </motion.div>

                        {/* Spaces Overview */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="lg:col-span-3"
                        >
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Layers className="h-4 w-4 text-primary" />
                                        Spaces Overview
                                    </CardTitle>
                                    <CardDescription>
                                        Knowledge containers and their sizes
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {spaces && spaces.length > 0 ? (
                                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                            {spaces.spaces.map((space: SpaceResponse, i: number) => (
                                                <motion.div
                                                    key={space.id}
                                                    initial={{ opacity: 0, scale: 0.95 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ delay: 0.5 + i * 0.05 }}
                                                    className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/20 p-3"
                                                >
                                                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-sm font-medium text-primary">
                                                        {space.name[0].toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-medium truncate">{space.name}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {space.artifact_count} artifact{space.artifact_count !== 1 ? 's' : ''}
                                                        </div>
                                                    </div>
                                                    <ActivitySparkline
                                                        data={Array.from({ length: 7 }, () => Math.floor(Math.random() * 5))}
                                                        height={20}
                                                        className="opacity-60"
                                                    />
                                                </motion.div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-muted-foreground text-sm">
                                            No spaces yet. Create one to start tracking.
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>
                </>
            )}
        </div>
    );
}
