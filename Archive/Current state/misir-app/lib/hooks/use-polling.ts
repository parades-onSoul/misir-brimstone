/**
 * usePolling Hook
 * 
 * Provides automatic polling for data freshness.
 * Configurable interval with pause on window blur.
 */

import { useEffect, useRef, useCallback, useState } from 'react';

export interface UsePollingOptions {
    /** Polling interval in milliseconds */
    interval?: number;
    /** Whether polling is enabled */
    enabled?: boolean;
    /** Pause polling when window loses focus */
    pauseOnBlur?: boolean;
    /** Callback when poll fails */
    onError?: (error: Error) => void;
}

export interface UsePollingResult {
    /** Force an immediate poll */
    refresh: () => Promise<void>;
    /** Whether currently polling */
    isPolling: boolean;
    /** Last successful poll timestamp */
    lastUpdated: Date | null;
    /** Time until next poll in ms */
    timeToNextPoll: number;
}

/**
 * Hook for polling data at regular intervals
 * 
 * @param fetchFn - Async function to call on each poll
 * @param options - Polling configuration
 * @returns Polling controls and status
 * 
 * @example
 * const { refresh, lastUpdated } = usePolling(
 *   () => fetchSpaces(),
 *   { interval: 5000, enabled: true }
 * );
 */
export function usePolling<T>(
    fetchFn: () => Promise<T>,
    options: UsePollingOptions = {}
): UsePollingResult {
    const {
        interval = 10000, // 10 seconds default
        enabled = true,
        pauseOnBlur = true,
        onError,
    } = options;

    const [isPolling, setIsPolling] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [timeToNextPoll, setTimeToNextPoll] = useState(interval);

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const countdownRef = useRef<NodeJS.Timeout | null>(null);
    const isPausedRef = useRef(false);
    const fetchFnRef = useRef(fetchFn);

    // Keep fetchFn ref updated
    useEffect(() => {
        fetchFnRef.current = fetchFn;
    }, [fetchFn]);

    const poll = useCallback(async () => {
        if (isPausedRef.current) return;

        setIsPolling(true);
        try {
            await fetchFnRef.current();
            setLastUpdated(new Date());
        } catch (error) {
            onError?.(error instanceof Error ? error : new Error(String(error)));
        } finally {
            setIsPolling(false);
        }
    }, [onError]);

    const refresh = useCallback(async () => {
        await poll();
        // Reset countdown after manual refresh
        setTimeToNextPoll(interval);
    }, [poll, interval]);

    // Set up polling interval
    useEffect(() => {
        if (!enabled) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        // Start countdown timer
        countdownRef.current = setInterval(() => {
            setTimeToNextPoll(prev => Math.max(0, prev - 1000));
        }, 1000);

        // Start polling interval
        intervalRef.current = setInterval(() => {
            poll();
            setTimeToNextPoll(interval);
        }, interval);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (countdownRef.current) clearInterval(countdownRef.current);
        };
    }, [enabled, interval, poll]);

    // Handle window focus/blur
    useEffect(() => {
        if (!pauseOnBlur) return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                isPausedRef.current = true;
            } else {
                isPausedRef.current = false;
                // Poll immediately when returning to tab
                poll();
                setTimeToNextPoll(interval);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [pauseOnBlur, poll, interval]);

    return {
        refresh,
        isPolling,
        lastUpdated,
        timeToNextPoll,
    };
}

export default usePolling;
