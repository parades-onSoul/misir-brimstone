/**
 * Terminology — Translation table for user-facing labels
 * Maps technical backend terms to natural language per MISIR spec
 * 
 * USAGE:
 * - Use these constants in all UI labels, tooltips, headings
 * - Keep technical terms ONLY in: API responses, code internals, settings panel
 * - Never show users "artifact", "subspace", "confidence score", etc.
 */

/**
 * Core entity translations
 */
export const TERMINOLOGY = {
    // "Artifact" → friendly alternatives
    artifact: 'item',
    artifacts: 'items',
    Artifact: 'Item',
    Artifacts: 'Items',
    
    // "Subspace" → semantic clustering label
    subspace: 'topic',
    subspaces: 'topics',
    Subspace: 'Topic',
    Subspaces: 'Topics',
    'topic area': 'topic area',
    
    // "Confidence score" → user focus indicator
    confidence: 'focus',
    'confidence score': 'focus',
    Confidence: 'Focus',
    'Confidence Score': 'Focus',
    
    // "Drift magnitude" → semantic shift description
    drift: 'focus shift',
    'drift magnitude': 'how much focus shifted',
    Drift: 'Focus shift',
    'Drift Magnitude': 'Focus Shift',
    
    // "Assignment margin" → fit quality
    margin: 'fit',
    'assignment margin': 'how well it fits',
    Margin: 'Fit',
    'Assignment Margin': 'Fit',
    
    // Engagement levels → reading depth
    latent: 'skimmed',
    discovered: 'read',
    engaged: 'studied',
    saturated: 'deep dive',
    Latent: 'Skimmed',
    Discovered: 'Read',
    Engaged: 'Studied',
    Saturated: 'Deep dive',
} as const;

/**
 * Helper functions for programmatic translation
 */

/**
 * Translates technical term to user-facing label
 * @param term - Technical term from backend
 * @returns User-friendly label
 */
export function translate(term: string): string {
    return (TERMINOLOGY as Record<string, string>)[term] || term;
}

/**
 * Pluralizes user-facing terms correctly
 * @param term - Singular technical term
 * @param count - Item count
 * @returns Correctly pluralized label
 */
export function pluralize(term: string, count: number): string {
    if (count === 1) {
        return translate(term);
    }
    
    // Handle special plural forms
    const pluralMap: Record<string, string> = {
        artifact: 'items',
        subspace: 'topics',
        'topic area': 'topic areas',
    };
    
    return pluralMap[term] || translate(term) + 's';
}

/**
 * Context-aware label generation for tooltips
 */
export const TOOLTIPS = {
    focus: 'How confident the system is about this topic based on what you\'ve saved',
    fit: 'How well this item matches the topic\'s existing content',
    drift: 'How much saving this item shifted the topic\'s center',
    readingDepth: 'How deeply you engaged with this content',
    velocity: 'Items saved per week in this space',
    coverage: 'Percentage of topic area explored so far',
} as const;

/**
 * Settings panel exceptions (where technical terms are OK)
 */
export const TECHNICAL_LABELS = {
    confidence_threshold: 'Confidence Threshold',
    margin_threshold: 'Assignment Margin Threshold',
    drift_threshold: 'Drift Magnitude Threshold',
    embedding_model: 'Embedding Model',
    learning_rate: 'Centroid Learning Rate',
} as const;

/**
 * Natural language status messages
 */
export const STATUS_MESSAGES = {
    lookingGood: 'Looking good ✅',
    exploringNew: 'Exploring new territory ⚠️',
    focusShifting: 'Focus shifting 🔄',
    buildingUnderstanding: 'Building understanding 📊',
    needsAttention: 'Needs your attention ⚠️',
    allClear: 'All clear ✅',
} as const;

/**
 * Action button labels (user-facing)
 */
export const ACTION_LABELS = {
    saveItem: 'Save item',
    viewItem: 'View item',
    reviewItems: 'Review items',
    createTopic: 'Create new topic',
    viewMap: 'View knowledge map',
    viewTimeline: 'View timeline',
    exportData: 'Export data',
    deleteSpace: 'Delete space',
} as const;
