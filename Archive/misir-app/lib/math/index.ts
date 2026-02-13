/**
 * Misir Mathematical Engine
 * 
 * Pure mathematical functions for evidence, decay, states, and baselines.
 * No database calls, no side effects — just math.
 * 
 * Usage:
 *   import { calculateDeltaEvidence, STATE_THRESHOLDS } from '@/lib/math';
 */

// ============================================================================
// Constants — The Control Panel
// ============================================================================

export {
    // State thresholds
    STATE_THRESHOLDS,

    // Total mass for state vectors
    TOTAL_MASS,

    // Decay rates
    DECAY_RATES,
    DEFAULT_DECAY_RATE,

    // Artifact weights
    ARTIFACT_WEIGHTS,

    // Reading depth
    READING_DEPTH,
    MAX_READING_DEPTH,

    // Matching thresholds
    MATCHING_THRESHOLDS,

    // Relevance blend
    RELEVANCE_BLEND,

    // Stale multipliers
    STALE_MULTIPLIERS,
    ACTIVITY_THRESHOLDS,

    // Detection thresholds
    DETECTION_THRESHOLDS,

    // Baseline config
    BASELINE_CONFIG,
    FALSE_STABILITY_CONFIG,
} from './config';

// ============================================================================
// Evidence — δE calculation and decay
// ============================================================================

export {
    // Core evidence functions
    calculateDeltaEvidence,
    applyDecay,
    applyTieredDecay,
    accumulateEvidence,

    // Decay rate helpers
    getDecayRate,
    getDecayStateFromEvidence,

    // State name helper
    getStateName,

    // Types
    type DecayState,
} from './evidence';

// ============================================================================
// States — State vectors and transitions
// ============================================================================

export {
    // State determination (primary export)
    getStateFromEvidence,
    getDominantState,

    // Mass movement
    moveMassForward,
    moveMassBackward,
    handleStateTransitions,

    // Drift
    calculateDrift,

    // Mass vector
    calculateMassVector,
    calculateAllocation,

    // Types
    type StateVector,
    type StateIndex,
} from './states';

// ============================================================================
// Baselines — WMA calculations
// ============================================================================

export {
    calculateWMAWeight,
    generateWMAWeights,
    computeWMA,
    computeStateVectorWMA,
} from './baselines';

// ============================================================================
// Stale — Activity-aware decay
// ============================================================================

export {
    calculateStaleMultiplier,
} from './decay-modifiers';
