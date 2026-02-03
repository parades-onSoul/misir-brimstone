/**
 * Math Layer (Vector Operations)
 * 
 * Core math for the Smart Sensor:
 * - Cosine Similarity: Measures angle between vectors
 * - Text to Vector: Converts token array to term-frequency vector
 * 
 * This is fast (milliseconds) and runs entirely in the browser.
 */

// A Vector is just string -> number (term -> weight)
export type Vector = Record<string, number>;

// ============================================================================
// COSINE SIMILARITY
// ============================================================================

/**
 * Calculate Cosine Similarity between two vectors.
 * Returns 0.0 (no match) to 1.0 (perfect match).
 * 
 * cos(θ) = (A · B) / (||A|| × ||B||)
 * 
 * @param vecA First vector (e.g., page vector)
 * @param vecB Second vector (e.g., space centroid)
 */
export function cosineSimilarity(vecA: Vector, vecB: Vector): number {
  // Find intersection of keys
  const intersection = Object.keys(vecA).filter(k => k in vecB);
  
  if (intersection.length === 0) return 0;

  // Dot Product: Σ(a[i] × b[i])
  const dotProduct = intersection.reduce(
    (sum, key) => sum + (vecA[key] * vecB[key]), 
    0
  );

  // Magnitude: √(Σ(v[i]²))
  const magnitudeA = Math.sqrt(
    Object.values(vecA).reduce((sum, val) => sum + val * val, 0)
  );
  const magnitudeB = Math.sqrt(
    Object.values(vecB).reduce((sum, val) => sum + val * val, 0)
  );

  // Guard against division by zero
  if (magnitudeA === 0 || magnitudeB === 0) return 0;

  return dotProduct / (magnitudeA * magnitudeB);
}

// ============================================================================
// TEXT TO VECTOR
// ============================================================================

/**
 * Convert an array of tokens to a term-frequency vector.
 * 
 * @param tokens Array of normalized tokens (stems/lemmas)
 * @param normalize If true, divide by total count (TF normalization)
 */
export function textToVector(tokens: string[], normalize = false): Vector {
  const vec: Vector = {};
  
  // Count term frequency
  for (const token of tokens) {
    vec[token] = (vec[token] || 0) + 1;
  }
  
  // Optionally normalize by document length
  if (normalize && tokens.length > 0) {
    const len = tokens.length;
    for (const key in vec) {
      vec[key] = vec[key] / len;
    }
  }

  return vec;
}

// ============================================================================
// VECTOR UTILITIES
// ============================================================================

/**
 * Get the top N terms from a vector (by weight).
 */
export function topTerms(vec: Vector, n: number = 10): string[] {
  return Object.entries(vec)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([term]) => term);
}

/**
 * Merge two vectors (union with max weight).
 */
export function mergeVectors(vecA: Vector, vecB: Vector): Vector {
  const merged: Vector = { ...vecA };
  
  for (const [key, value] of Object.entries(vecB)) {
    merged[key] = Math.max(merged[key] || 0, value);
  }
  
  return merged;
}

/**
 * Filter vector to only include terms above a threshold.
 */
export function filterVector(vec: Vector, minWeight: number): Vector {
  const filtered: Vector = {};
  
  for (const [key, value] of Object.entries(vec)) {
    if (value >= minWeight) {
      filtered[key] = value;
    }
  }
  
  return filtered;
}

/**
 * Calculate vector magnitude (length).
 */
export function magnitude(vec: Vector): number {
  return Math.sqrt(
    Object.values(vec).reduce((sum, val) => sum + val * val, 0)
  );
}
