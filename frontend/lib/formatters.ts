/**
 * UI Formatters — Translates technical metrics to user-friendly language
 * Based on MISIR_DASHBOARD_SPECIFICATION.md v1.0 Appendix: Metric Calculation
 * Implements natural language labels per terminology translation table
 */
import type { EngagementLevel } from '@/types/api';
import {
    FOCUS_CONFIDENCE_HIGH_THRESHOLD,
    FOCUS_CONFIDENCE_MEDIUM_THRESHOLD,
} from '@/lib/focus-thresholds';

/**
 * Converts confidence score (0-1) to natural language focus label
 * @param confidence - Float 0-1 representing certainty/focus
 * @returns "Very strong" | "Strong" | "Moderate" | "Developing" | "Just starting"
 */
export function getFocusLabel(confidence: number): string {
    if (confidence >= 0.75) return 'Very strong';
    if (confidence >= FOCUS_CONFIDENCE_HIGH_THRESHOLD) return 'Strong';
    if (confidence >= FOCUS_CONFIDENCE_MEDIUM_THRESHOLD) return 'Moderate';
    if (confidence >= 0.2) return 'Developing';
    return 'Just starting';
}

/**
 * Maps confidence score to visual dot count (0-8)
 * Used for Focus gauge visualizations
 * @param confidence - Float 0-1
 * @returns Integer 0-8
 */
export function getFocusDots(confidence: number): number {
    return Math.round(confidence * 8); // 0-8 dots
}

/**
 * Converts assignment margin (0-1) to natural language fit label
 * @param margin - Float 0-1 representing how well item fits topic
 * @returns "Clear match" | "Somewhat related" | "Doesn't fit well"
 */
export function getFitLabel(margin: number): string {
    if (margin >= 0.5) return 'Clear match';
    if (margin >= 0.3) return 'Somewhat related';
    return "Doesn't fit well";
}

/**
 * Returns semantic color name for fit visualization
 * @param margin - Float 0-1
 * @returns 'green' | 'yellow' | 'red'
 */
export function getFitColor(margin: number): 'green' | 'yellow' | 'red' {
    if (margin >= 0.5) return 'green';
    if (margin >= 0.3) return 'yellow';
    return 'red';
}

/**
 * Converts technical engagement level to natural language reading depth
 * Implements terminology translation: Latent→Skimmed, Discovered→Read, etc.
 * @param level - EngagementLevel enum
 * @returns "Skimmed" | "Read" | "Studied" | "Deep dive"
 */
export function getReadingDepth(level: EngagementLevel): string {
    const map: Record<EngagementLevel, string> = {
        latent: 'Skimmed',
        discovered: 'Read',
        engaged: 'Studied',
        saturated: 'Deep dive',
    };
    return map[level] || 'Unknown';
}

/**
 * Derives space status label from aggregated metrics
 * Used for Space Cards on Home / Command Center
 * Priority order: drift > avg_margin > confidence
 * @param metrics - Object with confidence, drift, avg_margin
 * @returns Status label with emoji
 */
export function getSpaceStatus(metrics: {
    confidence: number;
    drift?: number;
    avg_margin?: number;
}): string {
    const { confidence, drift, avg_margin } = metrics;

    // High drift = focus shifting
    if (drift !== undefined && drift > 0.3) {
        return 'Focus shifting 🔄';
    }

    // Low margin = exploring new territory
    if (avg_margin !== undefined && avg_margin < 0.3) {
        return 'Exploring new territory ⚠️';
    }

    // High confidence + low drift = stable
    if (confidence > FOCUS_CONFIDENCE_HIGH_THRESHOLD && (drift === undefined || drift < 0.2)) {
        return 'Looking good ✅';
    }

    // Default
    return 'Building understanding 📊';
}

/**
 * Truncates text to max length with ellipsis
 * @param text - Input string
 * @param maxLen - Max character count (default 60)
 * @returns Truncated string with "..." if needed
 */
export function truncateText(text: string, maxLen: number = 60): string {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen - 3) + '...';
}

/**
 * Formats percentage as whole number with % sign
 * @param value - Float 0-1
 * @returns "75%" | "0%" | "100%"
 */
export function formatPercent(value: number): string {
    return `${Math.round(value * 100)}%`;
}

/**
 * Formats large numbers with K/M suffix
 * @param num - Integer count
 * @returns "1.2K" | "3M" | "42"
 */
export function formatCount(num: number): string {
    if (num >= 1_000_000) {
        return `${(num / 1_000_000).toFixed(1)}M`;
    }
    if (num >= 1_000) {
        return `${(num / 1_000).toFixed(1)}K`;
    }
    return num.toString();
}

/**
 * Formats a date/time value to a concise relative string (e.g. "2h ago", "3d ago").
 * Accepts ISO strings or Date instances and returns "Never" for missing/invalid input.
 */
export function formatRelativeTime(input?: string | Date | null): string {
    if (!input) return 'Never';

    const date = typeof input === 'string' ? new Date(input) : input;
    if (Number.isNaN(date.getTime())) return 'Never';

    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    if (diffInSeconds < 2419200) return `${Math.floor(diffInSeconds / 604800)}w ago`;

    return date.toLocaleDateString();
}
