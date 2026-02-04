/**
 * Layer 2: Heuristics (The Gatekeeper)
 * 
 * Contains the specific math for engagement assessment.
 * Includes the Social Multiplier fix (0.5) to penalize doomscrolling.
 */

import type { ContextSignal, HeuristicResult, EngagementLevel } from './types';
import { classifyUrl } from './blocklist';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Multipliers: Lower = harder to count (need more real time)
 * 
 * Formula: adjustedScore = rawDwellTime × multiplier
 * 
 * Example with social (0.5):
 *   60s scroll × 0.5 = 30s credit
 *   Need 2x real time to get same credit as article
 */
export const MULTIPLIERS: Record<string, number> = {
  video: 0.3,         // 100s watch → 30s credit (passive consumption)
  documentation: 1.2, // 25s read → 30s credit (high intent, dense)
  chat: 0.5,          // 60s chat → 30s credit (variable quality)
  code: 1.5,          // 20s read → 30s credit (high effort reading)
  forum: 0.8,         // 37s read → 30s credit (noise potential)
  article: 1.0,       // 30s read → 30s credit (baseline)
  social: 0.5,        // 60s scroll → 30s credit (anti-doomscroll)
  unknown: 1.0,
};

export const THRESHOLDS = {
  MIN_DWELL_MS: 5000,     // 5s hard floor - below this, discard
  MIN_WORDS: 100,         // Minimum words for article content
  AMBIENT_FLOOR: 30000,   // < 30s adjusted = ambient
  ENGAGED_FLOOR: 120000,  // 30s-2min adjusted = engaged
  // > 2min adjusted = committed
};

// ============================================================================
// HEURISTIC ASSESSMENT
// ============================================================================

/**
 * Assess engagement level based on dwell time and content type.
 * This is the main gatekeeper that determines what gets processed.
 */
export function assessHeuristics(
  context: ContextSignal, 
  rawDwellTimeMs: number
): HeuristicResult {
  
  // =========================================
  // GATE 1: Absolute minimum dwell time
  // =========================================
  if (rawDwellTimeMs < THRESHOLDS.MIN_DWELL_MS) {
    return {
      verdict: 'discard',
      adjustedScoreMs: 0,
      rawDwellTimeMs,
      multiplierUsed: 0,
      shouldValidateSemantics: false,
      reason: `Dwell too short: ${rawDwellTimeMs}ms < ${THRESHOLDS.MIN_DWELL_MS}ms`,
    };
  }
  
  // =========================================
  // GATE 2: Minimum word count for articles
  // =========================================
  if (context.estimatedWordCount < THRESHOLDS.MIN_WORDS && context.contentType === 'article') {
    return {
      verdict: 'discard',
      adjustedScoreMs: 0,
      rawDwellTimeMs,
      multiplierUsed: 0,
      shouldValidateSemantics: false,
      reason: `Too few words: ${context.estimatedWordCount} < ${THRESHOLDS.MIN_WORDS}`,
    };
  }

  // =========================================
  // CALCULATE: Adjusted score with multiplier
  // =========================================
  const multiplier = MULTIPLIERS[context.contentType] || 1.0;
  const adjustedScoreMs = rawDwellTimeMs * multiplier;

  // =========================================
  // CLASSIFY: Determine engagement level
  // =========================================
  let verdict: EngagementLevel;
  let reason: string;
  
  if (adjustedScoreMs >= THRESHOLDS.ENGAGED_FLOOR) {
    verdict = 'committed';
    reason = `${Math.round(rawDwellTimeMs/1000)}s × ${multiplier} = ${Math.round(adjustedScoreMs/1000)}s ≥ 2min`;
  } else if (adjustedScoreMs >= THRESHOLDS.AMBIENT_FLOOR) {
    verdict = 'engaged';
    reason = `${Math.round(rawDwellTimeMs/1000)}s × ${multiplier} = ${Math.round(adjustedScoreMs/1000)}s ≥ 30s`;
  } else {
    verdict = 'ambient';
    reason = `${Math.round(rawDwellTimeMs/1000)}s × ${multiplier} = ${Math.round(adjustedScoreMs/1000)}s < 30s`;
  }

  // =========================================
  // OPTIMIZE: Only run semantics on valuable content
  // =========================================
  // Ambient is too fleeting to waste CPU on NLP/DOM traversal
  const shouldValidateSemantics = verdict !== 'ambient';

  return { 
    verdict, 
    adjustedScoreMs, 
    rawDwellTimeMs,
    multiplierUsed: multiplier,
    shouldValidateSemantics,
    reason,
  };
}

// ============================================================================
// URL BLOCKLIST (Pre-filter before any processing)
// ============================================================================

/**
 * Check if URL should be blocked entirely.
 * Uses comprehensive blocklist from blocklist.ts
 */
export function isBlockedUrl(url: string): { blocked: boolean; reason?: string } {
  const classification = classifyUrl(url);
  
  if (classification === 'block') {
    return { blocked: true, reason: 'Blocked by pattern list' };
  }
  
  return { blocked: false };
}
