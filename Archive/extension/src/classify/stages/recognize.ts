/**
 * Stage 1: Recognize (Fast Gate)
 * 
 * Quick pattern matching against user's markers.
 * Checks title, URL, and domain for known patterns.
 * 
 * This is the FAST path - milliseconds, no NLP needed.
 */

import type { ContextSignal, Marker, MatchResult } from '../types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const MATCH_WEIGHTS = {
  TITLE_EXACT: 1.0,      // Marker appears in title exactly
  TITLE_PARTIAL: 0.7,    // Marker is part of a word in title
  URL_PATH: 0.8,         // Marker appears in URL path
  DOMAIN: 0.6,           // Marker matches domain
} as const;

// ============================================================================
// RECOGNIZE STAGE
// ============================================================================

/**
 * Check if context matches any user markers.
 * Returns early if a strong match is found.
 * 
 * @param context Page context (title, url, domain)
 * @param markers User's marker list
 */
export function recognize(
  context: ContextSignal,
  markers: Marker[]
): MatchResult {
  if (markers.length === 0) {
    return {
      pass: true,  // No markers = allow everything
      score: 0,
      suggestedSpaceIds: [],
      matchedMarkerIds: [],
    };
  }

  const titleLower = context.title.toLowerCase();
  const urlLower = context.url.toLowerCase();
  const domainLower = context.domain.toLowerCase();

  const matchedMarkerIds: string[] = [];
  const spaceIdSet = new Set<string>();
  let bestScore = 0;

  for (const marker of markers) {
    const labelLower = marker.label.toLowerCase();
    let matchScore = 0;

    // Check title (strongest signal)
    if (titleLower.includes(labelLower)) {
      // Exact word match vs partial
      const isExact = new RegExp(`\\b${escapeRegex(labelLower)}\\b`).test(titleLower);
      matchScore = Math.max(
        matchScore, 
        isExact ? MATCH_WEIGHTS.TITLE_EXACT : MATCH_WEIGHTS.TITLE_PARTIAL
      );
    }

    // Check URL path
    if (urlLower.includes(labelLower)) {
      matchScore = Math.max(matchScore, MATCH_WEIGHTS.URL_PATH);
    }

    // Check domain
    if (domainLower.includes(labelLower)) {
      matchScore = Math.max(matchScore, MATCH_WEIGHTS.DOMAIN);
    }

    // If matched, record it
    if (matchScore > 0) {
      // Marker now has single space_id (from DB schema)
      matchedMarkerIds.push(marker.id);
      if (marker.space_id) {
        spaceIdSet.add(marker.space_id);
      }
      
      if (matchScore > bestScore) {
        bestScore = matchScore;
      }
    }
  }

  return {
    pass: matchedMarkerIds.length > 0 || markers.length === 0,
    score: Math.round(bestScore * 100),
    suggestedSpaceIds: Array.from(spaceIdSet),
    matchedMarkerIds,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Quick check if any marker matches (for early filtering).
 * Faster than full recognize() when you just need a boolean.
 */
export function hasAnyMarkerMatch(
  context: ContextSignal,
  markers: Marker[]
): boolean {
  if (markers.length === 0) return true;

  const titleLower = context.title.toLowerCase();
  const urlLower = context.url.toLowerCase();

  for (const marker of markers) {
    const labelLower = marker.label.toLowerCase();
    if (titleLower.includes(labelLower) || urlLower.includes(labelLower)) {
      return true;
    }
  }

  return false;
}
