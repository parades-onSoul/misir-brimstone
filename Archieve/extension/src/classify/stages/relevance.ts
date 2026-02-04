/**
 * Stage 2: Relevance (Smart Gate)
 * 
 * Semantic matching using Weighted Keyword Centroids.
 * Uses wink-nlp to tokenize content, then measures
 * Cosine Similarity against Space Centroids.
 * 
 * This is the SMART path - fast (milliseconds), small (KB not MB),
 * but still contextually aware.
 */

import type { SpaceCentroid, MatchResult } from '../types';
import { analyzeContent, quickTokenize } from '../nlp';
import { textToVector, cosineSimilarity, topTerms } from '../math';

// ============================================================================
// CONFIGURATION
// ============================================================================

const RELEVANCE_CONFIG = {
  MIN_TOKENS: 50,           // Skip if page has fewer tokens
  MAX_TOKENS: 2000,         // Limit for performance
  DEFAULT_THRESHOLD: 0.15,  // Default similarity threshold (0-1)
  BOOST_FACTOR: 1.2,        // Boost score if multiple centroids match
} as const;

// ============================================================================
// SEMANTIC RELEVANCE CHECK
// ============================================================================

/**
 * Check if content is semantically relevant to any Space.
 * 
 * @param content Raw text content from page
 * @param centroids User's space centroids from backend
 * @param options Processing options
 */
export function checkSemanticRelevance(
  content: string,
  centroids: SpaceCentroid[],
  options: { quickMode?: boolean } = {}
): MatchResult {
  // No centroids = allow everything (user hasn't set up spaces)
  if (centroids.length === 0) {
    return {
      pass: true,
      score: 0,
      suggestedSpaceIds: [],
      matchedMarkerIds: [],
    };
  }

  // 1. Tokenize the page content
  const tokens = options.quickMode
    ? quickTokenize(content, RELEVANCE_CONFIG.MAX_TOKENS)
    : analyzeContent(content, { maxTokens: RELEVANCE_CONFIG.MAX_TOKENS }).tokens;

  // Too short = unreliable matching
  if (tokens.length < RELEVANCE_CONFIG.MIN_TOKENS) {
    return {
      pass: false,
      score: 0,
      suggestedSpaceIds: [],
      matchedMarkerIds: [],
      topMatch: undefined,
    };
  }

  // 2. Convert to vector
  const pageVector = textToVector(tokens);

  // 3. Compare against every Space Centroid
  let bestScore = 0;
  let bestMatch: { spaceId: string; spaceName: string; similarity: number } | undefined;
  const matchedSpaceIds: string[] = [];

  for (const centroid of centroids) {
    const similarity = cosineSimilarity(pageVector, centroid.vector);
    const threshold = centroid.threshold || RELEVANCE_CONFIG.DEFAULT_THRESHOLD;

    // Debug logging (can be removed in production)
    // console.log(`[Relevance] ${centroid.spaceName}: ${(similarity * 100).toFixed(1)}% (threshold: ${(threshold * 100).toFixed(0)}%)`);

    if (similarity >= threshold) {
      matchedSpaceIds.push(centroid.spaceId);
      
      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = {
          spaceId: centroid.spaceId,
          spaceName: centroid.spaceName,
          similarity,
        };
      }
    }
  }

  // 4. Apply boost for multiple matches (content is broadly relevant)
  if (matchedSpaceIds.length > 1) {
    bestScore = Math.min(1, bestScore * RELEVANCE_CONFIG.BOOST_FACTOR);
  }

  return {
    pass: matchedSpaceIds.length > 0,
    score: Math.round(bestScore * 100),
    suggestedSpaceIds: matchedSpaceIds,
    matchedMarkerIds: [], // Centroids replace markers in this stage
    topMatch: bestMatch,
  };
}

// ============================================================================
// DETAILED ANALYSIS (for debugging/UI)
// ============================================================================

export interface RelevanceDetail {
  spaceId: string;
  spaceName: string;
  similarity: number;
  threshold: number;
  passed: boolean;
  overlappingTerms: string[];
}

/**
 * Get detailed relevance breakdown for each space.
 * Useful for debugging or showing user why content matched.
 */
export function getRelevanceDetails(
  content: string,
  centroids: SpaceCentroid[]
): RelevanceDetail[] {
  const tokens = analyzeContent(content, { maxTokens: RELEVANCE_CONFIG.MAX_TOKENS }).tokens;
  const pageVector = textToVector(tokens);
  const pageTerms = new Set(Object.keys(pageVector));

  return centroids.map(centroid => {
    const similarity = cosineSimilarity(pageVector, centroid.vector);
    const threshold = centroid.threshold || RELEVANCE_CONFIG.DEFAULT_THRESHOLD;
    
    // Find overlapping terms
    const centroidTerms = Object.keys(centroid.vector);
    const overlappingTerms = centroidTerms.filter(term => pageTerms.has(term));

    return {
      spaceId: centroid.spaceId,
      spaceName: centroid.spaceName,
      similarity,
      threshold,
      passed: similarity >= threshold,
      overlappingTerms: overlappingTerms.slice(0, 10), // Top 10
    };
  });
}

// ============================================================================
// CONTENT VECTOR PREVIEW
// ============================================================================

/**
 * Get the top terms from content (for preview/debugging).
 */
export function getContentPreview(content: string, topN = 15): string[] {
  const tokens = analyzeContent(content, { maxTokens: 1000 }).tokens;
  const vec = textToVector(tokens);
  return topTerms(vec, topN);
}
