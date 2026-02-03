/**
 * Visualization Math Utilities
 * 
 * Pure functions for visualization calculations.
 */

import type { StateIndex } from '@/lib/math';
import { STATE_THRESHOLDS } from '@/lib/math';

/**
 * Get state index from evidence (matching engine logic)
 */
export function getStateFromEvidence(evidence: number): StateIndex {
    if (evidence >= STATE_THRESHOLDS.THETA_3) return 3;
    if (evidence >= STATE_THRESHOLDS.THETA_2) return 2;
    if (evidence >= STATE_THRESHOLDS.THETA_1) return 1;
    return 0;
}

/**
 * Calculate blob radius from mass (mass-proportional sizing)
 * Uses sqrt scaling so area is proportional to mass
 */
export function calculateBlobRadius(
    mass: number,
    totalMass: number,
    baseRadius: number
): number {
    if (totalMass === 0 || mass === 0) return baseRadius * 0.5;
    const proportion = mass / totalMass;
    // sqrt scaling so area is proportional to mass
    return baseRadius * Math.sqrt(proportion) * 2;
}

/**
 * Generate organic blob shape with wobble animation
 * @returns Array of points forming the blob perimeter
 */
export function generateBlobPoints(
    centerX: number,
    centerY: number,
    radius: number,
    numPoints: number = 12,
    time: number = 0
): { x: number; y: number }[] {
    const points: { x: number; y: number }[] = [];

    for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        // Add subtle wobble based on time and angle
        const wobble = 1 + Math.sin(angle * 3 + time * 0.001) * 0.03;
        const r = radius * wobble;

        points.push({
            x: centerX + Math.cos(angle) * r,
            y: centerY + Math.sin(angle) * r,
        });
    }

    return points;
}

/**
 * Calculate position within a blob for a node
 */
export function calculateNodePosition(
    blobCenterX: number,
    blobCenterY: number,
    blobRadius: number,
    indexInState: number,
    totalInState: number
): { x: number; y: number } {
    if (totalInState === 0) {
        return { x: blobCenterX, y: blobCenterY };
    }

    if (totalInState === 1) {
        // Single node: center of blob
        return { x: blobCenterX, y: blobCenterY };
    }

    // Multiple nodes: distribute in a circle within the blob
    const angle = (indexInState / totalInState) * Math.PI * 2;
    const distance = blobRadius * 0.5; // Place at 50% of radius

    return {
        x: blobCenterX + Math.cos(angle) * distance,
        y: blobCenterY + Math.sin(angle) * distance,
    };
}

/**
 * Interpolate between two positions for animation
 */
export function lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
}

/**
 * Ease-out cubic for smooth animation
 */
export function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
}

/**
 * Calculate blob centers for 4-state layout
 */
export function calculateBlobCenters(
    containerWidth: number,
    containerHeight: number,
    massVector: [number, number, number, number],
    baseRadius: number
): Record<StateIndex, { x: number; y: number; radius: number }> {
    const totalMass = massVector.reduce((a, b) => a + b, 0);
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;

    // Calculate radii for each state
    const radii = massVector.map((mass) =>
        calculateBlobRadius(mass, totalMass, baseRadius)
    ) as [number, number, number, number];

    // Position blobs in concentric layout (Saturated inner, Latent outer)
    return {
        3: { x: centerX, y: centerY, radius: radii[3] }, // Saturated - center
        2: { x: centerX, y: centerY - radii[3] - radii[2] * 0.5, radius: radii[2] }, // Engaged - above
        1: { x: centerX - radii[2] - radii[1] * 0.5, y: centerY, radius: radii[1] }, // Discovered - left
        0: { x: centerX + radii[1] + radii[0] * 0.5, y: centerY, radius: radii[0] }, // Latent - right
    };
}
