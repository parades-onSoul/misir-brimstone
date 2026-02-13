/**
 * Utils Index
 * 
 * Central export for all utility modules.
 */

// URL utilities
export { getDomain, isValidUrl, getFaviconUrl, normalizeUrl } from './url';

// Date utilities
export {
    formatDate,
    formatDateTime,
    formatShortDate,
    formatTime,
    getTimeAgo,
    getDateLabel,
    isToday,
    isYesterday,
} from './date';

// Artifact utilities
export {
    ARTIFACT_TYPE_COLORS,
    ARTIFACT_TYPE_LABELS,
    ARTIFACT_TYPE_SHORT_LABELS,
    STATE_COLORS,
    getRelevanceClass,
    formatRelevance,
    formatWordCount,
    getStateFromEvidence,
    type ArtifactType,
    type SubspaceState,
} from './artifact';
