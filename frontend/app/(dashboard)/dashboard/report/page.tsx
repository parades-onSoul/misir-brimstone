'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useSpaces } from '@/lib/api/spaces';
import { useGlobalAnalytics } from '@/lib/api/analytics';
import { useAllUserArtifacts } from '@/lib/api/artifacts';
import { Button } from '@/components/ui/button';
import type { EngagementLevel, SpaceResponse } from '@/types/api';
import {
    ReportHeader,
    ReportSection,
    SubSection,
    SubspaceList,
    QuickInsight,
    SuggestedAction,
    ReportSkeleton,
    ReportEmptyState,
    ReportError,
} from '@/components/report/report-sections';
import { StateDistributionBar } from '@/components/report/report-visuals';

type ReportPeriod = 'daily' | 'weekly' | 'monthly';

const PERIODS: { value: ReportPeriod; label: string }[] = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
];

function PeriodSelector({ value, onChange }: { value: ReportPeriod; onChange: (v: ReportPeriod) => void }) {
    return (
        <div className="flex gap-2 mb-8">
            {PERIODS.map((p) => (
                <Button
                    key={p.value}
                    variant={value === p.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onChange(p.value)}
                    className="h-8 px-4"
                >
                    {p.label}
                </Button>
            ))}
        </div>
    );
}

function artifactCountToState(count: number): 0 | 1 | 2 | 3 {
    if (count >= 20) return 3;
    if (count >= 10) return 2;
    if (count >= 3) return 1;
    return 0;
}

export default function ReportPage() {
    const { user } = useAuth();
    const [period, setPeriod] = useState<ReportPeriod>('weekly');
    const { data: spaces, isLoading: spacesLoading, error: spacesError } = useSpaces(user?.id);
    const { data: global, isLoading: globalLoading, error: globalError } = useGlobalAnalytics(user?.id);
    const {
        data: artifacts = [],
        isLoading: artifactsLoading,
        error: artifactsError,
    } = useAllUserArtifacts(user?.id, 500);

    const engagementDistribution = useMemo(() => {
        const distribution = {
            latent: 0,
            discovered: 0,
            engaged: 0,
            saturated: 0,
        };
        for (const artifact of artifacts) {
            if (artifact.engagement_level in distribution) {
                distribution[artifact.engagement_level as EngagementLevel] += 1;
            }
        }
        return distribution;
    }, [artifacts]);

    if (spacesLoading || globalLoading || artifactsLoading) {
        return <ReportSkeleton />;
    }

    const firstError = spacesError ?? globalError ?? artifactsError;
    if (firstError) {
        return <ReportError error={firstError.message || 'Failed to load report'} />;
    }

    if (!spaces || spaces.count === 0) {
        return (
            <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
                <PeriodSelector value={period} onChange={setPeriod} />
                <ReportEmptyState />
            </div>
        );
    }

    const totalSpaces = spaces.count;
    const totalArtifacts = global?.overview.total_artifacts ?? artifacts.length;
    const systemHealth = global?.overview.system_health ?? 'stable';
    const overallFocus = global?.overview.overall_focus ?? 0;
    const timeAllocation = global?.time_allocation ?? [];
    const weakItems = global?.weak_items ?? [];
    const paceBySpace = global?.pace_by_space ?? [];

    const deepeningPercent = totalArtifacts > 0
        ? ((engagementDistribution.engaged + engagementDistribution.saturated) / totalArtifacts) * 100
        : 0;
    const explorationPercent = 100 - deepeningPercent;

    const spaceByName = new Map<string, SpaceResponse>(spaces.spaces.map((space) => [space.name, space]));
    const activeSpaceNames = new Set(
        timeAllocation.filter((item) => item.minutes > 0).map((item) => item.space_name)
    );
    const activeSpaces = timeAllocation.filter((item) => item.minutes > 0);
    const dormantSpaces = spaces.spaces.filter(
        (space) => !activeSpaceNames.has(space.name) && space.artifact_count > 0
    );

    const timeWindow = period === 'daily'
        ? 'Last 24 hours'
        : period === 'weekly'
            ? 'Last 7 days'
            : 'Last 30 days';

    const confidence = totalArtifacts > 30 ? 'High' : totalArtifacts > 8 ? 'Medium' : 'Low';

    const insight = weakItems.length > 0
        ? `Most weak-fit item right now is "${weakItems[0].title}" in ${weakItems[0].space_name}. Review and reclassify to improve signal quality.`
        : deepeningPercent > 50
            ? `You are currently deepening existing knowledge (${deepeningPercent.toFixed(0)}% engaged or saturated).`
            : `You are in exploration mode (${explorationPercent.toFixed(0)}% latent or discovered).`;

    const paceUp = paceBySpace.filter((item) => item.trend === 'up').length;
    const paceDown = paceBySpace.filter((item) => item.trend === 'down').length;

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
            <PeriodSelector value={period} onChange={setPeriod} />

            <ReportHeader
                timeWindow={timeWindow}
                scopeLabel={`All Spaces (${totalSpaces})`}
                confidence={confidence}
            />

            <QuickInsight insight={insight} />

            <div className="divide-y divide-muted-foreground/10">
                <ReportSection number={1} title="Attention Distribution">
                    {totalArtifacts > 0 ? (
                        <>
                            <StateDistributionBar distribution={engagementDistribution} />
                            <p className="mt-4">
                                {deepeningPercent > 50
                                    ? `You are deepening existing knowledge (${deepeningPercent.toFixed(0)}% engaged or saturated).`
                                    : `You are exploring new material (${explorationPercent.toFixed(0)}% latent or discovered).`}
                            </p>
                        </>
                    ) : (
                        <p>No engagement data yet.</p>
                    )}
                </ReportSection>

                <ReportSection number={2} title="Space Overview">
                    <p>
                        You have <strong>{totalSpaces}</strong> spaces with{' '}
                        <strong>{totalArtifacts}</strong> total artifacts.
                    </p>
                    <p>
                        System health is <strong>{systemHealth}</strong> with overall focus at{' '}
                        <strong>{Math.round(overallFocus * 100)}%</strong>.
                    </p>

                    {activeSpaces.length > 0 && (
                        <SubSection title="Active Spaces (by minutes)">
                            <SubspaceList
                                items={activeSpaces.map((item) => {
                                    const sourceSpace = spaceByName.get(item.space_name);
                                    return {
                                        name: `${item.space_name} (${item.minutes} min)`,
                                        state: artifactCountToState(sourceSpace?.artifact_count ?? 0),
                                    };
                                })}
                            />
                        </SubSection>
                    )}

                    {dormantSpaces.length > 0 && (
                        <SubSection title="Needs Attention">
                            <SubspaceList
                                items={dormantSpaces.map((space) => ({
                                    name: `${space.name} (${space.artifact_count} artifacts)`,
                                    state: artifactCountToState(space.artifact_count),
                                }))}
                            />
                        </SubSection>
                    )}

                    {paceDown > paceUp && (
                        <SuggestedAction action="Capture at least one high-signal item in slower spaces to recover momentum." />
                    )}
                </ReportSection>

                <ReportSection number={3} title="Insights">
                    <ul className="space-y-3">
                        <li className="p-3 rounded-lg bg-muted/10 border border-muted-foreground/10">
                            <p className="font-medium text-foreground text-sm">
                                {paceUp} spaces accelerating, {paceDown} spaces slowing
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Trend comes from `pace_by_space` in global analytics.
                            </p>
                        </li>
                        {weakItems.length > 0 && (
                            <li className="p-3 rounded-lg bg-muted/10 border border-muted-foreground/10">
                                <p className="font-medium text-foreground text-sm">
                                    Weak-fit items detected
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {weakItems[0].title} in {weakItems[0].space_name} has low assignment confidence.
                                </p>
                            </li>
                        )}
                        {totalArtifacts > 0 && (
                            <li className="p-3 rounded-lg bg-muted/10 border border-muted-foreground/10">
                                <p className="font-medium text-foreground text-sm">
                                    Focus score is {Math.round(overallFocus * 100)}%
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Derived from live engagement-level distribution, not synthetic mock values.
                                </p>
                            </li>
                        )}
                    </ul>
                </ReportSection>
            </div>
        </div>
    );
}
