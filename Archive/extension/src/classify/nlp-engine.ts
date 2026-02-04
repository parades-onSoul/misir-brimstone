/**
 * The Brain - NLP Analysis Engine
 * 
 * Runs in background service worker.
 * Receives clean text from content script and performs semantic matching.
 * 
 * NOTE: wink-nlp requires some browser APIs that may not be available
 * in all service worker contexts. This module uses a fallback tokenizer
 * for robustness.
 */

import type { SpaceCentroid, MatchResult } from './types';

// ============================================================================
// TOKENIZER (Service Worker Safe)
// ============================================================================

// Common English stop words to filter out
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he',
  'she', 'we', 'they', 'what', 'which', 'who', 'whom', 'whose', 'where',
  'when', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
  'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'here',
  'there', 'then', 'once', 'if', 'about', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'under', 'again',
  'further', 'while', 'any', 'up', 'down', 'out', 'off', 'over', 'under',
]);

/**
 * Simple stemmer - reduces words to approximate stems.
 * Not as good as Porter Stemmer but fast and dependency-free.
 */
function simpleStem(word: string): string {
  // Handle common suffixes
  if (word.endsWith('ing')) {
    return word.slice(0, -3);
  }
  if (word.endsWith('tion') || word.endsWith('sion')) {
    return word.slice(0, -3);
  }
  if (word.endsWith('ness') || word.endsWith('ment') || word.endsWith('ence') || word.endsWith('ance')) {
    return word.slice(0, -4);
  }
  if (word.endsWith('ous') || word.endsWith('ive') || word.endsWith('ful')) {
    return word.slice(0, -3);
  }
  if (word.endsWith('ly')) {
    return word.slice(0, -2);
  }
  if (word.endsWith('es') && word.length > 3) {
    return word.slice(0, -2);
  }
  if (word.endsWith('ed') && word.length > 3) {
    return word.slice(0, -2);
  }
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) {
    return word.slice(0, -1);
  }
  return word;
}

/**
 * Tokenize text into clean, stemmed tokens.
 * Service-worker safe (no DOM required).
 */
export function tokenize(text: string, maxTokens = 2000): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')  // Keep apostrophes and hyphens
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t))
    .map(simpleStem)
    .filter(t => t.length > 2)
    .slice(0, maxTokens);
}

/**
 * Convert tokens to a term-frequency vector.
 */
export function tokensToVector(tokens: string[]): Record<string, number> {
  const vector: Record<string, number> = {};
  for (const token of tokens) {
    vector[token] = (vector[token] || 0) + 1;
  }
  return vector;
}

// ============================================================================
// SIMILARITY
// ============================================================================

/**
 * Compute cosine similarity between two vectors.
 */
export function cosineSimilarity(
  vecA: Record<string, number>,
  vecB: Record<string, number>
): number {
  const keys = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
  
  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  keys.forEach(key => {
    const valA = vecA[key] || 0;
    const valB = vecB[key] || 0;
    dotProduct += valA * valB;
    magA += valA * valA;
    magB += valB * valB;
  });

  return (magA && magB) ? dotProduct / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;
}

// ============================================================================
// MAIN ANALYSIS
// ============================================================================

/**
 * Analyze content relevance against user's Space centroids.
 * 
 * @param cleanText Clean text content (from Readability)
 * @param centroids User's space centroids with term vectors
 */
export function analyzeRelevance(
  cleanText: string,
  centroids: SpaceCentroid[]
): MatchResult {
  // Edge case: no centroids = allow everything
  if (centroids.length === 0) {
    return {
      pass: true,
      score: 0,
      suggestedSpaceIds: [],
      matchedMarkerIds: [],
    };
  }

  // 1. Tokenize the content
  const tokens = tokenize(cleanText);
  
  // Too short = unreliable
  if (tokens.length < 30) {
    return {
      pass: false,
      score: 0,
      suggestedSpaceIds: [],
      matchedMarkerIds: [],
    };
  }

  // 2. Convert to vector
  const pageVector = tokensToVector(tokens);

  // 3. Match against each centroid
  let bestScore = 0;
  let bestMatch: { spaceId: string; spaceName: string; similarity: number } | undefined;
  const matchedSpaceIds: string[] = [];

  for (const centroid of centroids) {
    const similarity = cosineSimilarity(pageVector, centroid.vector);
    // Use hard-coded 5% threshold (ignore legacy stored thresholds)
    const threshold = 0.05;

    console.log(`[NLP] "${centroid.spaceName}": ${(similarity * 100).toFixed(1)}% (threshold: 5%)`);

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

  // 4. Apply boost for multiple matches
  if (matchedSpaceIds.length > 1) {
    bestScore = Math.min(1, bestScore * 1.2);
  }

  return {
    pass: matchedSpaceIds.length > 0,
    score: Math.round(bestScore * 100),
    suggestedSpaceIds: matchedSpaceIds,
    matchedMarkerIds: [],
    topMatch: bestMatch,
  };
}

/**
 * Quick analysis using just title/URL (for popup display).
 * Lighter weight than full content analysis.
 */
export function analyzeQuickContext(
  title: string,
  url: string,
  centroids: SpaceCentroid[]
): MatchResult {
  if (centroids.length === 0) {
    return { pass: true, score: 0, suggestedSpaceIds: [], matchedMarkerIds: [] };
  }

  // Combine title + URL path for more signal
  const urlObj = new URL(url);
  const text = `${title} ${urlObj.hostname} ${urlObj.pathname}`;
  
  const tokens = tokenize(text, 100);
  const pageVector = tokensToVector(tokens);

  let bestScore = 0;
  let bestMatch: { spaceId: string; spaceName: string; similarity: number } | undefined;
  const matchedSpaceIds: string[] = [];

  for (const centroid of centroids) {
    const similarity = cosineSimilarity(pageVector, centroid.vector);
    // Quick context has less signal, use lower 3% threshold
    const threshold = 0.03;

    if (similarity >= threshold) {
      matchedSpaceIds.push(centroid.spaceId);
      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = { spaceId: centroid.spaceId, spaceName: centroid.spaceName, similarity };
      }
    }
  }

  return {
    pass: matchedSpaceIds.length > 0,
    score: Math.round(bestScore * 100),
    suggestedSpaceIds: matchedSpaceIds,
    matchedMarkerIds: [],
    topMatch: bestMatch,
  };
}
