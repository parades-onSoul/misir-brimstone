import { describe, it, expect } from 'vitest';
import {
  computeSimpleBaseline,
  computeWeightedBaseline,
} from '@/lib/engine/baseline-orchestrator';
import { PersistedSnapshot, SnapshotData, StateVector } from '@/lib/types';

// Helper to create test snapshot
function createTestSnapshot(
  timestamp: Date,
  spaceData: { spaceId: string; name: string; massVector: StateVector; totalEvidence: number; subspaceCount: number }[]
): PersistedSnapshot {
  const data: SnapshotData = {
    spaces: spaceData.map(s => ({
      spaceId: s.spaceId,
      name: s.name,
      massVector: s.massVector,
      totalEvidence: s.totalEvidence,
      subspaces: Array(s.subspaceCount).fill({
        subspaceId: 'sub-1',
        name: 'Test Subspace',
        evidence: s.totalEvidence / s.subspaceCount,
        state: 1,
      }),
    })),
  };

  return {
    id: `snap-${timestamp.getTime()}`,
    userId: 'test-user',
    snapshotType: 'daily',
    timestamp,
    data,
  };
}

describe('Baseline Computation - Simple Algorithm', () => {
  it('should compute simple baseline from single snapshot', () => {
    const snapshots = [
      createTestSnapshot(new Date('2026-01-01'), [
        {
          spaceId: 'space-1',
          name: 'AI Research',
          massVector: [1, 2, 3, 4],
          totalEvidence: 10,
          subspaceCount: 5,
        },
      ]),
    ];

    const baseline = computeSimpleBaseline(snapshots);

    expect(baseline.spaces).toHaveLength(1);
    expect(baseline.spaces[0].spaceId).toBe('space-1');
    expect(baseline.spaces[0].avgMassVector).toEqual([1, 2, 3, 4]);
    expect(baseline.spaces[0].avgEvidence).toBe(10);
    expect(baseline.spaces[0].avgSubspaceCount).toBe(5);
    expect(baseline.globalAvgMassVector).toEqual([1, 2, 3, 4]);
  });

  it('should average multiple snapshots equally', () => {
    const snapshots = [
      createTestSnapshot(new Date('2026-01-01'), [
        {
          spaceId: 'space-1',
          name: 'AI Research',
          massVector: [1, 0, 0, 0],
          totalEvidence: 10,
          subspaceCount: 5,
        },
      ]),
      createTestSnapshot(new Date('2026-01-02'), [
        {
          spaceId: 'space-1',
          name: 'AI Research',
          massVector: [0, 1, 0, 0],
          totalEvidence: 20,
          subspaceCount: 7,
        },
      ]),
    ];

    const baseline = computeSimpleBaseline(snapshots);

    expect(baseline.spaces[0].avgMassVector).toEqual([0.5, 0.5, 0, 0]);
    expect(baseline.spaces[0].avgEvidence).toBe(15); // (10 + 20) / 2
    expect(baseline.spaces[0].avgSubspaceCount).toBe(6); // (5 + 7) / 2
  });

  it('should handle multiple spaces', () => {
    const snapshots = [
      createTestSnapshot(new Date('2026-01-01'), [
        {
          spaceId: 'space-1',
          name: 'AI Research',
          massVector: [1, 0, 0, 0],
          totalEvidence: 10,
          subspaceCount: 5,
        },
        {
          spaceId: 'space-2',
          name: 'Web Dev',
          massVector: [0, 1, 0, 0],
          totalEvidence: 8,
          subspaceCount: 3,
        },
      ]),
    ];

    const baseline = computeSimpleBaseline(snapshots);

    expect(baseline.spaces).toHaveLength(2);
    expect(baseline.totalSpaces).toBe(2);
    expect(baseline.globalAvgMassVector).toEqual([1, 1, 0, 0]);
  });

  it('should throw error for empty snapshots', () => {
    expect(() => computeSimpleBaseline([])).toThrow('Cannot compute baseline from zero snapshots');
  });
});

describe('Baseline Computation - Weighted Algorithm', () => {
  it('should compute weighted baseline with exponential decay', () => {
    const snapshots = [
      createTestSnapshot(new Date('2026-01-01'), [
        {
          spaceId: 'space-1',
          name: 'AI Research',
          massVector: [1, 0, 0, 0],
          totalEvidence: 10,
          subspaceCount: 5,
        },
      ]),
      createTestSnapshot(new Date('2026-01-02'), [
        {
          spaceId: 'space-1',
          name: 'AI Research',
          massVector: [0, 0, 0, 1],
          totalEvidence: 20,
          subspaceCount: 10,
        },
      ]),
    ];

    const baseline = computeWeightedBaseline(snapshots, 0.1);

    // Most recent snapshot should have more weight
    // So massVector should be closer to [0, 0, 0, 1] than [1, 0, 0, 0]
    const mv = baseline.spaces[0].avgMassVector;
    expect(mv[3]).toBeGreaterThan(mv[0]); // State 3 should dominate

    // Evidence should be closer to 20 than 10
    expect(baseline.spaces[0].avgEvidence).toBeGreaterThan(15);
  });

  it('should handle alpha parameter correctly', () => {
    const snapshots = [
      createTestSnapshot(new Date('2026-01-01'), [
        {
          spaceId: 'space-1',
          name: 'AI Research',
          massVector: [1, 0, 0, 0],
          totalEvidence: 10,
          subspaceCount: 5,
        },
      ]),
      createTestSnapshot(new Date('2026-01-02'), [
        {
          spaceId: 'space-1',
          name: 'AI Research',
          massVector: [0, 0, 0, 1],
          totalEvidence: 20,
          subspaceCount: 10,
        },
      ]),
    ];

    // Higher alpha = more weight on recent
    const baseline1 = computeWeightedBaseline(snapshots, 0.01); // Low alpha
    const baseline2 = computeWeightedBaseline(snapshots, 0.5);  // High alpha

    // With higher alpha, recent snapshot dominates more
    expect(baseline2.spaces[0].avgEvidence).toBeGreaterThan(baseline1.spaces[0].avgEvidence);
  });

  it('should throw error for invalid alpha', () => {
    const snapshots = [
      createTestSnapshot(new Date('2026-01-01'), [
        {
          spaceId: 'space-1',
          name: 'AI Research',
          massVector: [1, 0, 0, 0],
          totalEvidence: 10,
          subspaceCount: 5,
        },
      ]),
    ];

    expect(() => computeWeightedBaseline(snapshots, 0)).toThrow('Alpha must be in range (0, 1]');
    expect(() => computeWeightedBaseline(snapshots, 1.5)).toThrow('Alpha must be in range (0, 1]');
  });

  it('should converge to simple baseline with alpha approaching 0', () => {
    const snapshots = [
      createTestSnapshot(new Date('2026-01-01'), [
        {
          spaceId: 'space-1',
          name: 'AI Research',
          massVector: [1, 0, 0, 0],
          totalEvidence: 10,
          subspaceCount: 5,
        },
      ]),
      createTestSnapshot(new Date('2026-01-02'), [
        {
          spaceId: 'space-1',
          name: 'AI Research',
          massVector: [0, 1, 0, 0],
          totalEvidence: 20,
          subspaceCount: 10,
        },
      ]),
    ];

    const simple = computeSimpleBaseline(snapshots);
    const weighted = computeWeightedBaseline(snapshots, 0.001); // Very small alpha

    // Should be very close to simple average
    expect(Math.abs(weighted.spaces[0].avgEvidence - simple.spaces[0].avgEvidence)).toBeLessThan(0.1);
  });

  it('should handle multiple spaces correctly', () => {
    const snapshots = [
      createTestSnapshot(new Date('2026-01-01'), [
        {
          spaceId: 'space-1',
          name: 'AI Research',
          massVector: [1, 0, 0, 0],
          totalEvidence: 10,
          subspaceCount: 5,
        },
        {
          spaceId: 'space-2',
          name: 'Web Dev',
          massVector: [0, 1, 0, 0],
          totalEvidence: 8,
          subspaceCount: 3,
        },
      ]),
    ];

    const baseline = computeWeightedBaseline(snapshots, 0.1);

    expect(baseline.spaces).toHaveLength(2);
    expect(baseline.totalSpaces).toBe(2);

    // Each space should have valid mass vector
    baseline.spaces.forEach(space => {
      expect(space.avgMassVector).toHaveLength(4);
      expect(space.avgEvidence).toBeGreaterThan(0);
    });
  });
});

describe('Baseline Computation - Edge Cases', () => {
  it('should handle snapshot with space appearing/disappearing', () => {
    const snapshots = [
      createTestSnapshot(new Date('2026-01-01'), [
        {
          spaceId: 'space-1',
          name: 'AI Research',
          massVector: [1, 0, 0, 0],
          totalEvidence: 10,
          subspaceCount: 5,
        },
      ]),
      createTestSnapshot(new Date('2026-01-02'), [
        {
          spaceId: 'space-2',
          name: 'Web Dev',
          massVector: [0, 1, 0, 0],
          totalEvidence: 8,
          subspaceCount: 3,
        },
      ]),
    ];

    const baseline = computeSimpleBaseline(snapshots);

    // Both spaces should appear in baseline
    expect(baseline.spaces).toHaveLength(2);
    expect(baseline.spaces.find(s => s.spaceId === 'space-1')).toBeDefined();
    expect(baseline.spaces.find(s => s.spaceId === 'space-2')).toBeDefined();
  });

  it('should handle zero evidence correctly', () => {
    const snapshots = [
      createTestSnapshot(new Date('2026-01-01'), [
        {
          spaceId: 'space-1',
          name: 'AI Research',
          massVector: [0, 0, 0, 0],
          totalEvidence: 0,
          subspaceCount: 0,
        },
      ]),
    ];

    const baseline = computeSimpleBaseline(snapshots);

    expect(baseline.spaces[0].avgEvidence).toBe(0);
    expect(baseline.spaces[0].avgSubspaceCount).toBe(0);
    expect(baseline.globalAvgMassVector).toEqual([0, 0, 0, 0]);
  });
});
