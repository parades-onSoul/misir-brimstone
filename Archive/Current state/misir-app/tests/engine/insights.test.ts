/**
 * Insight Framing Unit Tests
 * 
 * Tests for insight generation and framing.
 * JTD-P3: Insight Framing
 */

import { describe, it, expect } from 'vitest';
import { frameInsight, summarizeInsights } from '@/lib/engine/insights';
import { Delta, Insight, DeltaType } from '@/lib/types';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockDelta(
  type: DeltaType,
  overrides?: Partial<Delta>
): Delta {
  const baseDeltas: Record<DeltaType, Partial<Delta>> = {
    imbalance: {
      type: 'imbalance',
      spaceId: 'space-1',
      spaceName: 'Machine Learning',
      subspaceId: 'sub-1',
      subspaceName: 'Transformers',
      severity: 'high',
      currentValue: 72,
      baselineValue: 25,
      changePercent: 188,
      metadata: { windowDays: 14 },
    },
    gap: {
      type: 'gap',
      spaceId: 'space-1',
      spaceName: 'Machine Learning',
      severity: 'medium',
      currentValue: 5,
      baselineValue: 2,
      changePercent: 150,
      metadata: { dormantDays: 14 },
    },
    drift: {
      type: 'drift',
      spaceId: 'space-1',
      spaceName: 'Machine Learning',
      severity: 'high',
      currentValue: 4.5,
      baselineValue: 0,
      changePercent: 450,
      metadata: { massDelta: [1, -1, -0.5, 0.5], direction: 'deepening' },
    },
    false_stability: {
      type: 'false_stability',
      spaceId: 'space-1',
      spaceName: 'Machine Learning',
      subspaceId: 'sub-1',
      subspaceName: 'Transformers',
      severity: 'medium',
      currentValue: 8,
      baselineValue: 8,
      changePercent: 0,
      metadata: { inactiveDays: 10 },
    },
    silent_growth: {
      type: 'silent_growth',
      spaceId: 'space-1',
      spaceName: 'Machine Learning',
      subspaceId: 'sub-2',
      subspaceName: 'RAG',
      severity: 'low',
      currentValue: 2,
      baselineValue: 0,
      changePercent: 0,
    },
    acceleration: {
      type: 'acceleration',
      spaceId: 'space-1',
      spaceName: 'Machine Learning',
      severity: 'medium',
      currentValue: 100,
      baselineValue: 50,
      changePercent: 100,
    },
    deceleration: {
      type: 'deceleration',
      spaceId: 'space-2',
      spaceName: 'Product Design',
      severity: 'medium',
      currentValue: 30,
      baselineValue: 50,
      changePercent: -40,
    },
    return: {
      type: 'return',
      spaceId: 'space-3',
      spaceName: 'TypeScript',
      subspaceId: 'sub-3',
      subspaceName: 'Generics',
      severity: 'low',
      currentValue: 2,
      baselineValue: 0,
      changePercent: 0,
    },
    milestone: {
      type: 'milestone',
      spaceId: 'space-1',
      spaceName: 'Machine Learning',
      subspaceId: 'sub-1',
      subspaceName: 'Transformers',
      severity: 'low',
      currentValue: 1,
      baselineValue: 0,
      changePercent: 0,
      metadata: { milestoneType: 'first_saturation' },
    },
    rabbit_hole: {
      type: 'rabbit_hole',
      spaceId: 'space-1',
      spaceName: 'Machine Learning',
      subspaceId: 'sub-1',
      subspaceName: 'Transformers',
      severity: 'low',
      currentValue: 8,
      baselineValue: 0,
      changePercent: 0,
      metadata: { urlCount: 8, durationMinutes: 45 },
    },
    consumption_trap: {
      type: 'consumption_trap',
      spaceId: 'space-1',
      spaceName: 'Machine Learning',
      severity: 'medium',
      currentValue: 15,
      baselineValue: 0,
      changePercent: 0,
      metadata: { ambientCount: 15, engagedCount: 0, committedCount: 0 },
    },
  };

  return {
    ...baseDeltas[type],
    ...overrides,
  } as Delta;
}

// ============================================================================
// Imbalance Insight Tests
// ============================================================================

describe('Imbalance Insight Framing', () => {
  it('generates headline with percentage and window', () => {
    const delta = createMockDelta('imbalance');
    const insight = frameInsight(delta, 'user-1');

    expect(insight.headline).toBe('72% of activity in one area over 14 days');
    expect(insight.type).toBe('imbalance');
  });

  it('generates explanation with space and subspace names', () => {
    const delta = createMockDelta('imbalance');
    const insight = frameInsight(delta, 'user-1');

    expect(insight.explanation).toContain('Machine Learning');
    expect(insight.explanation).toContain('Transformers');
  });

  it('handles missing subspace name gracefully', () => {
    const delta = createMockDelta('imbalance', { subspaceName: undefined });
    const insight = frameInsight(delta, 'user-1');

    expect(insight.explanation).toContain('a single subspace');
  });
});

// ============================================================================
// Gap Insight Tests
// ============================================================================

describe('Gap Insight Framing', () => {
  it('calculates dormant count correctly', () => {
    const delta = createMockDelta('gap');
    const insight = frameInsight(delta, 'user-1');

    expect(insight.headline).toBe('3 topics with no activity for 14+ days');
  });

  it('uses singular for single dormant topic', () => {
    const delta = createMockDelta('gap', { currentValue: 3, baselineValue: 2 });
    const insight = frameInsight(delta, 'user-1');

    expect(insight.headline).toBe('1 topic with no activity for 14+ days');
  });
});

// ============================================================================
// Drift Insight Tests
// ============================================================================

describe('Drift Insight Framing', () => {
  it('uses direction-specific headline when available', () => {
    const delta = createMockDelta('drift', {
      metadata: { massDelta: [0, 0, 0, 2], direction: 'deepening' }
    });
    const insight = frameInsight(delta, 'user-1');

    expect(insight.headline).toBe('Attention deepening in focused areas');
  });

  it('explains mass delta changes', () => {
    const delta = createMockDelta('drift');
    const insight = frameInsight(delta, 'user-1');

    expect(insight.explanation).toContain('Machine Learning');
    expect(insight.explanation).toContain('saturated');
    expect(insight.explanation).toContain('latent');
  });

  it('handles missing metadata gracefully', () => {
    const delta = createMockDelta('drift', { metadata: undefined });
    const insight = frameInsight(delta, 'user-1');

    expect(insight.headline).toBe('Attention distribution shifted from baseline');
    expect(insight.explanation).toContain('pattern');
  });
});

// ============================================================================
// False Stability Insight Tests
// ============================================================================

describe('False Stability Insight Framing', () => {
  it('includes subspace name and inactive days', () => {
    const delta = createMockDelta('false_stability');
    const insight = frameInsight(delta, 'user-1');

    expect(insight.headline).toBe('Transformers marked saturated, inactive 10 days');
    expect(insight.explanation).toContain('highest state');
  });
});

// ============================================================================
// Silent Growth Insight Tests
// ============================================================================

describe('Silent Growth Insight Framing', () => {
  it('identifies ambient-only growth', () => {
    const delta = createMockDelta('silent_growth');
    const insight = frameInsight(delta, 'user-1');

    expect(insight.headline).toBe('RAG reached Engaged via ambient activity');
    expect(insight.explanation).toContain('page visits alone');
    expect(insight.explanation).toContain('No saves or highlights');
  });
});

// ============================================================================
// Acceleration Insight Tests
// ============================================================================

describe('Acceleration Insight Framing', () => {
  it('shows space name and percentage increase', () => {
    const delta = createMockDelta('acceleration');
    const insight = frameInsight(delta, 'user-1');

    expect(insight.headline).toBe('Machine Learning activity accelerating');
    expect(insight.explanation).toContain('100%');
    expect(insight.explanation).toContain('Rapid learning');
  });
});

// ============================================================================
// Deceleration Insight Tests
// ============================================================================

describe('Deceleration Insight Framing', () => {
  it('shows space name and percentage decrease', () => {
    const delta = createMockDelta('deceleration');
    const insight = frameInsight(delta, 'user-1');

    expect(insight.headline).toBe('Product Design activity slowing down');
    expect(insight.explanation).toContain('40%');
    expect(insight.explanation).toContain('Focus has shifted');
  });
});

// ============================================================================
// Return Insight Tests
// ============================================================================

describe('Return Insight Framing', () => {
  it('indicates return to dormant topic', () => {
    const delta = createMockDelta('return');
    const insight = frameInsight(delta, 'user-1');

    expect(insight.headline).toContain('Returning to');
    expect(insight.headline).toContain('Generics');
    expect(insight.explanation).toContain('rekindled');
  });
});

// ============================================================================
// Milestone Insight Tests
// ============================================================================

describe('Milestone Insight Framing', () => {
  it('celebrates first saturation', () => {
    const delta = createMockDelta('milestone');
    const insight = frameInsight(delta, 'user-1');

    expect(insight.headline).toBe('First topic reached Saturated state');
    expect(insight.explanation).toContain('Deep familiarity');
  });

  it('handles generic milestone', () => {
    const delta = createMockDelta('milestone', { metadata: {} });
    const insight = frameInsight(delta, 'user-1');

    expect(insight.headline).toContain('Milestone reached');
  });
});

// ============================================================================
// Rabbit Hole Insight Tests
// ============================================================================

describe('Rabbit Hole Insight Framing', () => {
  it('shows flow state with artifact count and duration', () => {
    const delta = createMockDelta('rabbit_hole');
    const insight = frameInsight(delta, 'user-1');

    expect(insight.headline).toBe('Flow state detected: 8 artifacts in 45 minutes');
    expect(insight.explanation).toContain('High-velocity exploration');
    expect(insight.explanation).toContain('Transformers');
  });

  it('handles missing duration metadata', () => {
    const delta = createMockDelta('rabbit_hole', {
      metadata: { urlCount: 6 }
    });
    const insight = frameInsight(delta, 'user-1');

    expect(insight.headline).toContain('6 artifacts');
  });
});

// ============================================================================
// Insight Properties Tests
// ============================================================================

describe('Insight Properties', () => {
  it('includes all required fields', () => {
    const delta = createMockDelta('drift');
    const insight = frameInsight(delta, 'user-123');

    expect(insight.id).toBeDefined();
    expect(insight.userId).toBe('user-123');
    expect(insight.createdAt).toBeInstanceOf(Date);
    expect(insight.type).toBe('drift');
    expect(insight.severity).toBe('high');
    expect(insight.headline).toBeDefined();
    expect(insight.explanation).toBeDefined();
    expect(insight.delta).toBe(delta);
  });

  it('does not include suggestion (observational philosophy)', () => {
    const delta = createMockDelta('imbalance');
    const insight = frameInsight(delta, 'user-1');

    expect(insight.suggestion).toBeUndefined();
  });
});

// ============================================================================
// Insight Summary Tests
// ============================================================================

describe('Insight Summary', () => {
  it('summarizes insights by severity', () => {
    const insights: Insight[] = [
      frameInsight(createMockDelta('imbalance', { severity: 'high' }), 'user-1'),
      frameInsight(createMockDelta('drift', { severity: 'high' }), 'user-1'),
      frameInsight(createMockDelta('gap', { severity: 'medium' }), 'user-1'),
      frameInsight(createMockDelta('rabbit_hole', { severity: 'low' }), 'user-1'),
    ];

    const summary = summarizeInsights(insights);

    expect(summary.total).toBe(4);
    expect(summary.high).toBe(2);
    expect(summary.medium).toBe(1);
    expect(summary.low).toBe(1);
    expect(summary.topHeadline).toBeDefined();
  });

  it('handles empty insights array', () => {
    const summary = summarizeInsights([]);

    expect(summary.total).toBe(0);
    expect(summary.high).toBe(0);
    expect(summary.medium).toBe(0);
    expect(summary.low).toBe(0);
    expect(summary.topHeadline).toBeNull();
  });
});

// ============================================================================
// Language Philosophy Tests
// ============================================================================

describe('Observational Language Philosophy', () => {
  const allDeltaTypes: DeltaType[] = [
    'imbalance', 'gap', 'drift', 'false_stability', 'silent_growth',
    'acceleration', 'deceleration', 'return', 'milestone', 'rabbit_hole'
  ];

  it('uses non-prescriptive language (no "should", "must", "need to")', () => {
    for (const type of allDeltaTypes) {
      const delta = createMockDelta(type);
      const insight = frameInsight(delta, 'user-1');

      const prescriptiveWords = ['should', 'must', 'need to', 'have to', 'ought to'];
      const combinedText = insight.headline + ' ' + insight.explanation;

      for (const word of prescriptiveWords) {
        expect(combinedText.toLowerCase()).not.toContain(word);
      }
    }
  });

  it('uses observational language (facts, not judgments)', () => {
    const delta = createMockDelta('imbalance');
    const insight = frameInsight(delta, 'user-1');

    // Should state facts: percentages, counts, time periods
    expect(insight.headline).toMatch(/\d+%/); // Contains a percentage
    expect(insight.headline).toMatch(/\d+ days/); // Contains time period
  });

  it('provides context without advice', () => {
    const delta = createMockDelta('false_stability');
    const insight = frameInsight(delta, 'user-1');

    // Explanation should describe what happened, not what to do
    expect(insight.explanation).toContain('has had no new artifacts');
    expect(insight.explanation).not.toContain('consider');
    expect(insight.explanation).not.toContain('try');
  });
});
