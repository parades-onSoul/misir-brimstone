/**
 * Semantic Layout Tests (P3.3)
 */

import { describe, it, expect } from 'vitest';
import {
  cosineSimilarity,
  computeSimilarityMatrix,
  projectTo2D_PCA,
  mdsLayout,
  normalizePositions,
  resolveOverlaps,
  computeSemanticLayout,
} from '@/lib/visualization/semantic-layout';

describe('Semantic Layout', () => {
  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const v = [1, 2, 3, 4];
      expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const v1 = [1, 0, 0];
      const v2 = [0, 1, 0];
      expect(cosineSimilarity(v1, v2)).toBeCloseTo(0, 5);
    });

    it('should return -1 for opposite vectors', () => {
      const v1 = [1, 2, 3];
      const v2 = [-1, -2, -3];
      expect(cosineSimilarity(v1, v2)).toBeCloseTo(-1, 5);
    });

    it('should handle empty vectors', () => {
      expect(cosineSimilarity([], [])).toBe(0);
    });

    it('should handle mismatched lengths', () => {
      expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    });
  });

  describe('computeSimilarityMatrix', () => {
    it('should create symmetric matrix', () => {
      const embeddings = [
        [1, 0, 0],
        [0, 1, 0],
        [1, 1, 0],
      ];
      const matrix = computeSimilarityMatrix(embeddings);
      
      expect(matrix.length).toBe(3);
      expect(matrix[0][1]).toBeCloseTo(matrix[1][0], 5);
      expect(matrix[0][2]).toBeCloseTo(matrix[2][0], 5);
    });

    it('should have 1s on diagonal', () => {
      const embeddings = [
        [1, 2, 3],
        [4, 5, 6],
      ];
      const matrix = computeSimilarityMatrix(embeddings);
      
      expect(matrix[0][0]).toBe(1);
      expect(matrix[1][1]).toBe(1);
    });
  });

  describe('projectTo2D_PCA', () => {
    it('should return single centered point for one embedding', () => {
      const result = projectTo2D_PCA([[1, 2, 3]]);
      expect(result).toHaveLength(1);
      expect(result[0].x).toBe(0.5);
      expect(result[0].y).toBe(0.5);
    });

    it('should project multiple embeddings to 2D', () => {
      const embeddings = [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [1, 1, 0, 0],
        [0, 0, 1, 0],
      ];
      const result = projectTo2D_PCA(embeddings);
      
      expect(result).toHaveLength(4);
      result.forEach(p => {
        expect(typeof p.x).toBe('number');
        expect(typeof p.y).toBe('number');
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
      });
    });
  });

  describe('mdsLayout', () => {
    it('should handle empty input', () => {
      expect(mdsLayout([])).toHaveLength(0);
    });

    it('should center single point', () => {
      const result = mdsLayout([[1]]);
      expect(result).toHaveLength(1);
      expect(result[0].x).toBe(0.5);
      expect(result[0].y).toBe(0.5);
    });

    it('should position two points based on similarity', () => {
      // High similarity -> close together
      const highSim = mdsLayout([[1, 0.9], [0.9, 1]]);
      // Low similarity -> far apart
      const lowSim = mdsLayout([[1, 0.1], [0.1, 1]]);
      
      const distHigh = Math.sqrt(
        Math.pow(highSim[0].x - highSim[1].x, 2) +
        Math.pow(highSim[0].y - highSim[1].y, 2)
      );
      const distLow = Math.sqrt(
        Math.pow(lowSim[0].x - lowSim[1].x, 2) +
        Math.pow(lowSim[0].y - lowSim[1].y, 2)
      );
      
      expect(distHigh).toBeLessThan(distLow);
    });
  });

  describe('normalizePositions', () => {
    it('should normalize to [0,1] range', () => {
      const positions = [
        { x: -10, y: -5 },
        { x: 10, y: 5 },
        { x: 0, y: 0 },
      ];
      const result = normalizePositions(positions, 0);
      
      result.forEach(p => {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(1);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(1);
      });
    });

    it('should apply padding', () => {
      const positions = [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ];
      const result = normalizePositions(positions, 0.1);
      
      expect(result[0].x).toBeCloseTo(0.1, 5);
      expect(result[1].x).toBeCloseTo(0.9, 5);
    });
  });

  describe('resolveOverlaps', () => {
    it('should push apart overlapping points', () => {
      const positions = [
        { x: 0.5, y: 0.5 },
        { x: 0.51, y: 0.5 }, // Very close
      ];
      const result = resolveOverlaps(positions, 0.1);
      
      const dist = Math.sqrt(
        Math.pow(result[0].x - result[1].x, 2) +
        Math.pow(result[0].y - result[1].y, 2)
      );
      
      expect(dist).toBeGreaterThanOrEqual(0.05); // Some separation
    });

    it('should not move well-separated points', () => {
      const positions = [
        { x: 0.2, y: 0.2 },
        { x: 0.8, y: 0.8 },
      ];
      const result = resolveOverlaps(positions, 0.05);
      
      // Points should stay roughly in place
      expect(result[0].x).toBeLessThan(0.5);
      expect(result[1].x).toBeGreaterThan(0.5);
    });
  });

  describe('computeSemanticLayout', () => {
    it('should handle subspaces without embeddings', () => {
      const subspaces = [
        { id: '1', spaceId: 's1', userId: 'u1', name: 'A', markers: [], displayOrder: 0, createdAt: new Date(), updatedAt: new Date() },
        { id: '2', spaceId: 's1', userId: 'u1', name: 'B', markers: [], displayOrder: 1, createdAt: new Date(), updatedAt: new Date() },
      ];
      
      const result = computeSemanticLayout(subspaces);
      
      expect(result).toHaveLength(2);
      expect(result[0].subspaceId).toBe('1');
      expect(result[1].subspaceId).toBe('2');
    });

    it('should position subspaces with embeddings semantically', () => {
      const subspaces = [
        { 
          id: '1', spaceId: 's1', userId: 'u1', name: 'A', markers: [], 
          displayOrder: 0, createdAt: new Date(), updatedAt: new Date(),
          embedding: [1, 0, 0, 0]
        },
        { 
          id: '2', spaceId: 's1', userId: 'u1', name: 'B', markers: [], 
          displayOrder: 1, createdAt: new Date(), updatedAt: new Date(),
          embedding: [0.9, 0.1, 0, 0] // Similar to A
        },
        { 
          id: '3', spaceId: 's1', userId: 'u1', name: 'C', markers: [], 
          displayOrder: 2, createdAt: new Date(), updatedAt: new Date(),
          embedding: [0, 0, 1, 0] // Different from A and B
        },
      ];
      
      const result = computeSemanticLayout(subspaces);
      
      expect(result).toHaveLength(3);
      
      // A and B should be closer to each other than to C
      const posA = result.find(p => p.subspaceId === '1')!;
      const posB = result.find(p => p.subspaceId === '2')!;
      const posC = result.find(p => p.subspaceId === '3')!;
      
      const distAB = Math.sqrt(Math.pow(posA.x - posB.x, 2) + Math.pow(posA.y - posB.y, 2));
      const distAC = Math.sqrt(Math.pow(posA.x - posC.x, 2) + Math.pow(posA.y - posC.y, 2));
      
      expect(distAB).toBeLessThan(distAC);
    });
  });
});
