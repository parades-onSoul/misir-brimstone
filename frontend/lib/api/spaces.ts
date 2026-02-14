'use client';

// Spaces hooks for TanStack Query
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import api from '@/lib/api/client';
import type { CreateSpaceRequest, SpaceResponse, UpdateSpaceRequest } from '@/types/api';

const SPACES_KEY = ['spaces'] as const;
const SUBSPACES_KEY = ['subspaces'] as const;

export function useSpaces(userId: string | undefined) {
    return useQuery({
        queryKey: [...SPACES_KEY, userId],
        queryFn: () => api.spaces.list(userId!),
        enabled: !!userId,
        staleTime: 10_000,
        refetchOnWindowFocus: 'always',
        refetchOnReconnect: true,
        refetchInterval: 20_000,
    });
}

export function useSpace(spaceId: number, userId: string | undefined) {
    return useQuery({
        queryKey: [...SPACES_KEY, spaceId, userId],
        queryFn: () => api.spaces.get(spaceId, userId!),
        enabled: !!userId && !!spaceId,
        staleTime: 10_000,
        refetchOnWindowFocus: 'always',
        refetchOnReconnect: true,
        refetchInterval: 20_000,
    });
}

export function useSubspaces(spaceId: number | undefined, userId: string | undefined) {
    return useQuery({
        queryKey: [...SUBSPACES_KEY, spaceId, userId],
        queryFn: () => api.spaces.getSubspaces(spaceId!, userId!),
        enabled: !!spaceId && !!userId,
        staleTime: 10_000,
        refetchOnWindowFocus: 'always',
        refetchOnReconnect: true,
        refetchInterval: 15_000,
    });
}

export function useCreateSubspace() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            spaceId,
            data,
        }: {
            spaceId: number;
            data: { name: string; description?: string; markers?: string[] };
        }) => api.spaces.createSubspace(spaceId, data),
        onSuccess: (_created, variables) => {
            queryClient.invalidateQueries({ queryKey: [...SUBSPACES_KEY, variables.spaceId] });
            queryClient.invalidateQueries({ queryKey: [...SPACES_KEY, variables.spaceId] });
            queryClient.invalidateQueries({ queryKey: [...SPACES_KEY, variables.spaceId, 'artifacts'] });
        },
    });
}

export function useUpdateSubspace() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            spaceId,
            subspaceId,
            data,
        }: {
            spaceId: number;
            subspaceId: number;
            data: { name?: string; description?: string };
        }) => api.spaces.updateSubspace(spaceId, subspaceId, data),
        onSuccess: (_updated, variables) => {
            queryClient.invalidateQueries({ queryKey: [...SUBSPACES_KEY, variables.spaceId] });
            queryClient.invalidateQueries({ queryKey: [...SPACES_KEY, variables.spaceId] });
        },
    });
}

export function useDeleteSubspace() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ spaceId, subspaceId }: { spaceId: number; subspaceId: number }) =>
            api.spaces.deleteSubspace(spaceId, subspaceId),
        onSuccess: (_deleted, variables) => {
            queryClient.invalidateQueries({ queryKey: [...SUBSPACES_KEY, variables.spaceId] });
            queryClient.invalidateQueries({ queryKey: [...SPACES_KEY, variables.spaceId] });
            queryClient.invalidateQueries({ queryKey: [...SPACES_KEY, variables.spaceId, 'artifacts'] });
        },
    });
}

export function useMergeSubspace() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            spaceId,
            sourceSubspaceId,
            targetSubspaceId,
        }: {
            spaceId: number;
            sourceSubspaceId: number;
            targetSubspaceId: number;
        }) => api.spaces.mergeSubspace(spaceId, sourceSubspaceId, targetSubspaceId),
        onSuccess: (_merged, variables) => {
            queryClient.invalidateQueries({ queryKey: [...SUBSPACES_KEY, variables.spaceId] });
            queryClient.invalidateQueries({ queryKey: [...SPACES_KEY, variables.spaceId] });
            queryClient.invalidateQueries({ queryKey: [...SPACES_KEY, variables.spaceId, 'artifacts'] });
            queryClient.invalidateQueries({ queryKey: [...SPACES_KEY, variables.spaceId, 'alerts'] });
        },
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
        staleTime: 10_000,
        refetchOnWindowFocus: 'always',
        refetchOnReconnect: true,
        refetchInterval: 30_000,
    });
}

export function useUpdateSpace() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            spaceId,
            userId,
            data,
        }: {
            spaceId: number;
            userId: string;
            data: UpdateSpaceRequest;
        }) => api.spaces.update(spaceId, userId, data),
        onSuccess: (_updatedSpace, variables) => {
            queryClient.invalidateQueries({ queryKey: [...SPACES_KEY, variables.userId] });
            queryClient.invalidateQueries({ queryKey: [...SPACES_KEY, variables.spaceId, variables.userId] });
        },
    });
}

export function useSpaceArtifacts(spaceId: number, userId: string | undefined, page: number = 1, pageSize: number = 50) {
    return useQuery({
        queryKey: [...SPACES_KEY, spaceId, 'artifacts', userId, page, pageSize],
        queryFn: () => api.spaces.getArtifacts(spaceId, userId!, page, pageSize),
        enabled: !!userId && !!spaceId,
        placeholderData: keepPreviousData,
        staleTime: 10_000,
        refetchOnWindowFocus: 'always',
        refetchOnReconnect: true,
        refetchInterval: 15_000,
    });
}

export function useSpaceAlerts(spaceId: number, userId: string | undefined) {
    return useQuery({
        queryKey: [...SPACES_KEY, spaceId, 'alerts', userId],
        queryFn: () => api.spaces.getAlerts(spaceId, userId!),
        enabled: !!userId && !!spaceId,
        staleTime: 10_000,
        refetchOnWindowFocus: 'always',
        refetchOnReconnect: true,
        refetchInterval: 20_000,
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
        staleTime: 10_000,
        refetchOnWindowFocus: 'always',
        refetchOnReconnect: true,
        refetchInterval: 20_000,
    });
}
