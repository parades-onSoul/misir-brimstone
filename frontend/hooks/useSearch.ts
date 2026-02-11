/**
 * useSearch — React Query hook for semantic search
 */
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api/client';
import type { SearchResponse } from '@/types/api';

export interface UseSearchOptions {
    query: string;
    userId: string;
    spaceId?: number;
    limit?: number;
    enabled?: boolean;
}

/**
 * Search artifacts by semantic similarity
 */
export function useSearch({ query, userId, spaceId, limit = 20, enabled = true }: UseSearchOptions) {
    return useQuery<SearchResponse>({
        queryKey: ['search', query, spaceId, limit],
        queryFn: async () => {
            if (!query.trim()) {
                return {
                    results: [],
                    query: query,
                    count: 0,
                    dimension_used: 0,
                };
            }
            return api.search(query, userId, spaceId, limit);
        },
        enabled: enabled && query.trim().length > 0,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}
