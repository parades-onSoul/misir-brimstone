/**
 * useSensor Hook
 * 
 * Provides reactive state for the popup UI.
 * Polls the background for current status and provides actions.
 */

import { useState, useEffect, useCallback } from 'react';
import type { MatchResult } from '../classify/types';

// ============================================================================
// TYPES
// ============================================================================

export interface SyncState {
  active: boolean;
  lastSync: number | null;
  error: string | null;
  backoffLevel: number;
}

export interface SensorStats {
  dailyCount: number;
  totalCount: number;
  pendingSync: number;
}

export interface SessionStats {
  sessionId: string | null;
  startedAt: number | null;
  durationMs: number;
  artifactCount: number;
  tabCount: number;
}

export interface CurrentContext {
  url: string;
  title: string;
  domain: string;
  dwellTimeMs: number;
}

export interface SensorState {
  status: 'idle' | 'analyzing' | 'matched' | 'noise' | 'error';
  context?: CurrentContext;
  match?: MatchResult;
  stats?: SensorStats;
  session?: SessionStats;
  syncState?: SyncState;
  mapLoaded: boolean;
  spaceCount: number;
  markerCount: number;
}

// ============================================================================
// HOOK
// ============================================================================

export function useSensor() {
  const [state, setState] = useState<SensorState>({
    status: 'idle',
    mapLoaded: false,
    spaceCount: 0,
    markerCount: 0,
  });
  const [loading, setLoading] = useState(true);

  // Fetch current state from background
  const fetchStatus = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'getPopupState' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[useSensor] Error:', chrome.runtime.lastError);
        setState(prev => ({ ...prev, status: 'error' }));
        return;
      }
      
      if (response) {
        setState(response);
        setLoading(false);
      }
    });
  }, []);

  // Poll for updates (every 5 seconds to reduce noise)
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Force sync action
  const forceSync = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'forceSync' }, (response) => {
      console.log('[useSensor] forceSync response:', response);
      if (response) {
        setState(prev => ({
          ...prev,
          syncState: { ...prev.syncState, active: true } as SyncState,
        }));
        // Refresh after a bit
        setTimeout(fetchStatus, 1000);
      }
    });
  }, [fetchStatus]);

  // Push pending artifacts to backend DB
  const pushToBackend = useCallback((): Promise<{ success: boolean; synced?: number; error?: string }> => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'forceSync' }, (response) => {
        console.log('[useSensor] pushToBackend response:', response);
        if (chrome.runtime.lastError) {
          console.error('[useSensor] Runtime error:', chrome.runtime.lastError);
          resolve({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        // Response from background is { success, synced_count, failed_urls, errors }
        // We return it as-is for the popup to handle
        if (response) {
          resolve({ 
            success: response.success ?? false, 
            synced: response.synced_count ?? 0,
            error: response.errors?.[0] 
          });
        } else {
          resolve({ success: false, error: 'No response from background' });
        }
        fetchStatus();
      });
    });
  }, [fetchStatus]);

  // Refresh user map
  const refreshMap = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'refreshUserMap' }, (response) => {
      if (response?.success) {
        fetchStatus();
      }
    });
  }, [fetchStatus]);

  // Manual capture current tab
  const captureNow = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'captureCurrentTab' }, (response) => {
      if (response?.success) {
        fetchStatus();
      }
    });
  }, [fetchStatus]);

  return {
    state,
    loading,
    forceSync,
    pushToBackend,
    refreshMap,
    captureNow,
    refresh: fetchStatus,
  };
}
