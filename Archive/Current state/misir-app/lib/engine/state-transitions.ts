/**
 * State Transitions — Engine Layer
 * 
 * Re-exports pure state functions from @/lib/math
 * and adds validation/invariant checking.
 */

// ============================================================================
// Re-export pure math functions from lib/math
// ============================================================================

export {
  getStateFromEvidence,
  getDominantState,
  moveMassForward,
  moveMassBackward,
  calculateDrift,
  calculateMassVector,
  calculateAllocation,
  type StateVector,
  type StateIndex
} from '@/lib/math';

// Import for internal use
import {
  getStateFromEvidence,
  moveMassForward,
  moveMassBackward,
  type StateVector,
  type StateIndex
} from '@/lib/math';

import { assertValidStateVector } from './invariants';

// ============================================================================
// Validated State Transitions
// ============================================================================

/**
 * Handle state transitions based on evidence change
 * 
 * This version includes invariant validation.
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
  assertValidStateVector(currentStateVector, 'Current state vector');

  const oldState = getStateFromEvidence(oldEvidence);
  const newState = getStateFromEvidence(newEvidence);

  // No transition needed
  if (oldState === newState) {
    return currentStateVector;
  }

  let result: StateVector;

  // Forward transition (evidence increased)
  if (newState > oldState) {
    result = moveMassForward(currentStateVector, oldState, newState);
  } else {
    // Backward transition (evidence decreased/decayed)
    result = moveMassBackward(currentStateVector, oldState, newState);
  }

  assertValidStateVector(result, 'After transition');
  return result;
}
