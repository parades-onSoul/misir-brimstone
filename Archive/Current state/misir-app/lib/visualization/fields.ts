/**
 * Field Functions for Blob Visualization
 * 
 * Maps state vectors to 2D blob geometry using influence fields.
 */

import { StateVector } from '@/lib/types';

export interface Point {
  x: number;
  y: number;
}

/**
 * Base radius for blob (affects overall scale)
 */
const BASE_RADIUS = 100;

/**
 * Number of points to sample around the blob boundary
 */
const RESOLUTION = 64;

/**
 * Field function for state 0 (latent/compressed)
 * Creates inward, compressed influence
 */
function F_0(_theta: number): number {
  return BASE_RADIUS * 0.8;
}

/**
 * Field function for state 1 (discovered/exploratory)
 * Creates outward, irregular exploration pattern
 */
function F_1(theta: number): number {
  return BASE_RADIUS * (1 + 0.3 * Math.sin(2 * theta));
}

/**
 * Field function for state 2 (engaged/stable)
 * Creates stable, expanded form
 */
function F_2(_theta: number): number {
  return BASE_RADIUS * 1.2;
}

/**
 * Field function for state 3 (saturated/dense)
 * Creates heavy, directional influence
 */
function F_3(theta: number): number {
  return BASE_RADIUS * (1 + 0.5 * Math.cos(theta));
}

/**
 * Compute blob boundary from state vector
 * 
 * B(θ) = Σ s_i · F_i(θ)
 * 
 * @param stateVector - State distribution [s0, s1, s2, s3]
 * @returns Array of points forming the blob boundary
 */
export function computeBlobBoundary(stateVector: StateVector): Point[] {
  const points: Point[] = [];
  const [s0, s1, s2, s3] = stateVector;
  
  // Total mass for normalization
  const totalMass = s0 + s1 + s2 + s3;
  
  // Sample points around the circle
  for (let i = 0; i < RESOLUTION; i++) {
    const theta = (i / RESOLUTION) * 2 * Math.PI;
    
    // Weighted sum of field functions
    // Normalize by total mass to maintain constant area
    const radius = (
      (s0 * F_0(theta) +
       s1 * F_1(theta) +
       s2 * F_2(theta) +
       s3 * F_3(theta)) / totalMass
    );
    
    // Convert polar to Cartesian coordinates
    points.push({
      x: radius * Math.cos(theta),
      y: radius * Math.sin(theta),
    });
  }
  
  return points;
}

/**
 * Calculate area of a polygon defined by points
 * Uses the shoelace formula
 */
export function calculatePolygonArea(points: Point[]): number {
  let area = 0;
  const n = points.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  
  return Math.abs(area / 2);
}

/**
 * Validate that blob maintains approximately constant area
 */
export function validateBlobArea(points: Point[]): boolean {
  const area = calculatePolygonArea(points);
  const expectedArea = Math.PI * BASE_RADIUS * BASE_RADIUS;
  const tolerance = 0.2; // 20% tolerance
  
  const ratio = area / expectedArea;
  return ratio >= (1 - tolerance) && ratio <= (1 + tolerance);
}

/**
 * Get color for blob based on dominant state
 */
export function getBlobColor(stateVector: StateVector): string {
  // Find dominant state
  const dominantIndex = stateVector.indexOf(Math.max(...stateVector));
  
  // Color mapping
  const colors = [
    '#6B7280', // state 0: gray (latent)
    '#3B82F6', // state 1: blue (discovered)
    '#10B981', // state 2: green (engaged)
    '#F59E0B', // state 3: amber (saturated)
  ];
  
  return colors[dominantIndex];
}

/**
 * Interpolate between two state vectors for smooth animation
 */
export function interpolateStateVectors(
  from: StateVector,
  to: StateVector,
  t: number // 0 to 1
): StateVector {
  return [
    Math.round(from[0] + (to[0] - from[0]) * t),
    Math.round(from[1] + (to[1] - from[1]) * t),
    Math.round(from[2] + (to[2] - from[2]) * t),
    Math.round(from[3] + (to[3] - from[3]) * t),
  ];
}
