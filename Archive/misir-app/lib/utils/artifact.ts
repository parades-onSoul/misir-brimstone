/**
 * Artifact Utilities
 * 
 * Consolidated constants and helpers for artifact display.
 */

export type ArtifactType = 'ambient' | 'engaged' | 'committed';

/**
 * Color classes for artifact types (Tailwind).
 */
export const ARTIFACT_TYPE_COLORS: Record<ArtifactType, string> = {
    ambient: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    engaged: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    committed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};

/**
 * Human-readable labels for artifact types.
 */
export const ARTIFACT_TYPE_LABELS: Record<ArtifactType, string> = {
    ambient: 'Browsed',
    engaged: 'Engaged',
    committed: 'Saved',
};

/**
 * Alternative labels (shorter).
 */
export const ARTIFACT_TYPE_SHORT_LABELS: Record<ArtifactType, string> = {
    ambient: 'Ambient',
    engaged: 'Engaged',
    committed: 'Committed',
};

/**
 * Gets the relevance display class based on score.
 */
export function getRelevanceClass(relevance: number): string {
    if (relevance > 0.8) return 'text-green-600 font-bold';
    if (relevance > 0.5) return 'text-blue-600 font-medium';
    return 'text-muted-foreground';
}

/**
 * Formats relevance as percentage string.
 */
export function formatRelevance(relevance: number): string {
    return `${(relevance * 100).toFixed(0)}%`;
}

/**
 * Formats word count with K suffix for thousands.
 */
export function formatWordCount(count: number): string {
    if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}k words`;
    }
    return `${count} words`;
}

/**
 * State colors for subspace states.
 */
export const STATE_COLORS = {
    saturated: '#F0F3FF',
    engaged: '#15F5BA',
    discovered: '#836FFF',
    latent: '#211951',
} as const;

export type SubspaceState = keyof typeof STATE_COLORS;

/**
 * Gets state from evidence level.
 */
export function getStateFromEvidence(evidence: number): SubspaceState {
    if (evidence >= 6) return 'saturated';
    if (evidence >= 3) return 'engaged';
    if (evidence >= 1) return 'discovered';
    return 'latent';
}
