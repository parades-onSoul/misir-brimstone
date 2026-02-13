/**
 * Evidence Math — Pure formulas, no side effects
 * 
 * Implements evidence accumulation and decay formulas.
 * All functions are pure - no DB calls, no Date objects (use numbers for time).
 */

import {
    STATE_THRESHOLDS,
    DECAY_RATES,
    DEFAULT_DECAY_RATE,
    MAX_READING_DEPTH
} from './config';

// Import state determination from states.ts (single source of truth)
import { getStateFromEvidence } from './states';

// ============================================================================
// Types
// ============================================================================

/**
 * State type for tiered decay rates
 */
export type DecayState = 'latent' | 'discovered' | 'engaged' | 'saturated';

// ============================================================================
// Evidence Calculation
// ============================================================================

/**
 * Calculate delta evidence from an artifact
 * 
 * δE = w × r × d
 * 
 * Where:
 * - w = artifact type weight (ambient: 0.2, engaged: 1.0, committed: 2.0)
 * - r = relevance score [0, 1]
 * - d = reading depth multiplier [0, 1.5]
 * 
 * @param weight - Artifact weight (ambient: 0.2, engaged: 1.0, committed: 2.0)
 * @param relevance - Relevance score [0, 1]
 * @param readingDepth - Reading depth multiplier [0, 1.5], defaults to 1.0
 * @returns Evidence delta value
 */
export function calculateDeltaEvidence(
    weight: number,
    relevance: number,
    readingDepth: number = 1.0
): number {
    if (weight < 0) throw new Error('Weight must be non-negative');
    if (relevance < 0 || relevance > 1) throw new Error('Relevance must be in [0,1]');

    // Clamp reading depth to valid range
    const clampedDepth = Math.max(0, Math.min(MAX_READING_DEPTH, readingDepth));

    return weight * relevance * clampedDepth;
}

// ============================================================================
// Decay Functions
// ============================================================================

/**
 * Get the decay rate for a given state
 * 
 * @param state - Optional state for tiered decay
 * @returns Decay rate (λ per day)
 */
export function getDecayRate(state?: DecayState): number {
    if (!state) return DEFAULT_DECAY_RATE;
    return DECAY_RATES[state];
}

/**
 * Determine decay state (string) from evidence value
 * 
 * @param evidence - Current evidence value
 * @returns DecayState string
 */
export function getDecayStateFromEvidence(evidence: number): DecayState {
    if (evidence >= STATE_THRESHOLDS.THETA_3) return 'saturated';
    if (evidence >= STATE_THRESHOLDS.THETA_2) return 'engaged';
    if (evidence >= STATE_THRESHOLDS.THETA_1) return 'discovered';
    return 'latent';
}

/**
 * Apply exponential decay to evidence
 * 
 * E(t + Δt) = E(t) × e^(-λ × Δt)
 * 
 * @param evidence - Current evidence value
 * @param deltaTimeDays - Time elapsed in days
 * @param decayRate - Decay rate λ (per day)
 * @returns Decayed evidence value
 */
export function applyDecay(
    evidence: number,
    deltaTimeDays: number,
    decayRate: number
): number {
    if (evidence < 0) throw new Error('Evidence must be non-negative');
    if (deltaTimeDays < 0) return evidence; // Don't decay for negative time

    return evidence * Math.exp(-decayRate * deltaTimeDays);
}

/**
 * Apply tiered decay based on evidence state
 * 
 * Automatically determines decay rate from evidence level.
 * 
 * @param evidence - Current evidence value
 * @param deltaTimeDays - Time elapsed in days
 * @param staleMultiplier - Optional activity-aware multiplier (default 1.0)
 * @returns Decayed evidence value
 */
export function applyTieredDecay(
    evidence: number,
    deltaTimeDays: number,
    staleMultiplier: number = 1.0
): number {
    const state = getDecayStateFromEvidence(evidence);
    const baseRate = getDecayRate(state);
    const effectiveRate = baseRate * staleMultiplier;

    return applyDecay(evidence, deltaTimeDays, effectiveRate);
}

/**
 * Accumulate evidence by adding delta to current (with decay applied first)
 * 
 * @param currentEvidence - Current evidence value
 * @param deltaEvidence - Evidence to add
 * @param deltaTimeDays - Time elapsed since last update (in days)
 * @returns New evidence value
 */
export function accumulateEvidence(
    currentEvidence: number,
    deltaEvidence: number,
    deltaTimeDays: number
): number {
    // First apply decay to existing evidence
    const decayedEvidence = applyTieredDecay(currentEvidence, deltaTimeDays);

    // Then add new evidence
    return decayedEvidence + deltaEvidence;
}

// ============================================================================
// Re-export state determination from states.ts (single source of truth)
// ============================================================================

export { getStateFromEvidence } from './states';

/**
 * Get state name from index
 */
export function getStateName(stateIndex: 0 | 1 | 2 | 3): DecayState {
    const names: DecayState[] = ['latent', 'discovered', 'engaged', 'saturated'];
    return names[stateIndex];
}
