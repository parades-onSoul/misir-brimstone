/**
 * useArtifacts Hook
 * 
 * Data-fetching hook for artifacts using SWR.
 * Artifacts are synced to Supabase by the FastAPI backend (from extension).
 */

import useSWR from 'swr';
import { defaultSwrOptions } from './swr-config';
import { createBrowserClient } from '@supabase/ssr';

interface ArtifactData {
    id: string;
    title: string;
    url: string;
    content_source: 'web' | 'ai' | 'video' | 'pdf';
    relevance: number | null;
    base_weight: number;
    word_count: number | null;
    created_at: string;
    space_id: string;
    subspace_id?: string;
    extracted_text?: string;
}

interface ArtifactWithSpace extends ArtifactData {
    spaces?: { name: string };
}

interface UseArtifactsOptions {
    /** Limit number of artifacts returned */
    limit?: number;
    /** Disable fetching */
    enabled?: boolean;
}

/**
 * Supabase fetcher for artifacts
 */
async function artifactsFetcher(key: string): Promise<ArtifactData[]> {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Parse key format: "artifacts:spaceId:limit" or "artifacts:all:limit"
    const [, spaceId, limitStr] = key.split(':');
    const limit = limitStr ? parseInt(limitStr) : 50;
    
    let query = supabase
        .from('artifacts')
        .select('id, title, url, content_source, relevance, base_weight, word_count, created_at, space_id, subspace_id')
        .order('created_at', { ascending: false })
        .limit(limit);
    
    if (spaceId && spaceId !== 'all') {
        query = query.eq('space_id', spaceId);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

/**
 * Fetch artifacts for a specific space.
 */
export function useArtifacts(spaceId: string | null, options: UseArtifactsOptions = {}) {
    const { limit = 50, enabled = true } = options;

    const key = spaceId && enabled
        ? `artifacts:${spaceId}:${limit}`
        : null;

    const { data, error, isLoading, mutate } = useSWR<ArtifactData[]>(
        key,
        artifactsFetcher,
        defaultSwrOptions
    );

    return {
        artifacts: data || [],
        isLoading,
        isError: !!error,
        error,
        refresh: mutate,
    };
}

/**
 * Fetch all artifacts for the current user (across all spaces).
 */
export function useAllArtifacts(options: UseArtifactsOptions = {}) {
    const { limit = 50, enabled = true } = options;

    const key = enabled
        ? `artifacts:all:${limit}`
        : null;

    const { data, error, isLoading, mutate } = useSWR<ArtifactData[]>(
        key,
        artifactsFetcher,
        defaultSwrOptions
    );

    return {
        artifacts: data || [],
        isLoading,
        isError: !!error,
        error,
        refresh: mutate,
    };
}
