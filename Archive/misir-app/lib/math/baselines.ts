/**
 * Baseline Math — Pure WMA formulas
 * 
 * Implements weighted moving average calculations for baseline computation.
 * All functions are pure - no DB calls.
 */

import { BASELINE_CONFIG } from './config';

// ============================================================================
// WMA Weight Calculation
// ============================================================================

/**
 * Calculate weight for WMA at a given index
 * 
 * w_i = e^(-α × (n - 1 - i))
 * 
 * Where:
 * - α = decay factor (default 0.1)
 * - n = total number of snapshots
 * - i = index (0 = oldest, n-1 = newest)
 * 
 * Recent snapshots get higher weights.
 * 
 * @param index - Snapshot index (0 = oldest)
 * @param total - Total number of snapshots
 * @param alpha - Decay factor (default from BASELINE_CONFIG)
 * @returns Weight value
 */
export function calculateWMAWeight(
    index: number,
    total: number,
    alpha: number = BASELINE_CONFIG.alpha
): number {
    return Math.exp(-alpha * (total - 1 - index));
}

/**
 * Generate all weights for a WMA calculation
 * 
 * @param count - Number of values
 * @param alpha - Decay factor
 * @returns Array of weights (sum to be normalized later)
 */
export function generateWMAWeights(
    count: number,
    alpha: number = BASELINE_CONFIG.alpha
): number[] {
    const weights: number[] = [];

    for (let i = 0; i < count; i++) {
        weights.push(calculateWMAWeight(i, count, alpha));
    }

    return weights;
}

// ============================================================================
// WMA Computation
// ============================================================================

/**
 * Compute weighted moving average from array of values
 * 
 * WMA = Σ(w_i × v_i) / Σ(w_i)
 * 
 * @param values - Array of values (oldest first)
 * @param alpha - Optional decay factor
 * @returns Weighted moving average
 */
export function computeWMA(
    values: number[],
    alpha: number = BASELINE_CONFIG.alpha
): number {
    if (values.length === 0) return 0;

    const weights = generateWMAWeights(values.length, alpha);

    let weightedSum = 0;
    let weightSum = 0;

    for (let i = 0; i < values.length; i++) {
        weightedSum += weights[i] * values[i];
        weightSum += weights[i];
    }

    return weightSum > 0 ? weightedSum / weightSum : 0;
}

/**
 * Compute weighted moving average for state vectors
 * 
 * Averages each component of the state vector separately.
 * 
 * @param vectors - Array of state vectors (oldest first)
 * @param alpha - Optional decay factor
 * @returns Averaged state vector
 */
export function computeStateVectorWMA(
    vectors: [number, number, number, number][],
    alpha: number = BASELINE_CONFIG.alpha
): [number, number, number, number] {
    if (vectors.length === 0) return [0, 0, 0, 0];

    const weights = generateWMAWeights(vectors.length, alpha);

    const result: [number, number, number, number] = [0, 0, 0, 0];
    let weightSum = 0;

    for (let i = 0; i < vectors.length; i++) {
        for (let j = 0; j < 4; j++) {
            result[j] += weights[i] * vectors[i][j];
        }
        weightSum += weights[i];
    }

    if (weightSum > 0) {
        for (let j = 0; j < 4; j++) {
            result[j] /= weightSum;
        }
    }

    return result;
}
