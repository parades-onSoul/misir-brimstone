'use client';

/**
 * LiveIndicator Component
 * 
 * Shows real-time update status with last refresh time and pulse animation.
 */

import { useState, useEffect } from 'react';

interface LiveIndicatorProps {
    /** Whether currently polling/fetching */
    isPolling: boolean;
    /** Last successful update timestamp */
    lastUpdated: Date | null;
    /** Time until next poll in ms */
    timeToNextPoll?: number;
    /** Manual refresh callback */
    onRefresh?: () => void;
    /** Show compact version */
    compact?: boolean;
}

export function LiveIndicator({
    isPolling,
    lastUpdated,
    timeToNextPoll,
    onRefresh,
    compact = false,
}: LiveIndicatorProps) {
    const [timeAgo, setTimeAgo] = useState<string>('');

    useEffect(() => {
        if (!lastUpdated) return;

        const updateTimeAgo = () => {
            const seconds = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);

            if (seconds < 5) {
                setTimeAgo('just now');
            } else if (seconds < 60) {
                setTimeAgo(`${seconds}s ago`);
            } else if (seconds < 3600) {
                setTimeAgo(`${Math.floor(seconds / 60)}m ago`);
            } else {
                setTimeAgo(`${Math.floor(seconds / 3600)}h ago`);
            }
        };

        updateTimeAgo();
        const interval = setInterval(updateTimeAgo, 5000);

        return () => clearInterval(interval);
    }, [lastUpdated]);

    if (compact) {
        return (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                    className={`h-2 w-2 rounded-full ${isPolling
                            ? 'bg-green-500 animate-pulse'
                            : 'bg-green-400'
                        }`}
                />
                <span>{isPolling ? 'Syncing...' : timeAgo || 'Live'}</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
            {/* Live indicator dot */}
            <span
                className={`h-2 w-2 rounded-full transition-colors ${isPolling
                        ? 'bg-green-500 animate-pulse'
                        : 'bg-green-400'
                    }`}
            />

            {/* Status text */}
            <span className="text-xs text-muted-foreground">
                {isPolling ? (
                    'Updating...'
                ) : lastUpdated ? (
                    `Updated ${timeAgo}`
                ) : (
                    'Live'
                )}
            </span>

            {/* Next update countdown */}
            {timeToNextPoll !== undefined && !isPolling && (
                <span className="text-xs text-muted-foreground/50">
                    · {Math.ceil(timeToNextPoll / 1000)}s
                </span>
            )}

            {/* Manual refresh button */}
            {onRefresh && (
                <button
                    onClick={onRefresh}
                    disabled={isPolling}
                    className="ml-1 p-1 hover:bg-muted rounded transition-colors disabled:opacity-50"
                    title="Refresh now"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={isPolling ? 'animate-spin' : ''}
                    >
                        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                    </svg>
                </button>
            )}
        </div>
    );
}

export default LiveIndicator;
