/**
 * useBackend Hook
 * 
 * Monitor backend connection status and provide backend API access.
 */

import useSWR from 'swr';
import { backendApi, BACKEND_URL, type UserMapResponse } from '@/lib/api/backend';

interface BackendStatus {
    connected: boolean;
    url: string;
    error?: string;
}

/**
 * Check backend health
 */
async function healthFetcher(): Promise<BackendStatus> {
    try {
        await backendApi.health();
        return { connected: true, url: BACKEND_URL };
    } catch (error) {
        return { 
            connected: false, 
            url: BACKEND_URL,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Monitor backend connection status.
 * Polls every 30 seconds.
 */
export function useBackendStatus() {
    const { data, error, isLoading, mutate } = useSWR<BackendStatus>(
        'backend:health',
        healthFetcher,
        {
            refreshInterval: 30000, // Check every 30s
            revalidateOnFocus: true,
            dedupingInterval: 5000,
        }
    );

    return {
        isConnected: data?.connected ?? false,
        isLoading,
        backendUrl: data?.url || BACKEND_URL,
        error: data?.error || (error instanceof Error ? error.message : undefined),
        refresh: mutate,
    };
}

/**
 * Fetch user map from backend (what extension sees).
 * Useful for debugging/viewing extension data.
 */
export function useUserMap() {
    const { data, error, isLoading, mutate } = useSWR<UserMapResponse>(
        'backend:usermap',
        async () => {
            return await backendApi.extension.getMap();
        },
        {
            refreshInterval: 60000, // Refresh every minute
            revalidateOnFocus: true,
        }
    );

    return {
        userMap: data,
        isLoading,
        isError: !!error,
        error,
        refresh: mutate,
    };
}
