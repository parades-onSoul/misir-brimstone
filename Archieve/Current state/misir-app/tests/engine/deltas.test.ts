/**
 * Delta Detection Unit Tests
 * 
 * Tests for delta detection algorithms.
 * JTD-P2: Delta Detection
 */

import { describe, it, expect } from 'vitest';
import {
  detectDeltas,
  detectVelocityChange
} from '@/lib/engine/deltas';
import { SnapshotData, StateVector } from '@/lib/types';
import { PersistedBaseline, BaselineData } from '@/lib/engine/baseline-orchestrator';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockSnapshot(spaces: Array<{
  spaceId: string;
  name: string;
  massVector: StateVector;
  totalEvidence: number;
  subspaces?: Array<{
    subspaceId: string;
    name: string;
    evidence: number;
    state: 0 | 1 | 2 | 3;
  }>;
}>): SnapshotData {
  return {
    spaces: spaces.map(space => ({
      spaceId: space.spaceId,
      name: space.name,
      massVector: space.massVector,
      totalEvidence: space.totalEvidence,
      subspaces: space.subspaces || [],
    })),
  };
}

function createMockBaseline(spaces: Array<{
  spaceId: string;
  name: string;
  avgMassVector: StateVector;
  avgEvidence: number;
}>): PersistedBaseline {
  const baselineData: BaselineData = {
    globalAvgMassVector: spaces.reduce(
      (sum, s) => sum.map((v, i) => v + s.avgMassVector[i]) as StateVector,
      [0, 0, 0, 0] as StateVector
    ),
    totalSpaces: spaces.length,
    totalSubspaces: 0,
    spaces: spaces.map(s => ({
      spaceId: s.spaceId,
      name: s.name,
      avgMassVector: s.avgMassVector,
      avgEvidence: s.avgEvidence,
      avgSubspaceCount: 0,
    })),
  };

  return {
    id: 'test-baseline-id',
    userId: 'test-user-id',
    computedAt: new Date(),
    windowDays: 30,
    baselineType: 'weighted',
    alpha: 0.1,
    data: baselineData,
    snapshotsUsed: 30,
  };
}

// ============================================================================
// Drift Detection Tests
// ============================================================================

describe('Drift Detection', () => {
  it('detects significant mass vector drift', () => {
    const current = createMockSnapshot([{
      spaceId: 'space-1',
      name: 'Machine Learning',
      massVector: [1, 3, 4, 2], // Shifted toward Engaged
      totalEvidence: 20,
      subspaces: [],
    }]);

    const baseline = createMockBaseline([{
      spaceId: 'space-1',
      name: 'Machine Learning',
      avgMassVector: [4, 3, 2, 1], // Was more Latent
      avgEvidence: 20,
    }]);

    const deltas = detectDeltas(current, baseline);

    const driftDelta = deltas.find(d => d.type === 'drift');
    expect(driftDelta).toBeDefined();
    expect(driftDelta?.spaceId).toBe('space-1');
    expect(driftDelta?.severity).toBe('high'); // totalShift = |1-4| + |3-3| + |4-2| + |2-1| = 6 > 4
  });

  it('ignores small mass vector changes', () => {
    const current = createMockSnapshot([{
      spaceId: 'space-1',
      name: 'Machine Learning',
      massVector: [2.5, 2.5, 2.5, 2.5],
      totalEvidence: 20,
      subspaces: [],
    }]);

    const baseline = createMockBaseline([{
      spaceId: 'space-1',
      name: 'Machine Learning',
      avgMassVector: [2.3, 2.6, 2.4, 2.7],
      avgEvidence: 20,
    }]);

    const deltas = detectDeltas(current, baseline);
    const driftDelta = deltas.find(d => d.type === 'drift');

    expect(driftDelta).toBeUndefined(); // totalShift = 0.8 < 2
  });

  it('categorizes drift direction correctly', () => {
    const current = createMockSnapshot([{
      spaceId: 'space-1',
      name: 'Machine Learning',
      massVector: [1, 2, 3, 4], // More Saturated
      totalEvidence: 20,
      subspaces: [],
    }]);

    const baseline = createMockBaseline([{
      spaceId: 'space-1',
      name: 'Machine Learning',
      avgMassVector: [3, 3, 2, 2], // Was more balanced
      avgEvidence: 20,
    }]);

    const deltas = detectDeltas(current, baseline);
    const driftDelta = deltas.find(d => d.type === 'drift');

    expect(driftDelta?.metadata?.direction).toBe('deepening');
  });
});

// ============================================================================
// Imbalance Detection Tests
// ============================================================================

describe('Imbalance Detection', () => {
  it('detects attention concentration in engaged subspace', () => {
    const current = createMockSnapshot([{
      spaceId: 'space-1',
      name: 'Machine Learning',
      massVector: [2, 2, 4, 2],
      totalEvidence: 100,
      subspaces: [{
        subspaceId: 'sub-1',
        name: 'Transformers',
        evidence: 70, // 70% of total
        state: 2, // Engaged
      }, {
        subspaceId: 'sub-2',
        name: 'CNNs',
        evidence: 30,
        state: 1,
      }],
    }]);

    const baseline = createMockBaseline([{
      spaceId: 'space-1',
      name: 'Machine Learning',
      avgMassVector: [2, 2, 4, 2],
      avgEvidence: 100,
    }]);

    const deltas = detectDeltas(current, baseline);
    const imbalanceDelta = deltas.find(d => d.type === 'imbalance');

    expect(imbalanceDelta).toBeDefined();
    expect(imbalanceDelta?.subspaceId).toBe('sub-1');
    expect(imbalanceDelta?.severity).toBe('high'); // 70% > 60%
    expect(imbalanceDelta?.currentValue).toBe(70);
  });

  it('ignores concentration in low-engagement subspace', () => {
    const current = createMockSnapshot([{
      spaceId: 'space-1',
      name: 'Machine Learning',
      massVector: [4, 3, 2, 1],
      totalEvidence: 100,
      subspaces: [{
        subspaceId: 'sub-1',
        name: 'Transformers',
        evidence: 70, // 70% but only Discovered
        state: 1,
      }],
    }]);

    const baseline = createMockBaseline([{
      spaceId: 'space-1',
      name: 'Machine Learning',
      avgMassVector: [4, 3, 2, 1],
      avgEvidence: 100,
    }]);

    const deltas = detectDeltas(current, baseline);
    const imbalanceDelta = deltas.find(d => d.type === 'imbalance');

    expect(imbalanceDelta).toBeUndefined(); // State < 2
  });
});

// ============================================================================
// Gap Detection Tests
// ============================================================================

describe('Gap Detection', () => {
  it('detects subspaces reverting to latent', () => {
    const current = createMockSnapshot([{
      spaceId: 'space-1',
      name: 'Machine Learning',
      massVector: [6, 2, 1, 1], // More Latent
      totalEvidence: 20,
      subspaces: [],
    }]);

    const baseline = createMockBaseline([{
      spaceId: 'space-1',
      name: 'Machine Learning',
      avgMassVector: [2, 4, 3, 1], // Was more Discovered/Engaged
      avgEvidence: 30,
    }]);

    const deltas = detectDeltas(current, baseline);
    const gapDelta = deltas.find(d => d.type === 'gap');

    expect(gapDelta).toBeDefined();
    expect(gapDelta?.currentValue).toBe(6);
    expect(gapDelta?.baselineValue).toBe(2);
    expect(gapDelta?.severity).toBe('high'); // Increase > 2
  });

  it('ignores normal latent variations', () => {
    const current = createMockSnapshot([{
      spaceId: 'space-1',
      name: 'Machine Learning',
      massVector: [2.5, 3, 3, 1.5],
      totalEvidence: 20,
      subspaces: [],
    }]);

    const baseline = createMockBaseline([{
      spaceId: 'space-1',
      name: 'Machine Learning',
      avgMassVector: [2, 3, 3, 2],
      avgEvidence: 20,
    }]);

    const deltas = detectDeltas(current, baseline);
    const gapDelta = deltas.find(d => d.type === 'gap');

    expect(gapDelta).toBeUndefined(); // Increase = 0.5 ≤ 1
  });
});

// ============================================================================
// False Stability Detection Tests
// ============================================================================

describe('False Stability Detection', () => {
  it('flags saturated subspaces for stability check', () => {
    const current = createMockSnapshot([{
      spaceId: 'space-1',
      name: 'Machine Learning',
      massVector: [1, 1, 2, 6],
      totalEvidence: 40,
      subspaces: [{
        subspaceId: 'sub-1',
        name: 'Transformers',
        evidence: 8,
        state: 3, // Saturated
      }],
    }]);

    const baseline = createMockBaseline([{
      spaceId: 'space-1',
      name: 'Machine Learning',
      avgMassVector: [1, 1, 2, 6],
      avgEvidence: 40,
    }]);

    const deltas = detectDeltas(current, baseline);
    const stabilityDelta = deltas.find(d => d.type === 'false_stability');

    expect(stabilityDelta).toBeDefined();
    expect(stabilityDelta?.subspaceId).toBe('sub-1');
    expect(stabilityDelta?.severity).toBe('low'); // Initial, before enrichment
  });
});

// ============================================================================
// Velocity Change Detection Tests
// ============================================================================

describe('Velocity Change Detection', () => {
  it('detects acceleration (rapid evidence gain)', () => {
    const current = createMockSnapshot([{
      spaceId: 'space-1',
      name: 'Machine Learning',
      massVector: [2, 2, 3, 3],
      totalEvidence: 80, // 60% increase
      subspaces: [],
    }]);

    const baseline = createMockBaseline([{
      spaceId: 'space-1',
      name: 'Machine Learning',
      avgMassVector: [2, 2, 3, 3],
      avgEvidence: 50, // Baseline
    }]);

    const deltas = detectVelocityChange(current, baseline);
    const accelDelta = deltas.find(d => d.type === 'acceleration');

    expect(accelDelta).toBeDefined();
    expect(accelDelta?.changePercent).toBe(60);
    expect(accelDelta?.severity).toBe('medium'); // 60% < 100%
  });

  it('detects high-severity acceleration', () => {
    const current = createMockSnapshot([{
      spaceId: 'space-1',
      name: 'Machine Learning',
      massVector: [1, 2, 4, 3],
      totalEvidence: 120, // 140% increase
      subspaces: [],
    }]);

    const baseline = createMockBaseline([{
      spaceId: 'space-1',
      name: 'Machine Learning',
      avgMassVector: [2, 3, 3, 2],
      avgEvidence: 50,
    }]);

    const deltas = detectVelocityChange(current, baseline);
    const accelDelta = deltas.find(d => d.type === 'acceleration');

    expect(accelDelta).toBeDefined();
    expect(accelDelta?.severity).toBe('high'); // 140% > 100%
  });

  it('detects deceleration (slowing down)', () => {
    const current = createMockSnapshot([{
      spaceId: 'space-1',
      name: 'Machine Learning',
      massVector: [4, 3, 2, 1],
      totalEvidence: 30, // 40% decrease
      subspaces: [],
    }]);

    const baseline = createMockBaseline([{
      spaceId: 'space-1',
      name: 'Machine Learning',
      avgMassVector: [2, 3, 3, 2],
      avgEvidence: 50,
    }]);

    const deltas = detectVelocityChange(current, baseline);
    const decelDelta = deltas.find(d => d.type === 'deceleration');

    expect(decelDelta).toBeDefined();
    expect(decelDelta?.changePercent).toBe(-40);
    expect(decelDelta?.severity).toBe('medium');
  });

  it('ignores normal evidence fluctuations', () => {
    const current = createMockSnapshot([{
      spaceId: 'space-1',
      name: 'Machine Learning',
      massVector: [2.5, 2.5, 2.5, 2.5],
      totalEvidence: 55, // 10% increase (normal)
      subspaces: [],
    }]);

    const baseline = createMockBaseline([{
      spaceId: 'space-1',
      name: 'Machine Learning',
      avgMassVector: [2.5, 2.5, 2.5, 2.5],
      avgEvidence: 50,
    }]);

    const deltas = detectVelocityChange(current, baseline);

    expect(deltas.length).toBe(0);
  });
});

// ============================================================================
// Multi-Space Detection Tests
// ============================================================================

describe('Multi-Space Detection', () => {
  it('detects deltas across multiple spaces', () => {
    const current = createMockSnapshot([
      {
        spaceId: 'space-1',
        name: 'Machine Learning',
        massVector: [1, 2, 4, 3], // Shifted
        totalEvidence: 100,
        subspaces: [],
      },
      {
        spaceId: 'space-2',
        name: 'Product Design',
        massVector: [5, 3, 1, 1], // More Latent
        totalEvidence: 20,
        subspaces: [],
      },
    ]);

    const baseline = createMockBaseline([
      {
        spaceId: 'space-1',
        name: 'Machine Learning',
        avgMassVector: [4, 3, 2, 1],
        avgEvidence: 50,
      },
      {
        spaceId: 'space-2',
        name: 'Product Design',
        avgMassVector: [2, 3, 3, 2],
        avgEvidence: 50,
      },
    ]);

    const deltas = detectDeltas(current, baseline);

    // Should have drift for space-1 and gap for space-2
    const space1Deltas = deltas.filter(d => d.spaceId === 'space-1');
    const space2Deltas = deltas.filter(d => d.spaceId === 'space-2');

    expect(space1Deltas.some(d => d.type === 'drift')).toBe(true);
    expect(space2Deltas.some(d => d.type === 'gap')).toBe(true);
  });

  it('handles spaces that only exist in current snapshot', () => {
    const current = createMockSnapshot([
      {
        spaceId: 'space-1',
        name: 'Machine Learning',
        massVector: [2, 3, 3, 2],
        totalEvidence: 50,
        subspaces: [],
      },
      {
        spaceId: 'new-space',
        name: 'New Topic',
        massVector: [5, 3, 1, 1],
        totalEvidence: 10,
        subspaces: [],
      },
    ]);

    const baseline = createMockBaseline([{
      spaceId: 'space-1',
      name: 'Machine Learning',
      avgMassVector: [2, 3, 3, 2],
      avgEvidence: 50,
    }]);

    const deltas = detectDeltas(current, baseline);

    // new-space should be skipped (no baseline to compare)
    const newSpaceDeltas = deltas.filter(d => d.spaceId === 'new-space');
    expect(newSpaceDeltas.length).toBe(0);
  });
});
