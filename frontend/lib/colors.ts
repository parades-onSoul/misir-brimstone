/**
 * Color Constants — Semantic color system for Misir Dashboard
 * Based on MISIR_DASHBOARD_SPECIFICATION.md v1.0 Appendix: Color Palette
 * All colors use Tailwind CSS utility classes matching spec hex values
 */

/**
 * Space auto-assignment colors (8 total)
 * Applied sequentially when user creates spaces (loops after 8)
 * Order: Blue, Green, Amber, Red, Purple, Pink, Cyan, Orange
 */
export const SPACE_COLORS = [
    {
        name: 'Blue',
        hex: '#3B82F6',
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        ring: 'ring-blue-500',
        dot: 'bg-blue-500',
    },
    {
        name: 'Green',
        hex: '#10B981',
        bg: 'bg-green-50',
        text: 'text-green-700',
        border: 'border-green-200',
        ring: 'ring-green-500',
        dot: 'bg-green-500',
    },
    {
        name: 'Amber',
        hex: '#F59E0B',
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        ring: 'ring-amber-500',
        dot: 'bg-amber-500',
    },
    {
        name: 'Red',
        hex: '#EF4444',
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        ring: 'ring-red-500',
        dot: 'bg-red-500',
    },
    {
        name: 'Purple',
        hex: '#8B5CF6',
        bg: 'bg-purple-50',
        text: 'text-purple-700',
        border: 'border-purple-200',
        ring: 'ring-purple-500',
        dot: 'bg-purple-500',
    },
    {
        name: 'Pink',
        hex: '#EC4899',
        bg: 'bg-pink-50',
        text: 'text-pink-700',
        border: 'border-pink-200',
        ring: 'ring-pink-500',
        dot: 'bg-pink-500',
    },
    {
        name: 'Cyan',
        hex: '#06B6D4',
        bg: 'bg-cyan-50',
        text: 'text-cyan-700',
        border: 'border-cyan-200',
        ring: 'ring-cyan-500',
        dot: 'bg-cyan-500',
    },
    {
        name: 'Orange',
        hex: '#F97316',
        bg: 'bg-orange-50',
        text: 'text-orange-700',
        border: 'border-orange-200',
        ring: 'ring-orange-500',
        dot: 'bg-orange-500',
    },
] as const;

/**
 * Focus level colors (used for confidence/focus indicators)
 */
export const FOCUS_COLORS = {
    high: {
        bg: 'bg-green-50',
        text: 'text-green-700',
        border: 'border-green-200',
        dot: 'bg-green-500',
    },
    medium: {
        bg: 'bg-yellow-50',
        text: 'text-yellow-700',
        border: 'border-yellow-200',
        dot: 'bg-yellow-500',
    },
    low: {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        dot: 'bg-red-500',
    },
} as const;

/**
 * Fit quality colors (used for assignment margin indicators)
 */
export const FIT_COLORS = {
    clear: {
        bg: 'bg-green-50',
        text: 'text-green-700',
        border: 'border-green-200',
        badge: 'bg-green-100 text-green-800',
    },
    moderate: {
        bg: 'bg-yellow-50',
        text: 'text-yellow-700',
        border: 'border-yellow-200',
        badge: 'bg-yellow-100 text-yellow-800',
    },
    weak: {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        badge: 'bg-red-100 text-red-800',
    },
} as const;

/**
 * Alert type colors (for banner, toast, inline alerts)
 */
export const ALERT_COLORS = {
    info: {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        icon: 'text-blue-500',
    },
    warning: {
        bg: 'bg-amber-50',
        text: 'text-amber-800',
        border: 'border-amber-200',
        icon: 'text-amber-500',
    },
    success: {
        bg: 'bg-green-50',
        text: 'text-green-700',
        border: 'border-green-200',
        icon: 'text-green-500',
    },
    danger: {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        icon: 'text-red-500',
    },
} as const;

/**
 * Gets space color by index (for auto-assignment)
 * @param index - Space creation order (0-based)
 * @returns Color scheme object
 */
export function getSpaceColor(index: number) {
    return SPACE_COLORS[index % SPACE_COLORS.length];
}

/**
 * Gets focus color by confidence score
 * @param confidence - Float 0-1
 * @returns Color scheme object
 */
export function getFocusColor(confidence: number) {
    if (confidence >= 0.7) return FOCUS_COLORS.high;
    if (confidence >= 0.4) return FOCUS_COLORS.medium;
    return FOCUS_COLORS.low;
}

/**
 * Gets fit color by assignment margin
 * Threshold: >= 0.5 (clear), >= 0.3 (moderate), < 0.3 (weak)
 * @param margin - Float 0-1
 * @returns Color scheme object
 */
export function getFitColorScheme(margin: number) {
    if (margin >= 0.5) return FIT_COLORS.clear;
    if (margin >= 0.3) return FIT_COLORS.moderate;
    return FIT_COLORS.weak;
}

/**
 * Chart colors for activity visualization (max 5 spaces + "Other")
 * Uses exact hex values from spec: Blue, Green, Amber, Red, Purple + Gray
 * Spec: #3B82F6, #10B981, #F59E0B, #EF4444, #8B5CF6
 */
export const CHART_COLORS = [
    '#3B82F6', // blue-500
    '#10B981', // emerald-500 (spec: Green)
    '#F59E0B', // amber-500
    '#EF4444', // red-500
    '#8B5CF6', // violet-500 (spec: Purple)
    '#6B7280', // gray-500 (for "Other")
] as const;

/**
 * Engagement level colors (for reading depth indicators)
 */
export const ENGAGEMENT_COLORS = {
    latent: {
        bg: 'bg-gray-50',
        text: 'text-gray-600',
        border: 'border-gray-200',
    },
    discovered: {
        bg: 'bg-blue-50',
        text: 'text-blue-600',
        border: 'border-blue-200',
    },
    engaged: {
        bg: 'bg-indigo-50',
        text: 'text-indigo-600',
        border: 'border-indigo-200',
    },
    saturated: {
        bg: 'bg-purple-50',
        text: 'text-purple-600',
        border: 'border-purple-200',
    },
} as const;
