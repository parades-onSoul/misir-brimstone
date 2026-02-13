/**
 * Mathematical Constants — The Control Panel
 * 
 * All formulas reference these values. Change here, behavior changes everywhere.
 * This is the single source of truth for all tweakable parameters in Misir.
 */

// ============================================================================
// STATE THRESHOLDS
// ============================================================================

/**
 * Evidence thresholds for state transitions
 * 
 * k = max { i : E ≥ θ_i }
 */
export const STATE_THRESHOLDS = {
    /** Latent → Discovered */
    THETA_1: 1,
    /** Discovered → Engaged */
    THETA_2: 3,
    /** Engaged → Saturated */
    THETA_3: 6,
} as const;

/**
 * Total mass conserved across all states in a space
 * 
 * This is used for mass vector validation:
 * sum(stateVector) should equal TOTAL_MASS
 */
export const TOTAL_MASS = 10;

// ============================================================================
// DECAY RATES
// ============================================================================

/**
 * Tiered decay rates (λ per day) by state
 * 
 * Higher states decay slower to reward sustained engagement.
 * Half-life = ln(2) / λ ≈ 0.693 / λ
 */
export const DECAY_RATES = {
    /** Fast decay (t½ ≈ 4.6 days) - ephemeral interests fade quickly */
    latent: 0.15,
    /** Medium decay (t½ ≈ 5.8 days) */
    discovered: 0.12,
    /** Slower decay (t½ ≈ 6.9 days) - active interests persist */
    engaged: 0.10,
    /** Slowest decay (t½ ≈ 13.9 days) - established knowledge sticks */
    saturated: 0.05,
} as const;

/** Legacy single rate (use DECAY_RATES instead) */
export const DEFAULT_DECAY_RATE = 0.1;

// ============================================================================
// ARTIFACT WEIGHTS
// ============================================================================

/**
 * Artifact weights by engagement tier
 * 
 * Maps to artifact_type: ambient, engaged, committed
 */
export const ARTIFACT_WEIGHTS = {
    /** Passive (page view) */
    ambient: 0.2,
    /** Active (bookmark, save) */
    engaged: 1.0,
    /** Deep (highlight, annotate) */
    committed: 2.0,
} as const;

// ============================================================================
// READING DEPTH
// ============================================================================

/**
 * Reading depth multipliers for evidence calculation
 * 
 * δE = w × r × d (where d = reading depth)
 */
export const READING_DEPTH = {
    /** Page abandoned quickly */
    bounce: 0,
    /** Quick scan */
    skim: 0.5,
    /** Normal reading (default) */
    browse: 1.0,
    /** Extended engagement */
    deepRead: 1.5,
} as const;

/** Maximum reading depth multiplier */
export const MAX_READING_DEPTH = 1.5;

// ============================================================================
// MATCHING THRESHOLDS
// ============================================================================

/**
 * Semantic matching thresholds for 3-layer matching
 */
export const MATCHING_THRESHOLDS = {
    /** Layer 1 cosine similarity threshold */
    semanticGating: 0.4,
    /** Layer 2 marker confirmation threshold */
    markerConfirmation: 0.5,
    /** Auto-capture threshold for ambient artifacts */
    ambientCapture: 0.3,
    /** Manual save threshold for engaged artifacts */
    engagedCapture: 0.1,
} as const;

// ============================================================================
// RELEVANCE BLEND
// ============================================================================

/**
 * Weights for combining semantic and marker scores
 * 
 * relevance = (semantic × semanticWeight) + (marker × markerWeight)
 */
export const RELEVANCE_BLEND = {
    /** Semantic similarity weight (40%) */
    semanticWeight: 0.4,
    /** Marker confirmation weight (60%) */
    markerWeight: 0.6,
} as const;

// ============================================================================
// STALE MULTIPLIERS
// ============================================================================

/**
 * Activity-aware decay multipliers
 * 
 * Effective decay = λ × staleMultiplier
 */
export const STALE_MULTIPLIERS = {
    /** < 3 days since last activity */
    active: 1.0,
    /** 3-14 days - reduced decay (benefit of doubt) */
    stale: 0.5,
    /** Saturated + stale - very slow decay */
    saturatedStale: 0.25,
    /** Paused - no decay */
    paused: 0,
    /** 14+ days - normal decay resumes */
    inactive: 1.0,
} as const;

/**
 * Activity thresholds in days
 */
export const ACTIVITY_THRESHOLDS = {
    /** Days before considered stale */
    staleAfterDays: 3,
    /** Days before considered inactive */
    inactiveAfterDays: 14,
} as const;

// ============================================================================
// DETECTION THRESHOLDS
// ============================================================================

/**
 * Thresholds for insight/delta detection
 */
export const DETECTION_THRESHOLDS = {
    /** 40% concentration triggers imbalance */
    imbalance: 0.4,
    /** Days before gap detection */
    gapDormancyDays: 14,
    /** Saturated + inactive triggers false stability */
    falseStabilityDays: 10,
    /** URLs in 1 hour triggers rabbit hole */
    rabbitHoleUrls: 5,
    /** Words over 7 days triggers consumption trap */
    consumptionTrapWords: 10000,
} as const;

// ============================================================================
// BASELINE CONFIG
// ============================================================================

/**
 * Configuration for baseline computation (WMA)
 */
export const BASELINE_CONFIG = {
    /** Historical lookback window */
    windowDays: 30,
    /** WMA decay factor (α) */
    alpha: 0.1,
} as const;

// ============================================================================
// FALSE STABILITY CONFIG
// ============================================================================

/**
 * Configuration for false stability detection
 */
export const FALSE_STABILITY_CONFIG = {
    windowDays: 10,
    epsilon: 0.5,
    minArtifacts: 2,
} as const;

