/**
 * Visualization Types
 * 
 * Shared type definitions for space blob visualization components.
 */

import type { StateIndex } from '@/lib/types';
import type { Graphics } from 'pixi.js';

/**
 * Represents a subspace node in the visualization
 */
export interface SubspaceNode {
    id: string;
    name: string;
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    stateIndex: StateIndex;
    previousState: StateIndex | null;
    markers: string[];
    graphics?: Graphics;
    isAnimating: boolean;
    animationProgress: number;
}

/**
 * Colors for each state (Pink/Lime/Green/Purple)
 */
export const STATE_COLORS = {
    0: 0xfda4af, // Pink - Latent
    1: 0xd9f99d, // Lime - Discovered
    2: 0x86efac, // Green - Engaged
    3: 0xd8b4fe, // Purple - Saturated
} as const;

/**
 * State names for display
 */
export const STATE_NAMES: Record<StateIndex, string> = {
    0: 'Latent',
    1: 'Discovered',
    2: 'Engaged',
    3: 'Saturated',
};

/**
 * Animation constants
 */
export const ANIMATION_CONSTANTS = {
    TRANSITION_DURATION_MS: 800,
    BASE_RADIUS: 80,
    DOT_RADIUS: 8,
    WOBBLE_SPEED: 0.001,
    WOBBLE_AMPLITUDE: 0.03,
} as const;
