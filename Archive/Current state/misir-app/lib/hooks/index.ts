/**
 * Hooks Index
 * 
 * Re-exports for cleaner imports.
 */

// Data fetching hooks
export { useArtifacts, useAllArtifacts } from './use-artifacts';
export { useSpaces, useSpace } from './use-spaces';
export { useInsights, useInsightCount } from './use-insights';
export { useStats, useHeatmap } from './use-stats';
export { useReport, getConfidenceLevel, getOneLineInsight, getTimeWindow } from './use-report';
export { useBackendStatus, useUserMap } from './use-backend';

// Utility hooks
export { usePolling } from './use-polling';
export type { UsePollingOptions, UsePollingResult } from './use-polling';

// SWR configuration
export { fetcher, defaultSwrOptions } from './swr-config';

