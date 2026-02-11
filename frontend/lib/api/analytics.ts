'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api/client';

const ANALYTICS_KEY = ['analytics'] as const;

export function useSpaceAnalytics(spaceId: number | undefined, userId: string | undefined) {
    return useQuery({
        queryKey: [...ANALYTICS_KEY, 'space', spaceId, userId],
        queryFn: () => api.analytics.space(spaceId!, userId!),
        enabled: !!userId && !!spaceId,
        staleTime: 60000, // 1 minute
    });
}

export function useSpaceTopology(spaceId: number | undefined, userId: string | undefined) {
    return useQuery({
        queryKey: [...ANALYTICS_KEY, 'topology', spaceId, userId],
        queryFn: () => api.analytics.topology(spaceId!, userId!),
        enabled: !!userId && !!spaceId,
        staleTime: 300000, // 5 minutes (cached aggressively)
    });
}

export function useSpaceDrift(spaceId: number | undefined, userId: string | undefined) {
    return useQuery({
        queryKey: [...ANALYTICS_KEY, 'drift', spaceId, userId],
        queryFn: () => api.analytics.drift(spaceId!, userId!),
        enabled: !!userId && !!spaceId,
        staleTime: 60000,
    });
}

export function useSpaceVelocity(spaceId: number | undefined, userId: string | undefined) {
    return useQuery({
        queryKey: [...ANALYTICS_KEY, 'velocity', spaceId, userId],
        queryFn: () => api.analytics.velocity(spaceId!, userId!),
        enabled: !!userId && !!spaceId,
        staleTime: 60000,
    });
}

export function useSpaceConfidence(spaceId: number | undefined, userId: string | undefined) {
    return useQuery({
        queryKey: [...ANALYTICS_KEY, 'confidence', spaceId, userId],
        queryFn: () => api.analytics.confidence(spaceId!, userId!),
        enabled: !!userId && !!spaceId,
        staleTime: 60000,
    });
}

export function useMarginDistribution(spaceId: number | undefined, userId: string | undefined) {
    return useQuery({
        queryKey: [...ANALYTICS_KEY, 'margin', spaceId, userId],
        queryFn: () => api.analytics.marginDistribution(spaceId!, userId!),
        enabled: !!userId && !!spaceId,
        staleTime: 60000,
    });
}

export function useSpaceAlerts(spaceId: number | undefined, userId: string | undefined) {
    return useQuery({
        queryKey: [...ANALYTICS_KEY, 'alerts', spaceId, userId],
        queryFn: () => api.analytics.alerts(spaceId!, userId!),
        enabled: !!userId && !!spaceId,
        staleTime: 60000,
    });
}

/**
 * Fetches global analytics for the main dashboard.
 * Corresponds to Job 32, 33, 34 (System Overview, Time Allocation, Activity Heatmap).
 */
export function useGlobalAnalytics(userId: string | undefined) {
    return useQuery({
        queryKey: [...ANALYTICS_KEY, 'global', userId],
        queryFn: () => api.analytics.global(userId!),
        enabled: !!userId,
        staleTime: 300000, // 5 minutes
    });
}
