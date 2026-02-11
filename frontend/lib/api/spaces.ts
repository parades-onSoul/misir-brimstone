'use client';

// Spaces hooks for TanStack Query
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import api from '@/lib/api/client';
import type { CreateSpaceRequest, SpaceResponse } from '@/types/api';

const SPACES_KEY = ['spaces'] as const;
const SUBSPACES_KEY = ['subspaces'] as const;

export function useSpaces(userId: string | undefined) {
    return useQuery({
        queryKey: [...SPACES_KEY, userId],
        queryFn: () => api.spaces.list(userId!),
        enabled: !!userId,
        staleTime: 30000,
    });
}

export function useSpace(spaceId: number, userId: string | undefined) {
    return useQuery({
        queryKey: [...SPACES_KEY, spaceId, userId],
        queryFn: () => api.spaces.get(spaceId, userId!),
        enabled: !!userId && !!spaceId,
        staleTime: 60000,
    });
}

export function useSubspaces(spaceId: number | undefined, userId: string | undefined) {
    return useQuery({
        queryKey: [...SUBSPACES_KEY, spaceId, userId],
        queryFn: () => api.spaces.getSubspaces(spaceId!, userId!),
        enabled: !!spaceId && !!userId,
        staleTime: 60000,
    });
}

export function useCreateSpace() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ data, userId }: { data: CreateSpaceRequest; userId: string }) =>
            api.spaces.create(data, userId),
        onSuccess: (_newSpace: SpaceResponse, variables) => {
            queryClient.invalidateQueries({ queryKey: [...SPACES_KEY, variables.userId] });
        },
    });
}

export function useDeleteSpace() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ spaceId, userId }: { spaceId: number; userId: string }) => {
            return api.spaces.delete(spaceId, userId);
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: [...SPACES_KEY, variables.userId] });
        },
    });
}

export function useSpaceTimeline(spaceId: number, userId: string | undefined) {
    return useQuery({
        queryKey: [...SPACES_KEY, spaceId, 'timeline', userId],
        queryFn: () => api.spaces.getTimeline(spaceId, userId!),
        enabled: !!userId && !!spaceId,
        staleTime: 60000,
    });
}

export function useSpaceArtifacts(spaceId: number, userId: string | undefined, page: number = 1, pageSize: number = 50) {
    return useQuery({
        queryKey: [...SPACES_KEY, spaceId, 'artifacts', userId, page, pageSize],
        queryFn: () => api.spaces.getArtifacts(spaceId, userId!, page, pageSize),
        enabled: !!userId && !!spaceId,
        placeholderData: keepPreviousData,
        staleTime: 30000,
    });
}

export function useSpaceAlerts(spaceId: number, userId: string | undefined) {
    return useQuery({
        queryKey: [...SPACES_KEY, spaceId, 'alerts', userId],
        queryFn: () => api.spaces.getAlerts(spaceId, userId!),
        enabled: !!userId && !!spaceId,
        staleTime: 60000,
    });
}

export function useAllSpaceAlerts(userId: string | undefined, spaceIds: number[]) {
    return useQuery({
        queryKey: [...SPACES_KEY, 'all-alerts', userId, spaceIds],
        queryFn: async () => {
            if (!userId || spaceIds.length === 0) return [];
            const alerts = await Promise.all(
                spaceIds.map(spaceId => api.spaces.getAlerts(spaceId, userId))
            );
            return alerts.flatMap(response => response.alerts || []);
        },
        enabled: !!userId && spaceIds.length > 0,
        staleTime: 60000,
    });
}
