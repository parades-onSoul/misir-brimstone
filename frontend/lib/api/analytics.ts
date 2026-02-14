'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api/client';

const ANALYTICS_KEY = ['analytics'] as const;
const LIVE_QUERY_OPTIONS = {
    staleTime: 10_000,
    refetchOnWindowFocus: 'always' as const,
    refetchOnReconnect: true,
};

export function useSpaceAnalytics(spaceId: number | undefined, userId: string | undefined) {
    return useQuery({
        queryKey: [...ANALYTICS_KEY, 'space', spaceId, userId],
        queryFn: () => api.analytics.space(spaceId!),
        enabled: !!userId && !!spaceId,
        ...LIVE_QUERY_OPTIONS,
        refetchInterval: 30_000,
    });
}

export function useSpaceTopology(spaceId: number | undefined, userId: string | undefined) {
    return useQuery({
        queryKey: [...ANALYTICS_KEY, 'topology', spaceId, userId],
        queryFn: () => api.analytics.topology(spaceId!),
        enabled: !!userId && !!spaceId,
        ...LIVE_QUERY_OPTIONS,
        refetchInterval: 45_000,
    });
}

export function useSpaceDrift(spaceId: number | undefined, userId: string | undefined) {
    return useQuery({
        queryKey: [...ANALYTICS_KEY, 'drift', spaceId, userId],
        queryFn: () => api.analytics.drift(spaceId!),
        enabled: !!userId && !!spaceId,
        ...LIVE_QUERY_OPTIONS,
        refetchInterval: 30_000,
    });
}

export function useSpaceVelocity(spaceId: number | undefined, userId: string | undefined) {
    return useQuery({
        queryKey: [...ANALYTICS_KEY, 'velocity', spaceId, userId],
        queryFn: () => api.analytics.velocity(spaceId!),
        enabled: !!userId && !!spaceId,
        ...LIVE_QUERY_OPTIONS,
        refetchInterval: 30_000,
    });
}

export function useSpaceConfidence(spaceId: number | undefined, userId: string | undefined) {
    return useQuery({
        queryKey: [...ANALYTICS_KEY, 'confidence', spaceId, userId],
        queryFn: () => api.analytics.confidence(spaceId!),
        enabled: !!userId && !!spaceId,
        ...LIVE_QUERY_OPTIONS,
        refetchInterval: 30_000,
    });
}

export function useMarginDistribution(spaceId: number | undefined, userId: string | undefined) {
    return useQuery({
        queryKey: [...ANALYTICS_KEY, 'margin', spaceId, userId],
        queryFn: () => api.analytics.marginDistribution(spaceId!),
        enabled: !!userId && !!spaceId,
        ...LIVE_QUERY_OPTIONS,
        refetchInterval: 30_000,
    });
}

export function useSpaceAlerts(spaceId: number | undefined, userId: string | undefined) {
    return useQuery({
        queryKey: [...ANALYTICS_KEY, 'alerts', spaceId, userId],
        queryFn: () => api.analytics.alerts(spaceId!),
        enabled: !!userId && !!spaceId,
        ...LIVE_QUERY_OPTIONS,
        refetchInterval: 20_000,
    });
}

/**
 * Fetches global analytics for the main dashboard.
 * Corresponds to Job 32, 33, 34 (System Overview, Time Allocation, Activity Heatmap).
 */
export function useGlobalAnalytics(userId: string | undefined) {
    return useQuery({
        queryKey: [...ANALYTICS_KEY, 'global', userId],
        queryFn: () => api.analytics.global(),
        enabled: !!userId,
        ...LIVE_QUERY_OPTIONS,
        refetchInterval: 60_000,
    });
}
