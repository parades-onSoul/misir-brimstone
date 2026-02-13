/**
 * Stale Multiplier Calculation — Pure formulas
 * 
 * Activity-aware decay multipliers.
 */

import { STALE_MULTIPLIERS, ACTIVITY_THRESHOLDS } from './config';
import type { DecayState } from './evidence';

/**
 * Calculate stale multiplier based on days since last activity
 * 
 * - Active (< 3 days): 1.0x (normal decay)
 * - Stale (3-14 days): 0.5x (reduced decay - benefit of doubt)
 * - Inactive (14+ days): 1.0x (normal decay resumes)
 * - Saturated + stale: 0.25x (foundational knowledge persists)
 * 
 * @param state - Current decay state
 * @param daysSinceActivity - Days since last artifact
 * @param isPaused - Whether decay is paused entirely
 * @returns Multiplier for effective decay rate
 */
export function calculateStaleMultiplier(
    state: DecayState,
    daysSinceActivity: number,
    isPaused: boolean = false
): number {
    // If paused, no decay
    if (isPaused) {
        return STALE_MULTIPLIERS.paused;
    }

    // Active: normal decay
    if (daysSinceActivity < ACTIVITY_THRESHOLDS.staleAfterDays) {
        return STALE_MULTIPLIERS.active;
    }

    // Stale window (3-14 days) - reduce decay to give benefit of doubt
    if (daysSinceActivity < ACTIVITY_THRESHOLDS.inactiveAfterDays) {
        // Saturated topics get extra protection
        if (state === 'saturated') {
            return STALE_MULTIPLIERS.saturatedStale;
        }
        return STALE_MULTIPLIERS.stale;
    }

    // Very inactive (14+ days) - resume normal decay
    return STALE_MULTIPLIERS.inactive;
}
