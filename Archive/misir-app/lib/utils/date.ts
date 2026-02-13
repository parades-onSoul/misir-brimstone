/**
 * Date/Time Utilities
 * 
 * Consolidated helper functions for date formatting and relative time.
 */

/**
 * Formats a date string to a human-readable format.
 * Default: "Jan 10, 2026"
 */
export function formatDate(
    dateString: string,
    options: Intl.DateTimeFormatOptions = {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }
): string {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', options);
    } catch {
        return dateString;
    }
}

/**
 * Formats a date to include time: "Jan 10, 2026, 2:30 PM"
 */
export function formatDateTime(dateString: string): string {
    return formatDate(dateString, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Formats a date to short format: "Jan 10"
 */
export function formatShortDate(dateString: string): string {
    return formatDate(dateString, {
        month: 'short',
        day: 'numeric',
    });
}

/**
 * Returns relative time string: "just now", "5m ago", "2h ago", "3d ago"
 */
export function getTimeAgo(dateString: string): string {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return formatShortDate(dateString);
}

/**
 * Checks if a date is today.
 */
export function isToday(dateString: string): boolean {
    const date = new Date(dateString);
    const today = new Date();
    return date.toDateString() === today.toDateString();
}

/**
 * Checks if a date is yesterday.
 */
export function isYesterday(dateString: string): boolean {
    const date = new Date(dateString);
    const yesterday = new Date(Date.now() - 86400000);
    return date.toDateString() === yesterday.toDateString();
}

/**
 * Gets a human-readable date label: "Today", "Yesterday", or the formatted date.
 */
export function getDateLabel(dateString: string): string {
    if (isToday(dateString)) return 'Today';
    if (isYesterday(dateString)) return 'Yesterday';
    return formatShortDate(dateString);
}

/**
 * Formats time only: "2:30 PM"
 */
export function formatTime(dateString: string): string {
    try {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return '';
    }
}
