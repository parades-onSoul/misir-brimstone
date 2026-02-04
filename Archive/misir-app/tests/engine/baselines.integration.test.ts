import { describe, it, expect } from 'vitest';
import {
  computeSimpleBaseline,
  computeWeightedBaseline
} from '@/lib/engine/baseline-orchestrator';
import { PersistedSnapshot, SnapshotData, StateVector, StateIndex } from '@/lib/types';

describe('Baseline Integration - Snapshot to Baseline Flow', () => {
  // Create realistic test data
  const createRealisticSnapshot = (daysAgo: number): PersistedSnapshot => {
    const timestamp = new Date();
    timestamp.setDate(timestamp.getDate() - daysAgo);

    // Simulate a user's attention landscape
    const data: SnapshotData = {
      spaces: [
        {
          spaceId: 'ai-research',
          name: 'AI Research',
          massVector: [2, 5, 8, 3] as StateVector, // Mix of states
          totalEvidence: 15.5,
          subspaces: [
            { subspaceId: 'llm-1', name: 'LLMs', evidence: 8.2, state: 2 as StateIndex },
            { subspaceId: 'cv-1', name: 'Computer Vision', evidence: 4.3, state: 2 as StateIndex },
            { subspaceId: 'rl-1', name: 'Reinforcement Learning', evidence: 3.0, state: 1 as StateIndex },
          ],
        },
        {
          spaceId: 'web-dev',
          name: 'Web Development',
          massVector: [1, 2, 1, 0] as StateVector,
          totalEvidence: 5.2,
          subspaces: [
            { subspaceId: 'react-1', name: 'React', evidence: 3.1, state: 2 as StateIndex },
            { subspaceId: 'ts-1', name: 'TypeScript', evidence: 2.1, state: 1 as StateIndex },
          ],
        },
      ],
    };

    return {
      id: `snapshot-${daysAgo}`,
      userId: 'test-user',
      snapshotType: 'daily',
      timestamp,
      data,
    };
  };

  it('should compute baseline from 7 days of realistic snapshots', () => {
    // Create a week of snapshots
    const snapshots = [0, 1, 2, 3, 4, 5, 6].map(createRealisticSnapshot);

    const baseline = computeSimpleBaseline(snapshots);

    // Should have both spaces
    expect(baseline.spaces).toHaveLength(2);
    expect(baseline.totalSpaces).toBe(2);

    // Find AI Research space
    const aiSpace = baseline.spaces.find(s => s.spaceId === 'ai-research');
    expect(aiSpace).toBeDefined();
    expect(aiSpace!.avgMassVector).toEqual([2, 5, 8, 3]);
    expect(aiSpace!.avgEvidence).toBeCloseTo(15.5, 1);
    expect(aiSpace!.avgSubspaceCount).toBe(3);

    // Global mass vector should be sum of space vectors
    expect(baseline.globalAvgMassVector).toEqual([3, 7, 9, 3]);
  });

  it('should show weighted baseline favors recent activity', () => {
    // Create snapshots with changing pattern
    const oldSnapshot = createRealisticSnapshot(29); // 30 days ago
    const recentSnapshot = createRealisticSnapshot(0); // Today

    // Modify recent snapshot to have more activity
    recentSnapshot.data.spaces[0].totalEvidence = 25.0; // Up from 15.5
    recentSnapshot.data.spaces[0].massVector = [1, 3, 10, 6] as StateVector; // More saturated

    const snapshots = [oldSnapshot, recentSnapshot];

    const simple = computeSimpleBaseline(snapshots);
    const weighted = computeWeightedBaseline(snapshots, 0.1);

    // Weighted should have higher evidence (closer to recent 25.0 than average 20.25)
    const simpleAI = simple.spaces.find(s => s.spaceId === 'ai-research')!;
    const weightedAI = weighted.spaces.find(s => s.spaceId === 'ai-research')!;

    expect(weightedAI.avgEvidence).toBeGreaterThan(simpleAI.avgEvidence);
    expect(weightedAI.avgEvidence).toBeGreaterThan(20); // Closer to 25
  });

  it('should handle space creation and deletion gracefully', () => {
    // Day 1-3: Only AI Research
    const early = [0, 1, 2].map(i => {
      const snap = createRealisticSnapshot(i);
      snap.data.spaces = [snap.data.spaces[0]]; // Only AI Research
      return snap;
    });

    // Day 4-6: Both spaces
    const later = [3, 4, 5].map(createRealisticSnapshot);

    const snapshots = [...early, ...later];
    const baseline = computeSimpleBaseline(snapshots);

    // AI Research should average across all 6 days
    const aiSpace = baseline.spaces.find(s => s.spaceId === 'ai-research')!;
    expect(aiSpace.avgEvidence).toBeCloseTo(15.5, 1);

    // Web Dev should average across only 3 days it exists
    const webSpace = baseline.spaces.find(s => s.spaceId === 'web-dev')!;
    expect(webSpace.avgEvidence).toBeCloseTo(5.2, 1);
  });

  it('should compute baseline that can be used for delta detection', () => {
    // Establish baseline from past week
    const baselineSnapshots = [7, 8, 9, 10, 11, 12, 13].map(createRealisticSnapshot);
    const baseline = computeWeightedBaseline(baselineSnapshots, 0.1);

    // Current snapshot with increased activity
    const current = createRealisticSnapshot(0);
    current.data.spaces[0].totalEvidence = 30.0; // Spike in AI Research

    // Compare current to baseline
    const baselineAI = baseline.spaces.find(s => s.spaceId === 'ai-research')!;
    const currentAI = current.data.spaces[0];

    const delta = currentAI.totalEvidence - baselineAI.avgEvidence;
    const percentChange = (delta / baselineAI.avgEvidence) * 100;

    expect(delta).toBeGreaterThan(10); // Significant increase
    expect(percentChange).toBeGreaterThan(50); // >50% increase

    // This delta could trigger an insight: "Your AI Research attention is 94% above normal"
  });

  it('should maintain numerical stability with large datasets', () => {
    // Create 30 days of snapshots
    const snapshots = Array.from({ length: 30 }, (_, i) => createRealisticSnapshot(i));

    const baseline = computeWeightedBaseline(snapshots, 0.1);

    // Verify no NaN or Infinity values
    baseline.spaces.forEach(space => {
      space.avgMassVector.forEach(v => {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      });
      expect(Number.isFinite(space.avgEvidence)).toBe(true);
      expect(Number.isFinite(space.avgSubspaceCount)).toBe(true);
    });

    // Global vector should be valid
    baseline.globalAvgMassVector.forEach(v => {
      expect(Number.isFinite(v)).toBe(true);
    });
  });
});

describe('Baseline Quality Metrics', () => {
  const createSnapshot = (daysAgo: number, variance: number = 0): PersistedSnapshot => {
    const base = {
      spaceId: 'space-1',
      name: 'Test Space',
      massVector: [2, 3, 2, 1] as StateVector,
      totalEvidence: 10.0,
      subspaces: [
        { subspaceId: 'sub-1', name: 'Sub 1', evidence: 5.0, state: 1 as StateIndex },
        { subspaceId: 'sub-2', name: 'Sub 2', evidence: 5.0, state: 2 as StateIndex },
      ],
    };

    // Add variance
    const data: SnapshotData = {
      spaces: [{
        ...base,
        totalEvidence: base.totalEvidence + (Math.random() * variance * 2 - variance),
      }],
    };

    const timestamp = new Date();
    timestamp.setDate(timestamp.getDate() - daysAgo);

    return {
      id: `snapshot-${daysAgo}`,
      userId: 'test-user',
      snapshotType: 'daily',
      timestamp,
      data,
    };
  };

  it('should be stable with low variance data', () => {
    // Create snapshots with minimal variance
    const snapshots = Array.from({ length: 10 }, (_, i) => createSnapshot(i, 0.5));

    const baseline = computeWeightedBaseline(snapshots, 0.1);
    const space = baseline.spaces[0];

    // Evidence should be close to 10.0 with low variance
    expect(space.avgEvidence).toBeGreaterThan(9.0);
    expect(space.avgEvidence).toBeLessThan(11.0);
  });

  it('should smooth out high variance data', () => {
    // Create snapshots with high variance
    const snapshots = Array.from({ length: 30 }, (_, i) => createSnapshot(i, 5.0));

    const baseline = computeWeightedBaseline(snapshots, 0.1);
    const space = baseline.spaces[0];

    // Should still center around 10.0 despite variance
    expect(space.avgEvidence).toBeGreaterThan(7.0);
    expect(space.avgEvidence).toBeLessThan(13.0);
  });
});
