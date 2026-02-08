'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useSpaces } from '@/lib/api/spaces';
import { Button } from '@/components/ui/button';
import type { SpaceResponse } from '@/types/api';
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

export default function ReportPage() {
    const { user } = useAuth();
    const [period, setPeriod] = useState<ReportPeriod>('weekly');
    const { data: spaces, isLoading, error } = useSpaces(user?.id);

    if (isLoading) {
        return <ReportSkeleton />;
    }

    if (error) {
        return <ReportError error={error?.message || 'Failed to load report'} />;
    }

    if (!spaces || spaces.length === 0) {
        return (
            <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
                <PeriodSelector value={period} onChange={setPeriod} />
                <ReportEmptyState />
            </div>
        );
    }

    // Calculate report data
    const totalArtifacts = spaces.spaces.reduce((sum: number, s: SpaceResponse) => sum + s.artifact_count, 0);
    const totalSpaces = spaces.length;

    // Mock engagement distribution (Backend v1.0: latent, discovered, engaged, saturated)
    const engagementDistribution = {
        latent: Math.floor(totalArtifacts * 0.4),
        discovered: Math.floor(totalArtifacts * 0.25),
        engaged: Math.floor(totalArtifacts * 0.25),
        saturated: Math.floor(totalArtifacts * 0.1),
    };

    const deepeningPercent = totalArtifacts > 0
        ? ((engagementDistribution.engaged + engagementDistribution.saturated) / totalArtifacts) * 100
        : 0;
    
    const explorationPercent = 100 - deepeningPercent;

    // Determine time window
    const timeWindow = period === 'daily' 
        ? 'Last 24 hours' 
        : period === 'weekly' 
        ? 'Last 7 days' 
        : 'Last 30 days';

    // Determine confidence based on artifact count
    const confidence = totalArtifacts > 20 
        ? 'High' 
        : totalArtifacts > 5 
        ? 'Medium' 
        : 'Low';

    // Generate insight
    const insight = deepeningPercent > 50
        ? `You're focusing on deepening existing knowledge (${deepeningPercent.toFixed(0)}% engaged or saturated). Consider exploring new areas to maintain balanced growth.`
        : `You're in exploration mode (${explorationPercent.toFixed(0)}% latent or discovered). Consider deepening engagement with promising artifacts.`;

    // Active vs dormant spaces (mock classification based on artifact count)
    const activeSpaces = spaces.spaces.filter((s: SpaceResponse) => s.artifact_count >= 3);
    const dormantSpaces = spaces.spaces.filter((s: SpaceResponse) => s.artifact_count < 3 && s.artifact_count > 0);

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
                {/* Section 1: Attention Distribution */}
                <ReportSection number={1} title="Attention Distribution">
                    <StateDistributionBar distribution={engagementDistribution} />
                    <p className="mt-4">
                        {deepeningPercent > 50
                            ? `You're focusing on deepening existing knowledge (${deepeningPercent.toFixed(0)}% engaged or saturated).`
                            : `You're in exploration mode (${explorationPercent.toFixed(0)}% latent or discovered).`}
                    </p>
                </ReportSection>

                {/* Section 2: Space Overview */}
                <ReportSection number={2} title="Space Overview">
                    <p>
                        You have <strong>{totalSpaces}</strong> spaces with{' '}
                        <strong>{totalArtifacts}</strong> total artifacts.
                    </p>

                    {activeSpaces.length > 0 && (
                        <SubSection title="Active Spaces">
                            <SubspaceList
                                items={activeSpaces.map((s: SpaceResponse) => ({
                                    name: `${s.name} (${s.artifact_count} artifacts)`,
                                    state: s.artifact_count > 10 ? 3 : s.artifact_count > 5 ? 2 : 1,
                                }))}
                            />
                        </SubSection>
                    )}

                    {dormantSpaces.length > 0 && (
                        <SubSection title="Needs Attention">
                            <SubspaceList
                                items={dormantSpaces.map((s: SpaceResponse) => ({
                                    name: `${s.name} (${s.artifact_count} artifacts)`,
                                    state: 0,
                                }))}
                            />
                        </SubSection>
                    )}

                    {activeSpaces.length > 0 && activeSpaces.length < totalSpaces * 0.5 && (
                        <SuggestedAction action="Consider diversifying attention across more spaces to avoid knowledge silos." />
                    )}
                </ReportSection>

                {/* Section 3: Insights */}
                <ReportSection number={3} title="Insights">
                    <ul className="space-y-3">
                        <li className="p-3 rounded-lg bg-muted/10 border border-muted-foreground/10">
                            <p className="font-medium text-foreground text-sm">
                                {totalArtifacts > 20 
                                    ? 'Strong knowledge base established' 
                                    : 'Building your knowledge foundation'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {totalArtifacts > 20
                                    ? `With ${totalArtifacts} artifacts across ${totalSpaces} spaces, you have a solid foundation for knowledge synthesis.`
                                    : `You have ${totalArtifacts} artifacts. Keep capturing to build a richer knowledge graph.`}
                            </p>
                        </li>
                        {deepeningPercent < 30 && totalArtifacts > 10 && (
                            <li className="p-3 rounded-lg bg-muted/10 border border-muted-foreground/10">
                                <p className="font-medium text-foreground text-sm">
                                    High exploration, low depth
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Most artifacts are latent or discovered. Consider re-engaging with promising content to move them to engaged or saturated states.
                                </p>
                            </li>
                        )}
                        {activeSpaces.length === 1 && totalSpaces > 1 && (
                            <li className="p-3 rounded-lg bg-muted/10 border border-muted-foreground/10">
                                <p className="font-medium text-foreground text-sm">
                                    Concentrated attention detected
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {activeSpaces[0].name} has most of your artifacts. Explore other spaces to maintain knowledge diversity.
                                </p>
                            </li>
                        )}
                    </ul>
                </ReportSection>
            </div>
        </div>
    );
}
