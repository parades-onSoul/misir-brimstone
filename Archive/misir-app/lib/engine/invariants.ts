/**
 * Invariant Checking
 * 
 * Validates core system invariants that must always hold true.
 */

import { StateVector, TOTAL_MASS } from '@/lib/math';

/**
 * Check if state vector maintains mass conservation
 */
export function validateMassConservation(stateVector: StateVector): boolean {
  const sum = stateVector.reduce((acc, val) => acc + val, 0);
  return sum === TOTAL_MASS;
}

/**
 * Check if all state values are non-negative
 */
export function validateNonNegative(stateVector: StateVector): boolean {
  return stateVector.every(val => val >= 0);
}

/**
 * Alias for validateNonNegative (test compatibility)
 */
export function validateNonNegativity(stateVector: StateVector): boolean {
  return validateNonNegative(stateVector);
}

/**
 * Validate complete state vector (mass conservation + non-negativity)
 */
export function validateStateVector(stateVector: StateVector): boolean {
  return validateNonNegative(stateVector) && validateMassConservation(stateVector);
}

/**
 * Check if state values are integers
 */
export function validateInteger(stateVector: StateVector): boolean {
  return stateVector.every(val => Number.isInteger(val));
}

/**
 * Comprehensive state vector validation
 * Throws error if invalid
 */
export function assertValidStateVector(
  stateVector: StateVector,
  context: string = 'State vector'
): void {
  if (!validateNonNegative(stateVector)) {
    throw new Error(`${context}: Contains negative values - ${stateVector}`);
  }

  if (!validateInteger(stateVector)) {
    throw new Error(`${context}: Contains non-integer values - ${stateVector}`);
  }

  if (!validateMassConservation(stateVector)) {
    const sum = stateVector.reduce((acc, val) => acc + val, 0);
    throw new Error(
      `${context}: Mass conservation violated. Sum=${sum}, Expected=${TOTAL_MASS}`
    );
  }
}

/**
 * Validate evidence is non-negative
 */
export function assertValidEvidence(evidence: number, context: string = 'Evidence'): void {
  if (evidence < 0) {
    throw new Error(`${context}: Must be non-negative, got ${evidence}`);
  }
}
