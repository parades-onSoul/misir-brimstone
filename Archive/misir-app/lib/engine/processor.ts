/**
 * Artifact Processing & Space State Updates
 * 
 * Processes artifacts to update space evidence and trigger state transitions.
 */

import { StateVector, TOTAL_MASS } from '@/lib/math';
import { calculateDeltaEvidence, getCurrentEvidence } from './evidence';
import { handleStateTransitions } from './state-transitions';

export interface Artifact {
  id: string;
  space_id: string;
  user_id: string;
  base_weight: number;
  relevance: number;
  readingDepth?: number;  // Reading depth multiplier (defaults to 1.0)
  created_at: Date;
}

export interface Space {
  id: string;
  user_id: string;
  state_vector: StateVector | number[];
  evidence: number;
  last_updated_at: Date;
}

export interface UpdateResult {
  newEvidence: number;
  newStateVector: StateVector;
  transitionOccurred: boolean;
  oldState: number;
  newState: number;
}

/**
 * Process a new artifact and update its parent space
 * 
 * This is the core pipeline:
 * 1. Calculate δE from artifact
 * 2. Apply decay to existing evidence
 * 3. Add δE to get new evidence
 * 4. Check for threshold crossings
 * 5. Update state vector if needed
 * 
 * @param artifact - The newly created artifact
 * @param space - The parent space to update
 * @param now - Current timestamp (for testing)
 * @returns Updated evidence and state vector
 */
export function processArtifact(
  artifact: Artifact,
  space: Space,
  now: Date = new Date()
): UpdateResult {
  // Step 1: Calculate evidence contribution from artifact
  const deltaE = calculateDeltaEvidence(
    artifact.base_weight,
    artifact.relevance,
    artifact.readingDepth ?? 1.0
  );

  // Step 2: Get time since last update
  const lastUpdated = new Date(space.last_updated_at);

  // Step 3: Apply decay and accumulate new evidence
  const oldEvidence = space.evidence;
  const currentEvidence = getCurrentEvidence(oldEvidence, lastUpdated, now);
  const newEvidence = currentEvidence + deltaE;

  // Step 4: Check for state transitions
  const currentStateVector = Array.isArray(space.state_vector)
    ? space.state_vector as StateVector
    : [TOTAL_MASS, 0, 0, 0] as StateVector;

  const newStateVector = handleStateTransitions(
    currentStateVector,
    currentEvidence,
    newEvidence
  );

  // Step 5: Determine if transition occurred
  const vectorChanged = !currentStateVector.every((val, idx) => val === newStateVector[idx]);

  return {
    newEvidence,
    newStateVector,
    transitionOccurred: vectorChanged,
    oldState: getDominantStateIndex(currentStateVector),
    newState: getDominantStateIndex(newStateVector),
  };
}

/**
 * Apply decay to a space's evidence (for scheduled jobs)
 * 
 * @param space - Space to decay
 * @param now - Current timestamp
 * @returns Updated evidence and state vector (may trigger backward transitions)
 */
export function applySpaceDecay(
  space: Space,
  now: Date = new Date()
): UpdateResult {
  const lastUpdated = new Date(space.last_updated_at);
  const oldEvidence = space.evidence;

  // Get decayed evidence
  const newEvidence = getCurrentEvidence(oldEvidence, lastUpdated, now);

  // Check for backward transitions
  const currentStateVector = Array.isArray(space.state_vector)
    ? space.state_vector as StateVector
    : [TOTAL_MASS, 0, 0, 0] as StateVector;

  const newStateVector = handleStateTransitions(
    currentStateVector,
    oldEvidence,
    newEvidence
  );

  const vectorChanged = !currentStateVector.every((val, idx) => val === newStateVector[idx]);

  return {
    newEvidence,
    newStateVector,
    transitionOccurred: vectorChanged,
    oldState: getDominantStateIndex(currentStateVector),
    newState: getDominantStateIndex(newStateVector),
  };
}

/**
 * Batch process multiple spaces for decay (daily job)
 */
export function batchDecaySpaces(
  spaces: Space[],
  now: Date = new Date()
): Map<string, UpdateResult> {
  const results = new Map<string, UpdateResult>();

  for (const space of spaces) {
    const result = applySpaceDecay(space, now);
    results.set(space.id, result);
  }

  return results;
}

/**
 * Helper: Get dominant state index from state vector
 */
function getDominantStateIndex(stateVector: StateVector): number {
  let maxIndex = 0;
  let maxValue = stateVector[0];

  for (let i = 1; i < 4; i++) {
    if (stateVector[i] > maxValue) {
      maxValue = stateVector[i];
      maxIndex = i;
    }
  }

  return maxIndex;
}

/**
 * Validate that an artifact can create evidence
 */
export function validateArtifact(artifact: Artifact): void {
  if (artifact.base_weight < 0) {
    throw new Error('base_weight must be non-negative');
  }

  if (artifact.relevance < 0 || artifact.relevance > 1) {
    throw new Error('relevance must be in [0, 1]');
  }
}

/**
 * Initialize a new space with default state
 */
export function initializeSpace(): { stateVector: StateVector; evidence: number } {
  return {
    stateVector: [TOTAL_MASS, 0, 0, 0],
    evidence: 0,
  };
}
