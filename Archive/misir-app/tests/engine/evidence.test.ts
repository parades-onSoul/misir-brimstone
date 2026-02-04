/**
 * Unit tests for Evidence Accumulation Engine
 * 
 * Tests the evidence accumulation and decay functions that are core
 * to the Misir state evolution system.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDeltaEvidence,
  applyDecay,
  accumulateEvidence,
  getDecayRate,
  getDecayStateFromEvidence,
} from '@/lib/engine/evidence';
import { DEFAULT_DECAY_RATE } from '@/lib/math';

describe('Evidence Engine', () => {
  describe('calculateDeltaEvidence', () => {
    it('should calculate correct delta evidence for new artifact weights', () => {
      // Ambient artifact (weight = 0.2)
      expect(calculateDeltaEvidence(0.2, 1.0)).toBeCloseTo(0.2, 2);
      expect(calculateDeltaEvidence(0.2, 0.5)).toBeCloseTo(0.1, 2);

      // Engaged artifact (weight = 1.0)
      expect(calculateDeltaEvidence(1.0, 1.0)).toBe(1.0);
      expect(calculateDeltaEvidence(1.0, 0.5)).toBe(0.5);

      // Committed artifact (weight = 2.0)
      expect(calculateDeltaEvidence(2.0, 1.0)).toBe(2.0);
      expect(calculateDeltaEvidence(2.0, 0.5)).toBe(1.0);
    });

    it('should handle zero relevance', () => {
      expect(calculateDeltaEvidence(2.0, 0)).toBe(0);
    });

    it('should handle partial relevance', () => {
      expect(calculateDeltaEvidence(2.0, 0.25)).toBeCloseTo(0.5, 2);
      expect(calculateDeltaEvidence(2.0, 0.75)).toBeCloseTo(1.5, 2);
    });

    // P3.1: Reading depth multiplier tests
    it('should apply reading depth multiplier', () => {
      // Baseline (D=1.0): normal reading
      expect(calculateDeltaEvidence(1.0, 1.0, 1.0)).toBe(1.0);

      // Skim (D=0.5): quick scan reduces evidence
      expect(calculateDeltaEvidence(1.0, 1.0, 0.5)).toBe(0.5);

      // Deep read (D=1.5): extended engagement boosts evidence
      expect(calculateDeltaEvidence(1.0, 1.0, 1.5)).toBe(1.5);

      // Bounce (D=0): no evidence contribution
      expect(calculateDeltaEvidence(1.0, 1.0, 0)).toBe(0);
    });

    it('should default reading depth to 1.0 when not provided', () => {
      expect(calculateDeltaEvidence(1.0, 1.0)).toBe(1.0);
    });

    it('should clamp reading depth to valid range', () => {
      // Values outside [0, 1.5] should be clamped
      expect(calculateDeltaEvidence(1.0, 1.0, 2.0)).toBe(1.5); // Clamped to 1.5
      expect(calculateDeltaEvidence(1.0, 1.0, -0.5)).toBe(0); // Clamped to 0
    });

    it('should combine weight, relevance, and depth correctly', () => {
      // δE = w × r × D
      // Committed (2.0) × 0.8 relevance × 1.5 depth = 2.4
      expect(calculateDeltaEvidence(2.0, 0.8, 1.5)).toBeCloseTo(2.4, 2);

      // Ambient (0.2) × 0.5 relevance × 0.5 depth = 0.05
      expect(calculateDeltaEvidence(0.2, 0.5, 0.5)).toBeCloseTo(0.05, 3);
    });
  });

  describe('getDecayStateFromEvidence', () => {
    it('should return correct state for evidence thresholds', () => {
      expect(getDecayStateFromEvidence(0)).toBe('latent');
      expect(getDecayStateFromEvidence(0.5)).toBe('latent');
      expect(getDecayStateFromEvidence(1)).toBe('discovered');
      expect(getDecayStateFromEvidence(2.5)).toBe('discovered');
      expect(getDecayStateFromEvidence(3)).toBe('engaged');
      expect(getDecayStateFromEvidence(5.9)).toBe('engaged');
      expect(getDecayStateFromEvidence(6)).toBe('saturated');
      expect(getDecayStateFromEvidence(10)).toBe('saturated');
    });
  });

  describe('getDecayRate', () => {
    it('should return correct tiered decay rates', () => {
      expect(getDecayRate('latent')).toBe(0.15);
      expect(getDecayRate('discovered')).toBe(0.12);
      expect(getDecayRate('engaged')).toBe(0.10);
      expect(getDecayRate('saturated')).toBe(0.05);
    });

    it('should return default rate when no state provided', () => {
      expect(getDecayRate()).toBe(DEFAULT_DECAY_RATE);
    });
  });

  describe('applyDecay', () => {
    it('should apply tiered decay - saturated (slow)', () => {
      const initialEvidence = 10; // saturated state (≥6)
      const oneDayMs = 24 * 60 * 60 * 1000;

      const decayed = applyDecay(initialEvidence, oneDayMs);

      // After 1 day with λ=0.05 (saturated), E(t) = 10 * e^(-0.05) ≈ 9.512
      expect(decayed).toBeCloseTo(9.512, 2);
    });

    it('should apply tiered decay - latent (fast)', () => {
      const initialEvidence = 0.5; // latent state (<1)
      const oneDayMs = 24 * 60 * 60 * 1000;

      const decayed = applyDecay(initialEvidence, oneDayMs);

      // After 1 day with λ=0.15 (latent), E(t) = 0.5 * e^(-0.15) ≈ 0.430
      expect(decayed).toBeCloseTo(0.430, 2);
    });

    it('should allow explicit state override', () => {
      const initialEvidence = 10; // would be saturated by evidence
      const oneDayMs = 24 * 60 * 60 * 1000;

      // Force latent decay rate
      const decayed = applyDecay(initialEvidence, oneDayMs, 'latent');

      // After 1 day with λ=0.15 (latent), E(t) = 10 * e^(-0.15) ≈ 8.607
      expect(decayed).toBeCloseTo(8.607, 2);
    });

    it('should not decay if delta time is zero', () => {
      expect(applyDecay(10, 0)).toBe(10);
    });

    it('should decay significantly over long time', () => {
      const tenDaysMs = 10 * 24 * 60 * 60 * 1000;
      const decayed = applyDecay(100, tenDaysMs); // saturated: λ=0.05

      // After 10 days with λ=0.05, E(t) = 100 * e^(-0.5) ≈ 60.65
      expect(decayed).toBeCloseTo(60.65, 0);
    });

    it('should handle negative time delta gracefully', () => {
      expect(applyDecay(10, -1000)).toBe(10);
    });
  });

  describe('accumulateEvidence', () => {
    it('should add evidence and apply tiered decay', () => {
      const currentEvidence = 10; // saturated
      const deltaEvidence = 2;
      const oneDayMs = 24 * 60 * 60 * 1000;

      const newEvidence = accumulateEvidence(
        currentEvidence,
        deltaEvidence,
        oneDayMs
      );

      // Should decay current evidence (saturated λ=0.05) then add new
      // 10 * e^(-0.05) + 2 ≈ 11.512
      expect(newEvidence).toBeCloseTo(11.512, 2);
    });

    it('should just add evidence when no time has passed', () => {
      const result = accumulateEvidence(10, 5, 0);
      expect(result).toBe(15);
    });

    it('should handle zero delta evidence', () => {
      const oneDayMs = 24 * 60 * 60 * 1000;
      const result = accumulateEvidence(10, 0, oneDayMs);

      // Should just decay, no new evidence (saturated λ=0.05)
      expect(result).toBeCloseTo(9.512, 2);
    });
  });
});
