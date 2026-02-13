/**
 * useReport Hook
 * 
 * Data-fetching hook for report data.
 */

import useSWR from 'swr';
import { useMemo } from 'react';
import { fetcher, defaultSwrOptions } from './swr-config';
import { generateGlobalReport, generateSpaceReport } from '@/lib/engine/report-generator';
import type { Report, ReportPeriod } from '@/lib/types/reports';

interface SpaceData {
    id: string;
    name: string;
    subspaces: { name: string; evidence: number }[];
}

interface ReportDataResponse {
    spaces: SpaceData[];
    period: ReportPeriod;
}

interface UseReportOptions {
    /** Period to fetch report for */
    period: ReportPeriod;
    /** Space ID for space-scoped report, null for global */
    spaceId?: string | null;
    /** Disable fetching */
    enabled?: boolean;
}

/**
 * Fetch and generate a report.
 */
export function useReport(options: UseReportOptions) {
    const { period, spaceId, enabled = true } = options;

    const params = new URLSearchParams();
    params.append('period', period);
    if (spaceId) {
        params.append('spaceId', spaceId);
    }

    const url = enabled ? `/api/reports/data?${params.toString()}` : null;

    const { data, error, isLoading, mutate } = useSWR<ReportDataResponse>(
        url,
        fetcher,
        {
            ...defaultSwrOptions,
            revalidateOnFocus: false,
        }
    );

    // Generate report from fetched data
    const report = useMemo<Report | null>(() => {
        if (!data || data.spaces.length === 0) return null;

        // Deduplicate spaces by ID to prevent key errors
        const uniqueSpaces = Array.from(new Map(data.spaces.map(s => [s.id, s])).values());

        if (spaceId) {
            const space = uniqueSpaces.find(s => s.id === spaceId);
            if (!space) return null;
            return generateSpaceReport(space as any, period);
        }
        return generateGlobalReport(uniqueSpaces as any, period);
    }, [data, spaceId, period]);

    return {
        report,
        rawData: data,
        isLoading,
        isError: !!error,
        error,
        refresh: mutate,
    };
}

// ─────────────────────────────────────────────────────────────────
// Report Helper Functions
// ─────────────────────────────────────────────────────────────────

export function getConfidenceLevel(report: Report): string {
    if (report.scope === 'global') {
        const gr = report as any;
        if (gr.totalSubspaces > 20) return 'High (based on activity volume)';
        if (gr.totalSubspaces > 10) return 'Medium–High (based on activity consistency)';
        return 'Low–Medium (limited data)';
    }
    const sr = report as any;
    if (sr.totalEvidence > 30) return 'High (based on activity volume)';
    if (sr.totalEvidence > 15) return 'Medium–High (based on activity consistency)';
    return 'Low–Medium (limited data)';
}

export function getOneLineInsight(report: Report): string {
    const deepening = report.deepeningPercent;
    const exploration = report.explorationPercent;

    if (deepening > 70) {
        return '"You are strengthening what you know well, but new knowledge intake is lagging behind your current depth."';
    }
    if (exploration > 80) {
        return '"You are exploring widely but haven\'t committed deeply to any area yet. Consider focusing on what resonates."';
    }
    if (report.allocation.saturated > 30) {
        return '"Several knowledge areas have stabilized. Your system is mature but may benefit from new challenges."';
    }
    if (deepening > 50 && exploration > 30) {
        return '"You are maintaining a healthy balance between deepening existing knowledge and exploring new areas."';
    }
    return '"Your knowledge system is in early stages. Continue building momentum across your areas of interest."';
}

export function getTimeWindow(period: ReportPeriod): string {
    switch (period) {
        case 'daily': return 'Today';
        case 'weekly': return 'Last 7 days';
        case 'monthly': return 'Last 30 days';
        case 'yearly': return 'Last 365 days';
    }
}
