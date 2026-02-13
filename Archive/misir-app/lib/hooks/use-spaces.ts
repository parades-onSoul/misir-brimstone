/**
 * useSpaces Hook
 * 
 * Data-fetching hook for spaces using SWR.
 * Integrates with existing Zustand store for consistency.
 */

import useSWR from 'swr';
import { useEffect } from 'react';
import { fetcher, defaultSwrOptions } from './swr-config';
import { useSpaceStore } from '@/lib/store';

interface SubspaceData {
    name: string;
    evidence: number;
}

interface SpaceData {
    id: string;
    name: string;
    description: string | null;
    subspaces: SubspaceData[] | null;
    created_at: string;
    updated_at: string;
}

interface SpacesResponse {
    spaces: SpaceData[];
}

interface UseSpacesOptions {
    /** Sync with Zustand store */
    syncToStore?: boolean;
    /** Disable fetching */
    enabled?: boolean;
}

/**
 * Fetch all spaces for the current user.
 * Optionally syncs to the global Zustand store.
 */
export function useSpaces(options: UseSpacesOptions = {}) {
    const { syncToStore = false, enabled = true } = options;
    const { setSpaces, spaces: storeSpaces } = useSpaceStore();

    const { data, error, isLoading, mutate } = useSWR<SpacesResponse>(
        enabled ? '/api/spaces' : null,
        fetcher,
        {
            ...defaultSwrOptions,
            // Use store data as fallback
            fallbackData: storeSpaces.length > 0
                ? { spaces: storeSpaces as unknown as SpaceData[] }
                : undefined,
        }
    );

    // Sync to Zustand store if enabled
    useEffect(() => {
        if (syncToStore && data?.spaces) {
            setSpaces(data.spaces as any);
        }
    }, [data, syncToStore, setSpaces]);

    return {
        spaces: data?.spaces || [],
        isLoading,
        isError: !!error,
        error,
        refresh: mutate,
    };
}

/**
 * Fetch a single space by ID.
 * Refactored to reuse useSpaces and filter client-side since /api/spaces/[id] doesn't exist.
 */
export function useSpace(spaceId: string | null) {
    const { spaces, isLoading, error, refresh } = useSpaces({ enabled: !!spaceId });

    const space = spaceId
        ? spaces.find(s => s.id === spaceId) || null
        : null;

    return {
        space,
        isLoading,
        isError: !!error || (!!spaceId && !isLoading && !space),
        error,
        refresh,
    };
}
