'use client';

/**
 * Artifacts Hooks — TanStack Query hooks for artifact operations
 */
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import api from '@/lib/api/client';
import type { Artifact } from '@/types/api';

const ARTIFACTS_KEY = ['artifacts'] as const;

export function useSpaceArtifacts(spaceId: number | undefined, userId: string | undefined) {
    return useInfiniteQuery({
        queryKey: [...ARTIFACTS_KEY, 'space', spaceId],
        queryFn: async ({ pageParam = 1 }) => {
            if (!userId || !spaceId) {
                return { items: [], count: 0, page: 1, page_size: 50 };
            }
            return api.spaces.getArtifacts(spaceId, userId, pageParam, 50);
        },
        getNextPageParam: (lastPage) => {
            if (!lastPage || lastPage.items.length < lastPage.page_size!) {
                return undefined;
            }
            return (lastPage.page || 1) + 1;
        },
        enabled: !!userId && !!spaceId,
    });
}


export function useAllUserArtifacts(userId: string | undefined, limit: number = 100) {
    return useQuery({
        queryKey: [...ARTIFACTS_KEY, 'all', userId],
        queryFn: async (): Promise<Artifact[]> => {
            if (!userId) return [];
            return api.artifacts.list(userId, limit);
        },
        enabled: !!userId,
    });
}

