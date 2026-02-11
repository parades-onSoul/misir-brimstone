'use client';

/**
 * Search Hooks — TanStack Query hooks for semantic search (Backend v1.0)
 */
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api/client';

const SEARCH_KEY = ['search'] as const;

export function useSearch(
    query: string,
    filters: {
        space_id?: number;
        subspace_id?: number;
        limit?: number;
        threshold?: number;
    } = {},
    enabled = true
) {
    return useQuery({
        queryKey: [...SEARCH_KEY, query, filters],
        queryFn: () => api.search(query, filters),
        enabled: enabled && query.length > 0,
        staleTime: 60000, // 1 minute
        gcTime: 300000,   // 5 minutes
    });   
}
