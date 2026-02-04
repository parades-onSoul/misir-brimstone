/**
 * Artifact Type Classification
 * 
 * Determines signal strength based on engagement metrics.
 * No AI - just rules based on observable behavior.
 */

import type { ArtifactType } from '../types';

interface ClassifyInput {
  dwellTimeMs: number;
  scrollDepth: number;      // 0-1
  wordCount: number;
  hasSelection?: boolean;   // User highlighted/copied
  isManual?: boolean;       // User clicked save
}

// ============================================================================
// THRESHOLDS
// ============================================================================

const THRESHOLDS = {
  // Minimum dwell time for each level (ms)
  DWELL: {
    GLANCE: 5000,      // 5s - barely looked
    READ: 30000,       // 30s - actually reading
    STUDY: 120000,     // 2min - deep engagement
  },
  
  // Scroll depth for each level (0-1)
  SCROLL: {
    SURFACE: 0.25,     // Saw the top
    PARTIAL: 0.50,     // Read halfway
    COMPLETE: 0.80,    // Read most of it
  },
  
  // Expected reading speed (words per minute)
  READING_WPM: 200,
} as const;

// ============================================================================
// CLASSIFICATION
// ============================================================================

/**
 * Classify artifact based on engagement signals
 */
export function classifyArtifact(input: ClassifyInput): ArtifactType {
  // Manual save = at least engaged
  if (input.isManual) {
    return input.hasSelection ? 'committed' : 'engaged';
  }
  
  // Selection/copy = committed
  if (input.hasSelection) {
    return 'committed';
  }
  
  // Calculate engagement score
  const score = calculateEngagementScore(input);
  
  if (score >= 0.7) return 'committed';
  if (score >= 0.4) return 'engaged';
  return 'ambient';
}

/**
 * Calculate normalized engagement score (0-1)
 */
function calculateEngagementScore(input: ClassifyInput): number {
  const { dwellTimeMs, scrollDepth, wordCount } = input;
  
  // Expected read time based on word count
  const expectedReadMs = (wordCount / THRESHOLDS.READING_WPM) * 60 * 1000;
  
  // Time ratio: how long vs expected (capped at 1.5x)
  const timeRatio = Math.min(dwellTimeMs / Math.max(expectedReadMs, 10000), 1.5);
  
  // Normalize to 0-1
  const timeScore = timeRatio / 1.5;
  
  // Scroll score is already 0-1
  const scrollScore = scrollDepth;
  
  // Combined: 60% time, 40% scroll
  return (timeScore * 0.6) + (scrollScore * 0.4);
}

/**
 * Get reading depth multiplier for backend
 */
export function getReadingDepth(input: ClassifyInput): number {
  const score = calculateEngagementScore(input);
  
  if (score < 0.2) return 0;      // Bounce
  if (score < 0.4) return 0.5;    // Skim
  if (score < 0.7) return 1.0;    // Read
  return 1.5;                      // Deep study
}

/**
 * Get human-readable engagement level
 */
export function getEngagementLabel(type: ArtifactType): string {
  switch (type) {
    case 'ambient': return 'Glanced';
    case 'engaged': return 'Read';
    case 'committed': return 'Studied';
    default: return 'Unknown';
  }
}

/**
 * Get artifact type weight for backend
 */
export function getArtifactWeight(type: ArtifactType): number {
  switch (type) {
    case 'ambient': return 0.2;
    case 'engaged': return 1.0;
    case 'committed': return 2.0;
    default: return 0.2;
  }
}
