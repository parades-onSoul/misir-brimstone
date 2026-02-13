/**
 * State Vector Operations — Pure formulas
 * 
 * Implements state transitions with mass redistribution.
 * All functions are pure - no DB calls, no side effects.
 */

import { STATE_THRESHOLDS } from './config';

// ============================================================================
// Types
// ============================================================================

/**
 * State vector representing mass distribution across states
 * [s0, s1, s2, s3] = [latent, discovered, engaged, saturated]
 */
export type StateVector = [number, number, number, number];

/**
 * State index (0-3)
 */
export type StateIndex = 0 | 1 | 2 | 3;

// ============================================================================
// State Determination
// ============================================================================

/**
 * Determine which state an evidence value corresponds to
 * 
 * k = max { i : E ≥ θ_i }
 */
export function getStateFromEvidence(evidence: number): StateIndex {
    if (evidence >= STATE_THRESHOLDS.THETA_3) return 3;
    if (evidence >= STATE_THRESHOLDS.THETA_2) return 2;
    if (evidence >= STATE_THRESHOLDS.THETA_1) return 1;
    return 0;
}

/**
 * Get dominant state from state vector
 * (State with highest mass)
 */
export function getDominantState(stateVector: StateVector): StateIndex {
    let maxIndex = 0;
    let maxValue = stateVector[0];

    for (let i = 1; i < 4; i++) {
        if (stateVector[i] > maxValue) {
            maxValue = stateVector[i];
            maxIndex = i;
        }
    }

    return maxIndex as StateIndex;
}

// ============================================================================
// Mass Movement
// ============================================================================

/**
 * Move mass forward (evidence increased)
 * 
 * Consolidate ALL mass between fromState and toState into the higher state
 */
export function moveMassForward(
    stateVector: StateVector,
    fromState: StateIndex,
    toState: StateIndex
): StateVector {
    const newVector = [...stateVector] as StateVector;

    // Determine range
    const minState = Math.min(fromState, toState);
    const maxState = Math.max(fromState, toState);

    // Collect all mass in the range
    let totalMass = 0;
    for (let i = minState; i <= maxState; i++) {
        totalMass += newVector[i];
        newVector[i] = 0;
    }

    // Place all mass in the higher state (forward movement)
    newVector[maxState] = totalMass;

    return newVector;
}

/**
 * Move mass backward (evidence decreased)
 * 
 * Consolidate ALL mass between fromState and toState into the lower state
 */
export function moveMassBackward(
    stateVector: StateVector,
    fromState: StateIndex,
    toState: StateIndex
): StateVector {
    const newVector = [...stateVector] as StateVector;

    // Determine range
    const minState = Math.min(fromState, toState);
    const maxState = Math.max(fromState, toState);

    // Collect all mass in the range
    let totalMass = 0;
    for (let i = minState; i <= maxState; i++) {
        totalMass += newVector[i];
        newVector[i] = 0;
    }

    // Place all mass in the lower state (backward movement)
    newVector[minState] = totalMass;

    return newVector;
}

/**
 * Handle state transitions based on evidence change
 * 
 * @param currentStateVector - Current state distribution
 * @param oldEvidence - Previous evidence value
 * @param newEvidence - New evidence value after update
 * @returns Updated state vector
 */
export function handleStateTransitions(
    currentStateVector: StateVector,
    oldEvidence: number,
    newEvidence: number
): StateVector {
    const oldState = getStateFromEvidence(oldEvidence);
    const newState = getStateFromEvidence(newEvidence);

    // No transition needed
    if (oldState === newState) {
        return currentStateVector;
    }

    // Forward transition (evidence increased)
    if (newState > oldState) {
        return moveMassForward(currentStateVector, oldState, newState);
    }

    // Backward transition (evidence decreased/decayed)
    return moveMassBackward(currentStateVector, oldState, newState);
}

// ============================================================================
// Drift Calculation
// ============================================================================

/**
 * Calculate drift score between two state vectors
 * 
 * D = |s_current - s_previous|_1 (L1 norm)
 */
export function calculateDrift(
    currentState: StateVector,
    previousState: StateVector
): number {
    let drift = 0;
    for (let i = 0; i < 4; i++) {
        drift += Math.abs(currentState[i] - previousState[i]);
    }
    return drift;
}

// ============================================================================
// Mass Vector Calculation
// ============================================================================

/**
 * Calculate mass vector from array of evidence values
 * 
 * Counts how many items fall into each state bucket.
 */
export function calculateMassVector(evidenceValues: number[]): StateVector {
    const mass: StateVector = [0, 0, 0, 0];

    for (const evidence of evidenceValues) {
        const state = getStateFromEvidence(evidence);
        mass[state]++;
    }

    return mass;
}

/**
 * Calculate allocation percentages from mass vector
 */
export function calculateAllocation(massVector: StateVector): StateVector {
    const total = massVector.reduce((sum, val) => sum + val, 0);

    if (total === 0) {
        return [0, 0, 0, 0];
    }

    return massVector.map(val => (val / total) * 100) as StateVector;
}
