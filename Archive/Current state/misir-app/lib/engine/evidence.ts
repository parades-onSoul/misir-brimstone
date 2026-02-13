/**
 * Evidence Accumulation & Decay — Engine Layer
 * 
 * This module re-exports pure math functions from @/lib/math
 * and adds orchestration logic that uses Date objects and other 
 * non-pure operations.
 */

// ============================================================================
// Re-export pure math functions from lib/math
// ============================================================================

export {
  // Evidence calculation
  calculateDeltaEvidence,

  // Decay rate helpers
  getDecayRate,
  getDecayStateFromEvidence,

  // State from evidence
  getStateFromEvidence,

  // Types
  type DecayState
} from '@/lib/math';

// Import for internal use
import {
  applyTieredDecay,
  getDecayRate,
  getDecayStateFromEvidence,
  calculateStaleMultiplier,
  type DecayState
} from '@/lib/math';

import { assertValidEvidence } from './invariants';

// ============================================================================
// Date-based Orchestration Functions
// ============================================================================

/**
 * Options for activity-aware decay
 */
export interface ActivityDecayOptions {
  /** Date of last artifact for this subspace/space */
  lastActivityDate?: Date;
  /** Current date (for testing) */
  now?: Date;
  /** Whether to pause decay entirely */
  isPaused?: boolean;
}

/**
 * Calculate time delta in days between two dates
 */
export function calculateDeltaDays(from: Date, to: Date): number {
  const deltaMs = to.getTime() - from.getTime();
  return deltaMs / (1000 * 60 * 60 * 24);
}

/**
 * Apply exponential decay to evidence with optional tiered rates
 * 
 * E(t + Δt) = E(t) * e^(-λ * Δt * staleMultiplier)
 * 
 * When state is provided, uses tiered decay rates:
 * - latent: 0.15/day (fast decay)
 * - discovered: 0.12/day
 * - engaged: 0.10/day  
 * - saturated: 0.05/day (slow decay - knowledge sticks)
 * 
 * Activity-aware decay:
 * If lastActivityDate is provided, decay only applies after inactivity threshold.
 * This prevents punishing users who are on vacation or temporarily paused.
 * 
 * @param evidence - Current evidence value
 * @param deltaTime - Time elapsed in days or milliseconds
 * @param state - Optional state for tiered decay (if omitted, uses evidence value to determine)
 * @param options - Optional activity-aware decay configuration
 * @returns Decayed evidence value
 */
export function applyDecay(
  evidence: number,
  deltaTime: number,
  state?: DecayState,
  options?: ActivityDecayOptions
): number {
  assertValidEvidence(evidence);

  if (deltaTime < 0) {
    return evidence; // Don't decay for negative time
  }

  // Convert milliseconds to days if the value is large
  // Threshold: if deltaTime > 100, assume it's milliseconds (days rarely exceed 100)
  const MS_DETECTION_THRESHOLD = 100;
  const deltaTimeInDays = deltaTime > MS_DETECTION_THRESHOLD
    ? deltaTime / (1000 * 60 * 60 * 24)
    : deltaTime;

  // Use tiered decay rate based on state
  const effectiveState = state ?? getDecayStateFromEvidence(evidence);
  const decayRate = getDecayRate(effectiveState);

  // Calculate stale multiplier based on activity
  let staleMultiplier = 1.0;
  if (options?.isPaused) {
    staleMultiplier = 0;
  } else if (options?.lastActivityDate) {
    const now = options.now ?? new Date();
    const daysSinceActivity = calculateDeltaDays(options.lastActivityDate, now);
    staleMultiplier = calculateStaleMultiplier(effectiveState, daysSinceActivity, false);
  }

  const effectiveDecayRate = decayRate * staleMultiplier;
  const decayed = evidence * Math.exp(-effectiveDecayRate * deltaTimeInDays);

  return decayed;
}

/**
 * Add evidence to current value with decay applied
 * 
 * @param currentEvidence - Current evidence value
 * @param deltaEvidence - Evidence to add
 * @param deltaTime - Time elapsed (Date, milliseconds, or days)
 * @param now - Optional current timestamp (for Date-based calls)
 */
export function accumulateEvidence(
  currentEvidence: number,
  deltaEvidence: number,
  deltaTime: number | Date,
  now?: Date
): number {
  // Handle different time formats
  let timeInDays: number;
  if (deltaTime instanceof Date) {
    timeInDays = calculateDeltaDays(deltaTime, now || new Date());
  } else {
    // Assume milliseconds if > 100, otherwise days
    timeInDays = deltaTime > 100 ? deltaTime / (1000 * 60 * 60 * 24) : deltaTime;
  }

  // First apply decay to existing evidence
  const decayedEvidence = applyTieredDecay(currentEvidence, timeInDays);

  // Then add new evidence
  const newEvidence = decayedEvidence + deltaEvidence;

  assertValidEvidence(newEvidence);

  return newEvidence;
}

/**
 * Get current evidence value with decay applied
 */
export function getCurrentEvidence(
  evidence: number,
  lastUpdated: Date,
  now: Date = new Date()
): number {
  const deltaTime = calculateDeltaDays(lastUpdated, now);
  return applyTieredDecay(evidence, deltaTime);
}
