'use client';

/**
 * Artifacts Hooks — TanStack Query hooks for artifact operations
 */
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import api from '@/lib/api/client';
import type { Artifact, PaginatedResponse } from '@/types/api';

const ARTIFACTS_KEY = ['artifacts'] as const;

type SpaceArtifactsPage = PaginatedResponse<Artifact> & { artifacts: Artifact[] };

export function useSpaceArtifacts(spaceId: number | undefined, userId: string | undefined) {
    return useInfiniteQuery<SpaceArtifactsPage, Error, InfiniteData<SpaceArtifactsPage>>({
        queryKey: [...ARTIFACTS_KEY, 'space', spaceId, userId],
        initialPageParam: 1,
        queryFn: async ({ pageParam = 1 }) => {
            if (!userId || !spaceId) {
                return { items: [], artifacts: [], count: 0, page: 1, page_size: 50 };
            }
            const page = typeof pageParam === 'number' ? pageParam : 1;
            return api.spaces.getArtifacts(spaceId, userId, page, 50);
        },
        getNextPageParam: (lastPage) => {
            const pageSize = lastPage.page_size ?? 50;
            if (!lastPage || lastPage.items.length < pageSize) {
                return undefined;
            }
            return (lastPage.page || 1) + 1;
        },
        enabled: !!userId && !!spaceId,
        staleTime: 10_000,
        refetchOnWindowFocus: 'always',
        refetchOnReconnect: true,
        refetchInterval: 30_000,
    });
}


export function useAllUserArtifacts(userId: string | undefined, limit: number = 100) {
    return useQuery({
        queryKey: [...ARTIFACTS_KEY, 'all', userId],
        queryFn: async (): Promise<Artifact[]> => {
            if (!userId) return [];
            return api.artifacts.list(limit);
        },
        enabled: !!userId,
    });
}

