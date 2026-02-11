'use client';

import { useMemo } from 'react';
import { Activity, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { useSpaceDrift } from '@/lib/api/analytics';
import type { DriftEvent } from '@/types/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DriftTimelineProps {
    spaceId: number;
    userId: string;
    className?: string;
    limit?: number;
    onSelectSubspace?: (subspaceId: number) => void;
}

type DriftBand = 'calm' | 'notable' | 'critical';

const DRIFT_BANDS: Record<DriftBand, { label: string; dot: string; pill: string; copy: string }> = {
    calm: {
        label: 'Subtle shift',
        dot: 'bg-emerald-400',
        pill: 'text-emerald-200 bg-emerald-400/10',
        copy: 'Light centroid drift. Keep monitoring for compounding changes.',
    },
    notable: {
        label: 'Notable drift',
        dot: 'bg-amber-400',
        pill: 'text-amber-200 bg-amber-400/10',
        copy: 'Topic vector is moving. Review evidence to confirm intentional exploration.',
    },
    critical: {
        label: 'Critical shift',
        dot: 'bg-rose-400',
        pill: 'text-rose-200 bg-rose-400/10',
        copy: 'Sharp deviation detected. Confidence may degrade without intervention.',
    },
};

const getDriftBand = (magnitude: number): DriftBand => {
    if (magnitude >= 0.65) return 'critical';
    if (magnitude >= 0.35) return 'notable';
    return 'calm';
};

const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.max(0, Math.round(diffMs / (60 * 1000)));
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.round(days / 30);
    return `${months}mo ago`;
};

const formatAbsoluteTime = (timestamp: string) => {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return timestamp;
    return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

const magnitudePercent = (value: number) => `${Math.round(value * 100)}%`;

export function DriftTimeline({ spaceId, userId, className, limit = 20, onSelectSubspace }: DriftTimelineProps) {
    const { data, isLoading, isError } = useSpaceDrift(spaceId, userId);

    const events = useMemo(() => {
        if (!data) return [] as DriftEvent[];
        return [...data]
            .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
            .slice(0, limit);
    }, [data, limit]);

    return (
        <section className={cn('rounded-2xl border border-white/10 bg-[#141517] p-5 text-white shadow-[0_20px_80px_-60px_rgba(15,15,25,0.8)]', className)}>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-white">
                        <Activity className="h-4 w-4 text-[#5E6AD2]" />
                        Significant Shifts Detected
                    </p>
                    <p className="text-xs text-white/60">Signals streamed from the drift analytics endpoint</p>
                </div>
                <span className="text-[11px] font-mono uppercase tracking-wide text-white/50">
                    {data?.length ?? 0} total signals
                </span>
            </div>

            {isLoading && (
                <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, idx) => (
                        <Skeleton key={idx} className="h-16 w-full" />
                    ))}
                </div>
            )}

            {!isLoading && isError && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                    <AlertTriangle className="h-4 w-4" />
                    Unable to load drift timeline right now.
                </div>
            )}

            {!isLoading && !isError && events.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-white/60">
                    No drift events recorded yet. The timeline will populate after the next ingestion window.
                </div>
            )}

            {!isLoading && !isError && events.length > 0 && (
                <div className="space-y-4">
                    {events.map((event, idx) => {
                        const band = getDriftBand(event.drift_magnitude);
                        return (
                            <div key={`${event.subspace_id}-${event.occurred_at}`} className="flex gap-4">
                                <div className="flex flex-col items-center">
                                    <span className={cn('mt-1 size-2 rounded-full', DRIFT_BANDS[band].dot)} />
                                    {idx < events.length - 1 && <span className="my-1 w-px flex-1 bg-white/10" />}
                                </div>
                                <div className="flex-1 rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-medium text-white">{event.subspace_name}</p>
                                        <span className={cn('rounded-full px-3 py-0.5 text-[11px] font-semibold', DRIFT_BANDS[band].pill)}>
                                            {DRIFT_BANDS[band].label}
                                        </span>
                                        <span className="text-[11px] text-white/50">{formatRelativeTime(event.occurred_at)}</span>
                                    </div>
                                    <p className="text-xs text-white/70">{DRIFT_BANDS[band].copy}</p>
                                    <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-white/60">
                                        <span>
                                            Drift magnitude <b className="text-white">{magnitudePercent(event.drift_magnitude)}</b>
                                        </span>
                                        {event.trigger_signal_id && (
                                            <span>Signal #{event.trigger_signal_id}</span>
                                        )}
                                        <span>{formatAbsoluteTime(event.occurred_at)}</span>
                                        {onSelectSubspace && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="ml-auto h-7 px-2 text-[11px] text-white/80 hover:text-white"
                                                onClick={() => onSelectSubspace(event.subspace_id)}
                                            >
                                                Review topic
                                                <ArrowUpRight className="ml-1 h-3 w-3" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
