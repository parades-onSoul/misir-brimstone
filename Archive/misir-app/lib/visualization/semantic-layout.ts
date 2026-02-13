/**
 * Semantic Subspace Layout (P3.3)
 * 
 * Positions subspace dots based on embedding similarity using dimensionality reduction.
 * Related subspaces appear closer together in the visualization.
 */

import type { Subspace } from '@/lib/types';

export interface SemanticPosition {
  subspaceId: string;
  x: number;  // Normalized [0, 1]
  y: number;  // Normalized [0, 1]
}

export interface SubspaceWithEmbedding extends Subspace {
  embedding?: number[];
}

/**
 * Compute cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Compute pairwise similarity matrix
 */
export function computeSimilarityMatrix(embeddings: number[][]): number[][] {
  const n = embeddings.length;
  const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1; // Self-similarity
    for (let j = i + 1; j < n; j++) {
      const sim = cosineSimilarity(embeddings[i], embeddings[j]);
      matrix[i][j] = sim;
      matrix[j][i] = sim;
    }
  }
  
  return matrix;
}

/**
 * Simple PCA-based 2D projection
 * 
 * Uses power iteration to find the two principal components.
 * This is a lightweight alternative to full SVD for client-side use.
 */
export function projectTo2D_PCA(embeddings: number[][]): { x: number; y: number }[] {
  if (embeddings.length === 0) return [];
  if (embeddings.length === 1) return [{ x: 0.5, y: 0.5 }];
  
  const n = embeddings.length;
  const d = embeddings[0].length;
  
  // Center the data
  const mean = new Array(d).fill(0);
  for (const emb of embeddings) {
    for (let i = 0; i < d; i++) {
      mean[i] += emb[i] / n;
    }
  }
  
  const centered = embeddings.map(emb => 
    emb.map((val, i) => val - mean[i])
  );
  
  // Power iteration to find principal components
  function powerIteration(data: number[][], numIter: number = 100): number[] {
    const d = data[0].length;
    let v = new Array(d).fill(0).map(() => Math.random() - 0.5);
    
    // Normalize
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    v = v.map(x => x / norm);
    
    for (let iter = 0; iter < numIter; iter++) {
      // v = A^T * A * v where A is the data matrix
      const projected = data.map(row => 
        row.reduce((sum, val, i) => sum + val * v[i], 0)
      );
      
      const newV = new Array(d).fill(0);
      for (let i = 0; i < data.length; i++) {
        for (let j = 0; j < d; j++) {
          newV[j] += data[i][j] * projected[i];
        }
      }
      
      // Normalize
      const newNorm = Math.sqrt(newV.reduce((s, x) => s + x * x, 0));
      if (newNorm > 0) {
        v = newV.map(x => x / newNorm);
      }
    }
    
    return v;
  }
  
  // Find first principal component
  const pc1 = powerIteration(centered);
  
  // Project data onto pc1 and remove
  const projected1 = centered.map(row => 
    row.reduce((sum, val, i) => sum + val * pc1[i], 0)
  );
  
  // Deflate: remove pc1 component
  const deflated = centered.map((row, rowIdx) => 
    row.map((val, i) => val - projected1[rowIdx] * pc1[i])
  );
  
  // Find second principal component
  const pc2 = powerIteration(deflated);
  
  // Project data onto both components
  const projected2 = centered.map(row => 
    row.reduce((sum, val, i) => sum + val * pc2[i], 0)
  );
  
  return projected1.map((x, i) => ({ x, y: projected2[i] }));
}

/**
 * Multi-dimensional scaling (MDS) based on similarity matrix
 * 
 * A simpler approach that directly uses pairwise similarities
 * to position points in 2D space.
 */
export function mdsLayout(similarityMatrix: number[][]): { x: number; y: number }[] {
  const n = similarityMatrix.length;
  if (n === 0) return [];
  if (n === 1) return [{ x: 0.5, y: 0.5 }];
  if (n === 2) {
    const sim = similarityMatrix[0][1];
    const dist = 1 - sim;
    return [{ x: 0.5 - dist/2, y: 0.5 }, { x: 0.5 + dist/2, y: 0.5 }];
  }
  
  // Convert similarities to distances
  const distances = similarityMatrix.map(row => 
    row.map(sim => Math.sqrt(2 * (1 - sim))) // Distance from cosine similarity
  );
  
  // Initialize positions randomly
  const positions = Array(n).fill(null).map(() => ({
    x: Math.random(),
    y: Math.random()
  }));
  
  // Stress majorization (simplified)
  const learningRate = 0.1;
  const iterations = 200;
  
  for (let iter = 0; iter < iterations; iter++) {
    // Compute current distances
    for (let i = 0; i < n; i++) {
      let forceX = 0;
      let forceY = 0;
      
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        
        const dx = positions[j].x - positions[i].x;
        const dy = positions[j].y - positions[i].y;
        const currentDist = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const targetDist = distances[i][j] * 0.5; // Scale factor
        
        // Force proportional to distance error
        const force = (currentDist - targetDist) / currentDist;
        forceX += dx * force;
        forceY += dy * force;
      }
      
      // Apply force with decay
      const decay = 1 - iter / iterations;
      positions[i].x += forceX * learningRate * decay;
      positions[i].y += forceY * learningRate * decay;
    }
  }
  
  return positions;
}

/**
 * Normalize positions to [0, 1] range with padding
 */
export function normalizePositions(
  positions: { x: number; y: number }[],
  padding: number = 0.1
): { x: number; y: number }[] {
  if (positions.length === 0) return [];
  
  const xs = positions.map(p => p.x);
  const ys = positions.map(p => p.y);
  
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  
  return positions.map(p => ({
    x: padding + (1 - 2 * padding) * (p.x - minX) / rangeX,
    y: padding + (1 - 2 * padding) * (p.y - minY) / rangeY,
  }));
}

/**
 * Resolve overlapping positions using force-directed relaxation
 */
export function resolveOverlaps(
  positions: { x: number; y: number }[],
  minDistance: number = 0.08,
  iterations: number = 50
): { x: number; y: number }[] {
  const result = positions.map(p => ({ ...p }));
  
  for (let iter = 0; iter < iterations; iter++) {
    let moved = false;
    
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const dx = result[j].x - result[i].x;
        const dy = result[j].y - result[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < minDistance && dist > 0) {
          const force = (minDistance - dist) / 2;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          
          result[i].x -= fx;
          result[i].y -= fy;
          result[j].x += fx;
          result[j].y += fy;
          moved = true;
        }
      }
    }
    
    if (!moved) break;
  }
  
  // Re-normalize after pushing
  return normalizePositions(result, 0.05);
}

/**
 * Compute semantic layout for subspaces
 * 
 * @param subspaces - Subspaces with embeddings
 * @param method - Layout algorithm to use
 * @returns Normalized positions for each subspace
 */
export function computeSemanticLayout(
  subspaces: SubspaceWithEmbedding[],
  method: 'pca' | 'mds' = 'mds'
): SemanticPosition[] {
  // Filter subspaces that have embeddings
  const withEmbeddings = subspaces.filter(s => s.embedding && s.embedding.length > 0);
  
  if (withEmbeddings.length === 0) {
    // Fall back to evenly distributed positions
    return subspaces.map((s, i) => ({
      subspaceId: s.id,
      x: 0.5 + 0.3 * Math.cos(i * 2 * Math.PI / subspaces.length),
      y: 0.5 + 0.3 * Math.sin(i * 2 * Math.PI / subspaces.length),
    }));
  }
  
  const embeddings = withEmbeddings.map(s => s.embedding!);
  
  let rawPositions: { x: number; y: number }[];
  
  if (method === 'pca') {
    rawPositions = projectTo2D_PCA(embeddings);
  } else {
    // MDS based on similarity
    const similarityMatrix = computeSimilarityMatrix(embeddings);
    rawPositions = mdsLayout(similarityMatrix);
  }
  
  // Normalize and resolve overlaps
  const normalized = normalizePositions(rawPositions);
  const resolved = resolveOverlaps(normalized);
  
  // Map back to subspace IDs
  const positions: SemanticPosition[] = withEmbeddings.map((s, i) => ({
    subspaceId: s.id,
    x: resolved[i].x,
    y: resolved[i].y,
  }));
  
  // Add positions for subspaces without embeddings (fallback spiral)
  const withoutEmbeddings = subspaces.filter(s => !s.embedding || s.embedding.length === 0);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  
  withoutEmbeddings.forEach((s, i) => {
    const angle = i * goldenAngle;
    const radius = 0.3;
    positions.push({
      subspaceId: s.id,
      x: 0.5 + radius * Math.cos(angle),
      y: 0.5 + radius * Math.sin(angle),
    });
  });
  
  return positions;
}

/**
 * Group subspaces by state and compute semantic layout within each group
 * 
 * This ensures nodes stay within their state blob while being
 * semantically positioned relative to siblings in the same state.
 */
export function computeSemanticLayoutByState(
  subspaces: SubspaceWithEmbedding[],
  getState: (subspace: SubspaceWithEmbedding) => number
): Map<number, SemanticPosition[]> {
  const result = new Map<number, SemanticPosition[]>();
  
  // Group by state
  const byState = new Map<number, SubspaceWithEmbedding[]>();
  for (const s of subspaces) {
    const state = getState(s);
    if (!byState.has(state)) {
      byState.set(state, []);
    }
    byState.get(state)!.push(s);
  }
  
  // Compute layout for each state group
  for (const [state, group] of byState) {
    const layout = computeSemanticLayout(group);
    result.set(state, layout);
  }
  
  return result;
}
