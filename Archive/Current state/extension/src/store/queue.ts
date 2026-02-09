/**
 * Sync Queue
 * 
 * Manages batched syncing of signals to backend.
 */

import { getUnsyncedSignals, markSynced } from './local_db';
import { syncSignals } from '../sync/backend';

// ============================================================================
// QUEUE STATE
// ============================================================================

let isSyncing = false;
let syncTimer: ReturnType<typeof setTimeout> | null = null;

const SYNC_INTERVAL_MS = 30000;  // 30 seconds
const BATCH_SIZE = 10;

// ============================================================================
// QUEUE OPERATIONS
// ============================================================================

/**
 * Initialize periodic sync
 */
export function initSyncQueue(): void {
  // Initial sync after short delay
  scheduleSync(5000);
  
  // Set up periodic sync
  chrome.alarms.create('sync_signals', { periodInMinutes: 1 });
  
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'sync_signals') {
      processQueue();
    }
  });
  
  console.log('[Queue] Sync queue initialized');
}

/**
 * Schedule a sync
 */
export function scheduleSync(delayMs = SYNC_INTERVAL_MS): void {
  if (syncTimer) {
    clearTimeout(syncTimer);
  }
  
  syncTimer = setTimeout(() => {
    processQueue();
  }, delayMs);
}

/**
 * Process the sync queue
 */
export async function processQueue(): Promise<{ synced: number; failed: number }> {
  if (isSyncing) {
    return { synced: 0, failed: 0 };
  }
  
  isSyncing = true;
  let synced = 0;
  let failed = 0;
  
  try {
    const unsynced = await getUnsyncedSignals();
    
    if (unsynced.length === 0) {
      return { synced: 0, failed: 0 };
    }
    
    console.log(`[Queue] Processing ${unsynced.length} unsynced signals`);
    
    // Process in batches
    for (let i = 0; i < unsynced.length; i += BATCH_SIZE) {
      const batch = unsynced.slice(i, i + BATCH_SIZE);
      
      const result = await syncSignals(batch);
      
      if (result.success && result.syncedIds) {
        await markSynced(result.syncedIds);
        synced += result.syncedIds.length;
      } else {
        failed += batch.length;
      }
    }
    
    console.log(`[Queue] Synced: ${synced}, Failed: ${failed}`);
    
  } catch (error) {
    console.error('[Queue] Sync error:', error);
    failed = -1;  // Indicate error
  } finally {
    isSyncing = false;
  }
  
  return { synced, failed };
}

/**
 * Force immediate sync
 */
export async function forceSync(): Promise<{ synced: number; failed: number }> {
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  
  return processQueue();
}

/**
 * Get queue status
 */
export function getQueueStatus(): {
  isSyncing: boolean;
  nextSyncIn: number | null;
} {
  return {
    isSyncing,
    nextSyncIn: syncTimer ? SYNC_INTERVAL_MS : null,
  };
}
