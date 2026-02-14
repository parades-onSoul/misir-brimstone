'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQueries } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useSpaces, useAllSpaceAlerts } from '@/lib/api/spaces';
import { useAllUserArtifacts } from '@/lib/api/artifacts';
import { AlertCircle, Layers, ArrowRight, TrendingUp } from 'lucide-react';
import { getSpaceStatus, getFocusDots, formatRelativeTime } from '@/lib/formatters';
import { getSpaceColor } from '@/lib/colors';
import api from '@/lib/api/client';
import { SpaceCard } from '@/components/dashboard/space-card';
import { OnboardingModal } from '@/components/dashboard/onboarding-modal';
import { ActivityChart } from '@/components/dashboard/activity-chart';
import { SystemOverview } from '@/components/dashboard/system-overview';
import { WeakItemsList } from '@/components/dashboard/weak-items-list';
import type { Artifact, SpaceAlert } from '@/types/api';

const ONBOARDING_KEY = 'misir_onboarded';

const hasCompletedOnboarding = () => {
    if (typeof window === 'undefined') {
        return true;
    }
    return Boolean(localStorage.getItem(ONBOARDING_KEY));
};

export default function DashboardPage() {
    const { user } = useAuth();
    const { data: spacesData, isLoading: spacesLoading } = useSpaces(user?.id);
    const { data: artifactsData, isLoading: artifactsLoading } = useAllUserArtifacts(user?.id);

    const spaces = spacesData?.spaces || [];
    const allArtifacts: Artifact[] = artifactsData ?? [];
    const spaceIds = spaces.map(s => s.id);
    
    // Fetch alerts for all spaces
    const { data: alertsData } = useAllSpaceAlerts(user?.id, spaceIds);
    const allAlerts: SpaceAlert[] = alertsData ?? [];
    
    // Filter alerts by severity
    const criticalAlerts = allAlerts.filter((alert) => alert.severity === 'warning' || alert.severity === 'danger');

    // Priority Queue: Spaces that need attention (low artifact count)
    const prioritySpaces = spaces.filter(s => s.artifact_count < 3);
    const activeSpaces = spaces.filter(s => s.artifact_count >= 3);

    const analyticsQueries = useQueries({
        queries: activeSpaces.map((space) => ({
            queryKey: ['analytics', 'space-card', space.id, user?.id],
            queryFn: () => api.analytics.space(space.id),
            enabled: !!user?.id,
            staleTime: 10_000,
            refetchOnWindowFocus: 'always' as const,
            refetchOnReconnect: true,
            refetchInterval: 30_000,
        })),
    });

    const alertsBySpaceId = allAlerts.reduce<Map<number, SpaceAlert[]>>((map, alert) => {
        const current = map.get(alert.space_id) ?? [];
        current.push(alert);
        map.set(alert.space_id, current);
        return map;
    }, new Map());

    const getConfidenceFromArtifacts = (spaceId: number) => {
        const relevant = allArtifacts.filter((artifact) => artifact.space_id === spaceId);
        if (relevant.length === 0) return 0;
        const weights: Record<string, number> = {
            latent: 0.25,
            discovered: 0.5,
            engaged: 0.75,
            saturated: 1.0,
        };
        const score = relevant.reduce((sum, artifact) => sum + (weights[artifact.engagement_level] ?? 0.25), 0);
        return Math.max(0, Math.min(1, score / relevant.length));
    };

    const getAverageMargin = (spaceId: number) => {
        const margins = allArtifacts
            .filter((artifact) => artifact.space_id === spaceId && typeof artifact.margin === 'number')
            .map((artifact) => artifact.margin as number);
        if (margins.length === 0) return undefined;
        return margins.reduce((sum, margin) => sum + margin, 0) / margins.length;
    };

    // Onboarding state (Job 11)
    const [dismissedOnboarding, setDismissedOnboarding] = useState(() => hasCompletedOnboarding());
    const shouldShowOnboarding = !spacesLoading && spaces.length === 0 && !dismissedOnboarding;

    const handleOnboardingChange = (open: boolean) => {
        if (!open) {
            localStorage.setItem(ONBOARDING_KEY, 'true');
            setDismissedOnboarding(true);
        }
    };

    return (
        <div className="min-h-full w-full bg-[#0B0C0E] text-[#EEEEF0]">
            <div className="max-w-7xl mx-auto p-6 space-y-6">
                {/* Page Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-semibold text-[#EEEEF0]">Command Center</h1>
                    <p className="text-[14px] text-[#8A8F98] mt-1">Your daily actionable insights</p>
                </div>

                {/* System Overview (Job 32) */}
                <SystemOverview />

                {/* Alert Banner (Job 7) */}
                {criticalAlerts.length > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="size-5 text-amber-500 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <h3 className="text-sm font-medium text-amber-500 mb-1">
                                    {criticalAlerts.length} {criticalAlerts.length === 1 ? 'space needs' : 'spaces need'} your attention
                                </h3>
                                <p className="text-[13px] text-[#EEEEF0]/80 mb-3">
                                    {criticalAlerts[0]?.message || 'Some spaces have items that don\'t fit well or show focus shifts.'}
                                </p>
                                <Link 
                                    href={`/dashboard/spaces/${criticalAlerts[0]?.space_id}`}
                                    className="text-[13px] text-amber-500 hover:text-amber-400 font-medium transition-colors inline-flex items-center gap-1"
                                >
                                    Review alerts <ArrowRight className="size-3" />
                                </Link>
                            </div>
                        </div>
                    </div>
                )}

                {/* 1. Priority Queue */}
                {prioritySpaces.length > 0 && (
                    <section>
                        <h2 className="text-sm font-medium text-[#8A8F98] uppercase tracking-wider mb-3 flex items-center gap-2">
                            <AlertCircle className="size-4 text-amber-500" />
                            Attention Required
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {prioritySpaces.map(space => (
                                <Link 
                                    key={space.id} 
                                    href={`/dashboard/spaces/${space.id}`}
                                    className="block p-4 rounded-lg bg-[#141517] border border-amber-500/20 hover:border-amber-500/50 transition-all group"
                                >
                                    <h3 className="text-[#EEEEF0] font-medium mb-1 group-hover:text-amber-500 transition-colors">{space.name}</h3>
                                    <p className="text-[13px] text-[#8A8F98]">Only {space.artifact_count} items. Add more context to activate insights.</p>
                                    <div className="mt-3 text-[11px] text-amber-500/80 font-medium">Capture Required</div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* 2. Strategic Landscape (Spaces Grid) */}
                 <section>
                    <h2 className="text-sm font-medium text-[#8A8F98] uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Layers className="size-4" />
                        Strategic Landscape
                    </h2>
                    
                    {spacesLoading ? (
                        <div className="text-sm text-[#5F646D]">Loading spaces...</div>
                    ) : activeSpaces.length === 0 && prioritySpaces.length === 0 ? (
                         <div className="text-sm text-[#5F646D] border border-dashed border-white/10 p-8 rounded-lg text-center">
                            No active spaces found. <Link href="/onboarding" className="text-[#5E6AD2] hover:underline">Create your first space</Link>.
                         </div>
                    ) : activeSpaces.length === 0 ? (
                        <div className="text-sm text-[#5F646D] p-4">All spaces need attention. Check the queue above.</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {activeSpaces.map((space, index) => {
                                const analytics = analyticsQueries[index]?.data;
                                const confidenceFromAnalytics =
                                    analytics && analytics.subspace_health.length > 0
                                        ? analytics.subspace_health.reduce((acc, item) => acc + item.confidence, 0) / analytics.subspace_health.length
                                        : undefined;
                                const confidence = confidenceFromAnalytics ?? getConfidenceFromArtifacts(space.id);
                                const spaceAlerts = alertsBySpaceId.get(space.id) ?? [];
                                const hasHighDrift = spaceAlerts.some((alert) => alert.type === 'high_drift');
                                const avgMargin = getAverageMargin(space.id);
                                const status = getSpaceStatus({
                                    confidence,
                                    drift: hasHighDrift ? 0.35 : undefined,
                                    avg_margin: avgMargin,
                                });
                                const focusDots = getFocusDots(confidence);

                                return (
                                    <SpaceCard
                                        key={space.id}
                                        id={space.id}
                                        name={space.name}
                                        description={space.description}
                                        status={status}
                                        lastActive={space.updated_at}
                                        focusDots={focusDots}
                                        artifactCount={space.artifact_count}
                                    />
                                );
                             })}
                        </div>
                    )}
                </section>

                {/* Weak Items (from global analytics) */}
                <section>
                    <WeakItemsList />
                </section>

                {/* Activity Timeline (Job 9) */}
                <section>
                    <h2 className="text-sm font-medium text-[#8A8F98] uppercase tracking-wider mb-3 flex items-center gap-2">
                        <TrendingUp className="size-4" />
                        Activity
                    </h2>
                    {artifactsLoading || spacesLoading ? (
                        <div className="text-sm text-[#5F646D]">Loading activity...</div>
                    ) : !allArtifacts || allArtifacts.length === 0 ? (
                        <div className="text-sm text-[#5F646D] border border-dashed border-white/10 p-8 rounded-lg text-center">
                            No activity yet. Your 30-day timeline will appear here once you start saving items.
                        </div>
                    ) : (
                        <ActivityChart artifacts={allArtifacts} spaces={spaces} />
                    )}
                </section>

                {/* Recently Saved (Job 10) */}
                <section>
                    <h2 className="text-sm font-medium text-[#8A8F98] uppercase tracking-wider mb-3 flex items-center gap-2">
                        <TrendingUp className="size-4" />
                        Recently Saved
                    </h2>
                    {artifactsLoading ? (
                        <div className="text-sm text-[#5F646D]">Loading recent items...</div>
                    ) : !allArtifacts || allArtifacts.length === 0 ? (
                        <div className="text-sm text-[#5F646D] border border-dashed border-white/10 p-8 rounded-lg text-center">
                            No items saved yet. Start capturing content from your browser extension.
                        </div>
                    ) : (
                        <div className="bg-[#141517] border border-white/5 rounded-lg divide-y divide-white/5">
                            {allArtifacts.slice(0, 10).map((artifact) => {
                                const space = spaces.find(s => s.id === artifact.space_id);
                                const spaceColor = space ? getSpaceColor(spaces.indexOf(space)) : getSpaceColor(0);
                                
                                return (
                                    <a
                                        key={artifact.id}
                                        href={artifact.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-4 p-4 hover:bg-white/2 transition-colors group"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-[14px] text-[#EEEEF0] truncate group-hover:text-white transition-colors mb-1">
                                                {artifact.title || 'Untitled'}
                                            </h4>
                                            <div className="flex items-center gap-2 text-[12px] text-[#8A8F98]">
                                                {space && (
                                                    <span 
                                                        className="px-2 py-0.5 rounded text-[11px] font-medium"
                                                        style={{ 
                                                            backgroundColor: `${spaceColor.hex}20`,
                                                            color: spaceColor.hex
                                                        }}
                                                    >
                                                        {space.name}
                                                    </span>
                                                )}
                                                <span>•</span>
                                                <span>{formatRelativeTime(artifact.created_at)}</span>
                                            </div>
                                        </div>
                                        <ArrowRight className="size-4 text-[#5F646D] group-hover:text-[#8A8F98] shrink-0 transition-colors" />
                                    </a>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>

            {/* Onboarding Modal (Job 11) */}
            <OnboardingModal 
                open={shouldShowOnboarding} 
                onOpenChange={handleOnboardingChange} 
            />
        </div>
    );
}
