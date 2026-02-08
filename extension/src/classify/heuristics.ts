/**
 * Engagement Heuristics — Score multipliers and thresholds
 *
 * Determines engagement level using time-weighted scoring
 * with multipliers for content type and interaction depth.
 */
import type { EngagementLevel, ContentType, ReadingMetrics } from '@/types';

// ── Multipliers (from archived sensor) ───────────────

/** Content type → time multiplier */
const TYPE_MULTIPLIERS: Record<ContentType, number> = {
  article: 1.0,
  documentation: 1.2,
  code: 1.3,
  video: 0.8,
  chat: 0.6,
  forum: 0.9,
  social: 0.4,
  unknown: 0.7,
};

/** Engagement thresholds */
const THRESHOLDS = {
  ambient: { maxMs: 15000, maxScroll: 0.2 },
  engaged: { minMs: 15000, minScroll: 0.2, minWords: 100 },
  committed: { minMs: 60000, minScroll: 0.5, minWords: 300 },
} as const;

// ── Public API ───────────────────────────────────────

export interface HeuristicResult {
  engagementLevel: EngagementLevel;
  adjustedScore: number;       // Time * multiplier
  multiplier: number;
  confidence: number;          // 0–1
}

/**
 * Assess engagement using heuristics.
 * Returns engagement level, adjusted time score, and confidence.
 */
export function assessEngagement(
  metrics: ReadingMetrics,
  wordCount: number,
  contentType: ContentType
): HeuristicResult {
  const multiplier = TYPE_MULTIPLIERS[contentType] || 0.7;
  const adjustedScore = metrics.dwellTimeMs * multiplier;
  const adjustedSeconds = adjustedScore / 1000;

  // Determine engagement level
  let level: EngagementLevel = 'ambient';
  let confidence = 0.5;

  if (
    adjustedSeconds >= 60 &&
    metrics.scrollDepth >= THRESHOLDS.committed.minScroll &&
    wordCount >= THRESHOLDS.committed.minWords
  ) {
    level = 'committed';
    confidence = Math.min(1, 0.7 + (adjustedSeconds - 60) / 300);
  } else if (
    adjustedSeconds >= 15 &&
    (metrics.scrollDepth >= THRESHOLDS.engaged.minScroll || wordCount >= THRESHOLDS.engaged.minWords)
  ) {
    level = 'engaged';
    confidence = Math.min(1, 0.5 + adjustedSeconds / 120);
  } else {
    // Ambient — low engagement
    confidence = Math.min(1, 0.3 + metrics.scrollDepth * 0.3);
  }

  return {
    engagementLevel: level,
    adjustedScore,
    multiplier,
    confidence,
  };
}

/**
 * Get the base weight for an engagement level (used in WESA).
 */
export function getBaseWeight(level: EngagementLevel): number {
  switch (level) {
    case 'committed':
      return 1.0;
    case 'engaged':
      return 0.6;
    case 'ambient':
      return 0.2;
  }
}
