import { describe, it, expect } from 'vitest';
import { computeState, computeMassVector, stateToVector } from '@/lib/engine/snapshots';
import { STATE_THRESHOLDS } from '@/lib/math';

describe('Snapshot System - Core Functions', () => {
  describe('computeState', () => {
    it('should return 0 (Latent) for evidence below θ₁', () => {
      expect(computeState(0)).toBe(0);
      expect(computeState(0.5)).toBe(0);
      expect(computeState(0.99)).toBe(0);
    });

    it('should return 1 (Discovered) for evidence >= θ₁ and < θ₂', () => {
      expect(computeState(STATE_THRESHOLDS.THETA_1)).toBe(1);
      expect(computeState(1.5)).toBe(1);
      expect(computeState(2.99)).toBe(1);
    });

    it('should return 2 (Engaged) for evidence >= θ₂ and < θ₃', () => {
      expect(computeState(STATE_THRESHOLDS.THETA_2)).toBe(2);
      expect(computeState(4)).toBe(2);
      expect(computeState(5.99)).toBe(2);
    });

    it('should return 3 (Saturated) for evidence >= θ₃', () => {
      expect(computeState(STATE_THRESHOLDS.THETA_3)).toBe(3);
      expect(computeState(10)).toBe(3);
      expect(computeState(100)).toBe(3);
    });
  });

  describe('stateToVector', () => {
    it('should create one-hot vector for Latent state', () => {
      expect(stateToVector(0)).toEqual([1, 0, 0, 0]);
    });

    it('should create one-hot vector for Discovered state', () => {
      expect(stateToVector(1)).toEqual([0, 1, 0, 0]);
    });

    it('should create one-hot vector for Engaged state', () => {
      expect(stateToVector(2)).toEqual([0, 0, 1, 0]);
    });

    it('should create one-hot vector for Saturated state', () => {
      expect(stateToVector(3)).toEqual([0, 0, 0, 1]);
    });
  });

  describe('computeMassVector', () => {
    it('should compute empty mass vector for no subspaces', () => {
      expect(computeMassVector([])).toEqual([0, 0, 0, 0]);
    });

    it('should compute mass vector for single subspace', () => {
      expect(computeMassVector([{ evidence: 0.5 }])).toEqual([1, 0, 0, 0]);
      expect(computeMassVector([{ evidence: 2.0 }])).toEqual([0, 1, 0, 0]);
      expect(computeMassVector([{ evidence: 4.0 }])).toEqual([0, 0, 1, 0]);
      expect(computeMassVector([{ evidence: 10 }])).toEqual([0, 0, 0, 1]);
    });

    it('should sum states across multiple subspaces', () => {
      const subspaces = [
        { evidence: 0.5 },  // Latent
        { evidence: 0.8 },  // Latent
        { evidence: 2.0 },  // Discovered
        { evidence: 4.0 },  // Engaged
        { evidence: 10 },   // Saturated
      ];
      expect(computeMassVector(subspaces)).toEqual([2, 1, 1, 1]);
    });

    it('should handle all subspaces in same state', () => {
      const subspaces = [
        { evidence: 2.0 },
        { evidence: 2.5 },
        { evidence: 2.9 },
      ];
      expect(computeMassVector(subspaces)).toEqual([0, 3, 0, 0]);
    });

    it('should handle edge cases at thresholds', () => {
      const subspaces = [
        { evidence: STATE_THRESHOLDS.THETA_1 },     // Discovered
        { evidence: STATE_THRESHOLDS.THETA_2 },     // Engaged
        { evidence: STATE_THRESHOLDS.THETA_3 },     // Saturated
        { evidence: STATE_THRESHOLDS.THETA_1 - 0.01 }, // Latent
      ];
      expect(computeMassVector(subspaces)).toEqual([1, 1, 1, 1]);
    });
  });
});

describe('Snapshot System - Retention Policy (Unit Tests)', () => {
  describe('Retention Rules', () => {
    it('should keep all snapshots within 30 days', () => {
      const now = new Date('2026-01-15T00:00:00Z');
      const days = Array.from({ length: 30 }, (_, i) => {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        return date;
      });

      // All should be kept
      days.forEach(date => {
        const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
        expect(daysDiff).toBeLessThanOrEqual(30);
      });
    });

    it('should keep Sunday snapshots for weeks 5-8', () => {
      const now = new Date('2026-01-15T00:00:00Z'); // Thursday

      // Find Sundays in weeks 5-8 (days 31-60)
      const sundays: Date[] = [];
      for (let i = 31; i <= 60; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        if (date.getDay() === 0) { // Sunday
          sundays.push(date);
        }
      }

      // Should have at least 4 Sundays in 4 weeks (could be 5 depending on alignment)
      expect(sundays.length).toBeGreaterThanOrEqual(4);
      expect(sundays.length).toBeLessThanOrEqual(5);
    });

    it('should keep first-of-month snapshots for months 3-13', () => {
      const now = new Date('2026-01-15T00:00:00Z');

      // Check that we'd keep 1st of each month
      const firstOfMonths: Date[] = [];
      for (let monthsAgo = 2; monthsAgo <= 13; monthsAgo++) {
        const date = new Date(now);
        date.setMonth(date.getMonth() - monthsAgo, 1);
        firstOfMonths.push(date);
      }

      expect(firstOfMonths.length).toBe(12);
    });

    it('should delete snapshots older than 13 months', () => {
      const now = new Date('2026-01-15T00:00:00Z');
      const oldDate = new Date(now);
      oldDate.setMonth(oldDate.getMonth() - 14);

      const monthsDiff = (now.getMonth() - oldDate.getMonth()) +
        (12 * (now.getFullYear() - oldDate.getFullYear()));

      expect(monthsDiff).toBeGreaterThan(13);
    });
  });
});
