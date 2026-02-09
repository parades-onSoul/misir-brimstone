/**
 * Unit tests for Invariant Validation
 * 
 * Tests the system invariants that must hold true at all times.
 */

import { describe, it, expect } from 'vitest';
import {
  validateMassConservation,
  validateNonNegativity,
  validateStateVector,
} from '@/lib/engine/invariants';
import { StateVector } from '@/lib/types';

describe('Invariant Validation', () => {
  describe('validateMassConservation', () => {
    it('should pass for valid state vector', () => {
      const state: StateVector = [7, 2, 1, 0];
      expect(validateMassConservation(state)).toBe(true);
    });

    it('should pass for different valid distributions', () => {
      const validStates: StateVector[] = [
        [10, 0, 0, 0],
        [0, 10, 0, 0],
        [0, 0, 10, 0],
        [0, 0, 0, 10],
        [2.5, 2.5, 2.5, 2.5],
        [1, 3, 4, 2],
      ];
      
      validStates.forEach(state => {
        expect(validateMassConservation(state)).toBe(true);
      });
    });

    it('should fail when total mass is too high', () => {
      const state: StateVector = [6, 3, 2, 1]; // Total = 12
      expect(validateMassConservation(state)).toBe(false);
    });

    it('should fail when total mass is too low', () => {
      const state: StateVector = [4, 2, 1, 0]; // Total = 7
      expect(validateMassConservation(state)).toBe(false);
    });

    it('should handle floating point precision', () => {
      const state: StateVector = [3.333333, 3.333333, 3.333333, 0.000001];
      expect(validateMassConservation(state)).toBe(true);
    });
  });

  describe('validateNonNegativity', () => {
    it('should pass for all positive values', () => {
      const state: StateVector = [7, 2, 1, 0];
      expect(validateNonNegativity(state)).toBe(true);
    });

    it('should pass when some values are zero', () => {
      const state: StateVector = [10, 0, 0, 0];
      expect(validateNonNegativity(state)).toBe(true);
    });

    it('should fail when any value is negative', () => {
      const state: StateVector = [11, -1, 0, 0];
      expect(validateNonNegativity(state)).toBe(false);
    });

    it('should fail when multiple values are negative', () => {
      const state: StateVector = [-1, -1, 12, 0];
      expect(validateNonNegativity(state)).toBe(false);
    });
  });

  describe('validateStateVector', () => {
    it('should pass for completely valid state', () => {
      const state: StateVector = [7, 2, 1, 0];
      expect(validateStateVector(state)).toBe(true);
    });

    it('should fail if mass conservation violated', () => {
      const state: StateVector = [8, 3, 2, 1]; // Total = 14
      expect(validateStateVector(state)).toBe(false);
    });

    it('should fail if non-negativity violated', () => {
      const state: StateVector = [11, -1, 0, 0];
      expect(validateStateVector(state)).toBe(false);
    });

    it('should fail if both invariants violated', () => {
      const state: StateVector = [-5, 3, 2, 1];
      expect(validateStateVector(state)).toBe(false);
    });

    it('should validate edge cases', () => {
      const edgeCases: StateVector[] = [
        [10, 0, 0, 0],     // All mass in first state
        [0, 0, 0, 10],     // All mass in last state
        [2.5, 2.5, 2.5, 2.5], // Evenly distributed
      ];
      
      edgeCases.forEach(state => {
        expect(validateStateVector(state)).toBe(true);
      });
    });
  });
});
