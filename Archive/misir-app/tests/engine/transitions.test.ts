/**
 * Unit tests for State Transition Logic
 * 
 * Tests threshold-based state transitions with mass conservation.
 * Uses thresholds: θ₁=1, θ₂=3, θ₃=6
 */

import { describe, it, expect } from 'vitest';
import {
  getStateFromEvidence,
  moveMassForward,
  moveMassBackward,
  handleStateTransitions,
} from '@/lib/engine/state-transitions';
import { STATE_THRESHOLDS, TOTAL_MASS } from '@/lib/math';
import type { StateVector } from '@/lib/types';

describe('State Transitions', () => {
  describe('getStateFromEvidence', () => {
    it('should return correct state for evidence levels', () => {
      expect(getStateFromEvidence(0)).toBe(0);    // Latent
      expect(getStateFromEvidence(0.5)).toBe(0);  // Still latent
      expect(getStateFromEvidence(1)).toBe(1);    // θ₁ reached → Discovered
      expect(getStateFromEvidence(2)).toBe(1);    // Discovered
      expect(getStateFromEvidence(3)).toBe(2);    // θ₂ reached → Engaged
      expect(getStateFromEvidence(5)).toBe(2);    // Engaged
      expect(getStateFromEvidence(6)).toBe(3);    // θ₃ reached → Saturated
      expect(getStateFromEvidence(10)).toBe(3);   // Saturated
    });

    it('should handle exact threshold values', () => {
      expect(getStateFromEvidence(STATE_THRESHOLDS.THETA_1)).toBe(1);
      expect(getStateFromEvidence(STATE_THRESHOLDS.THETA_2)).toBe(2);
      expect(getStateFromEvidence(STATE_THRESHOLDS.THETA_3)).toBe(3);
    });
  });

  describe('moveMassForward', () => {
    it('should move all mass from source to target', () => {
      const state: StateVector = [7, 3, 0, 0];
      const result = moveMassForward(state, 0, 1);

      expect(result).toEqual([0, 10, 0, 0]);
    });

    it('should preserve total mass', () => {
      const state: StateVector = [5, 3, 2, 0];
      const result = moveMassForward(state, 1, 2);

      const totalBefore = state.reduce((a, b) => a + b, 0);
      const totalAfter = result.reduce((a, b) => a + b, 0);

      expect(totalAfter).toBe(totalBefore);
      expect(totalAfter).toBe(TOTAL_MASS);
    });

    it('should handle moving from state with zero mass', () => {
      const state: StateVector = [5, 0, 3, 2];
      const result = moveMassForward(state, 1, 2);

      expect(result).toEqual([5, 0, 3, 2]); // No change
    });
  });

  describe('moveMassBackward', () => {
    it('should move all mass from target back to source', () => {
      const state: StateVector = [0, 10, 0, 0];
      const result = moveMassBackward(state, 0, 1);

      expect(result).toEqual([10, 0, 0, 0]);
    });

    it('should preserve total mass', () => {
      const state: StateVector = [2, 3, 5, 0];
      const result = moveMassBackward(state, 1, 2);

      const totalBefore = state.reduce((a, b) => a + b, 0);
      const totalAfter = result.reduce((a, b) => a + b, 0);

      expect(totalAfter).toBe(totalBefore);
      expect(totalAfter).toBe(TOTAL_MASS);
    });
  });

  describe('handleStateTransitions', () => {
    it('should transition forward when evidence increases', () => {
      const oldState: StateVector = [10, 0, 0, 0];
      const oldEvidence = 0;
      const newEvidence = 1; // Crosses θ₁

      const result = handleStateTransitions(oldState, oldEvidence, newEvidence);

      expect(result).toEqual([0, 10, 0, 0]);
    });

    it('should transition backward when evidence decreases', () => {
      const oldState: StateVector = [0, 10, 0, 0];
      const oldEvidence = 2;
      const newEvidence = 0.5; // Below θ₁

      const result = handleStateTransitions(oldState, oldEvidence, newEvidence);

      expect(result).toEqual([10, 0, 0, 0]);
    });

    it('should handle multiple state transitions', () => {
      const oldState: StateVector = [10, 0, 0, 0];
      const oldEvidence = 0;
      const newEvidence = 4; // Crosses both θ₁ and θ₂

      const result = handleStateTransitions(oldState, oldEvidence, newEvidence);

      expect(result).toEqual([0, 0, 10, 0]);
    });

    it('should not transition if evidence stays in same state', () => {
      const oldState: StateVector = [0, 10, 0, 0];
      const oldEvidence = 1.5;
      const newEvidence = 2.5; // Both in Discovered state

      const result = handleStateTransitions(oldState, oldEvidence, newEvidence);

      expect(result).toEqual([0, 10, 0, 0]); // No change
    });

    it('should handle transition to saturated state', () => {
      const oldState: StateVector = [0, 0, 10, 0];
      const oldEvidence = 4;
      const newEvidence = 7; // Crosses θ₃

      const result = handleStateTransitions(oldState, oldEvidence, newEvidence);

      expect(result).toEqual([0, 0, 0, 10]);
    });

    it('should preserve mass conservation in all transitions', () => {
      const testCases = [
        { oldState: [10, 0, 0, 0] as StateVector, oldEvidence: 0, newEvidence: 1 },
        { oldState: [0, 10, 0, 0] as StateVector, oldEvidence: 2, newEvidence: 3 },
        { oldState: [0, 0, 10, 0] as StateVector, oldEvidence: 4, newEvidence: 6 },
        { oldState: [0, 0, 0, 10] as StateVector, oldEvidence: 7, newEvidence: 2 },
      ];

      testCases.forEach(({ oldState, oldEvidence, newEvidence }) => {
        const result = handleStateTransitions(oldState, oldEvidence, newEvidence);
        const totalMass = result.reduce((a, b) => a + b, 0);
        expect(totalMass).toBe(TOTAL_MASS);
      });
    });
  });
});
