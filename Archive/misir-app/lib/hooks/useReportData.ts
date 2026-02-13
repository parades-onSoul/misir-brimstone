import { useState, useCallback } from 'react';
import type { Report, ReportPeriod, ReportScope } from '@/lib/types/reports';
import { generateGlobalReport, generateSpaceReport } from '@/lib/engine/report-generator';

interface ReportDataResponse {
  period: ReportPeriod;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  spaces: Array<{
    id: string;
    name: string;
    intention?: string;
    subspaces: Array<{
      id: string;
      space_id: string;
      name: string;
      evidence: number;
      artifactCount: number;
      artifacts: any[];
    }>;
  }>;
  subspaces: any[];
  artifacts: any[];
  aggregates: {
    totalArtifacts: number;
    totalSubspaces: number;
    totalSpaces: number;
    totalEvidence: number;
  };
}

export function useReportData() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(
    async (
      period: ReportPeriod,
      scope: ReportScope,
      spaceId?: string
    ): Promise<{ report: Report | null; data: ReportDataResponse | null }> => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.append('period', period);
        if (spaceId && scope === 'space') {
          params.append('spaceId', spaceId);
        }

        const response = await fetch(`/api/reports/data?${params.toString()}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch report data: ${response.statusText}`);
        }

        const data: ReportDataResponse = await response.json();

        // Generate report from fetched data
        let report: Report | null = null;

        if (scope === 'global') {
          report = generateGlobalReport(data.spaces, period);
        } else if (scope === 'space' && spaceId) {
          const space = data.spaces.find(s => s.id === spaceId);
          if (space) {
            report = generateSpaceReport(space, period);
          }
        }

        setLoading(false);
        return { report, data };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        setLoading(false);
        return { report: null, data: null };
      }
    },
    []
  );

  return { fetchReport, loading, error };
}
