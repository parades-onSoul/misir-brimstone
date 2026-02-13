/**
 * useStats Hook
 * 
 * Data-fetching hook for dashboard statistics.
 * Fetches directly from Supabase since stats are derived from artifacts.
 */

import useSWR from 'swr';
import { defaultSwrOptions } from './swr-config';
import { createBrowserClient } from '@supabase/ssr';

interface StatsData {
    totalArtifacts: number;
    today: number;
    thisWeek: number;
    weeklyChange: number;
    activeSpaces: number;
    avgRelevance: number;
    streakDays: number;
    sourceBreakdown: {
        web: number;
        ai: number;
        video: number;
        pdf: number;
    };
}

interface HeatmapDay {
    date: string;
    count: number;
    sources: {
        web: number;
        ai: number;
        video: number;
        pdf: number;
    };
}

/**
 * Fetch stats from Supabase
 */
async function statsFetcher(): Promise<StatsData> {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const lastWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
    
    // Get all artifacts
    const { data: artifacts, error } = await supabase
        .from('artifacts')
        .select('id, content_source, relevance, created_at, space_id');
    
    if (error) throw error;
    
    const all = artifacts || [];
    const today = all.filter(a => a.created_at >= todayStart);
    const thisWeek = all.filter(a => a.created_at >= weekStart);
    const lastWeek = all.filter(a => a.created_at >= lastWeekStart && a.created_at < weekStart);
    
    // Source breakdown
    const sourceBreakdown = { web: 0, ai: 0, video: 0, pdf: 0 };
    all.forEach(a => {
        if (a.content_source in sourceBreakdown) {
            sourceBreakdown[a.content_source as keyof typeof sourceBreakdown]++;
        }
    });
    
    // Active spaces
    const uniqueSpaces = new Set(all.map(a => a.space_id).filter(Boolean));
    
    // Average relevance
    const relevanceScores = all.map(a => a.relevance).filter((r): r is number => r !== null);
    const avgRelevance = relevanceScores.length > 0 
        ? relevanceScores.reduce((a, b) => a + b, 0) / relevanceScores.length 
        : 0;
    
    return {
        totalArtifacts: all.length,
        today: today.length,
        thisWeek: thisWeek.length,
        weeklyChange: thisWeek.length - lastWeek.length,
        activeSpaces: uniqueSpaces.size,
        avgRelevance: Math.round(avgRelevance * 100) / 100,
        streakDays: 0, // TODO: Calculate streak
        sourceBreakdown,
    };
}

/**
 * Fetch heatmap data from Supabase
 */
async function heatmapFetcher(key: string): Promise<HeatmapDay[]> {
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Parse weeks from key
    const [, weeksStr] = key.split(':');
    const weeks = parseInt(weeksStr) || 12;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (weeks * 7));
    
    const { data: artifacts, error } = await supabase
        .from('artifacts')
        .select('created_at, content_source')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    // Group by date
    const byDate: Record<string, HeatmapDay> = {};
    
    (artifacts || []).forEach(a => {
        const date = a.created_at.split('T')[0];
        if (!byDate[date]) {
            byDate[date] = { date, count: 0, sources: { web: 0, ai: 0, video: 0, pdf: 0 } };
        }
        byDate[date].count++;
        if (a.content_source in byDate[date].sources) {
            byDate[date].sources[a.content_source as keyof typeof byDate[string]['sources']]++;
        }
    });
    
    return Object.values(byDate);
}

/**
 * Fetch dashboard statistics.
 */
export function useStats() {
    const { data, error, isLoading, mutate } = useSWR<StatsData>(
        'stats:dashboard',
        statsFetcher,
        {
            ...defaultSwrOptions,
            revalidateOnFocus: false, // Stats don't need constant refresh
        }
    );

    return {
        stats: data || null,
        isLoading,
        isError: !!error,
        error,
        refresh: mutate,
    };
}

/**
 * Fetch heatmap data.
 */
export function useHeatmap(weeks: number = 12) {
    const { data, error, isLoading, mutate } = useSWR<HeatmapDay[]>(
        `heatmap:${weeks}`,
        heatmapFetcher,
        {
            ...defaultSwrOptions,
            revalidateOnFocus: false,
        }
    );

    return {
        heatmapData: data || [],
        isLoading,
        isError: !!error,
        error,
        refresh: mutate,
    };
}
