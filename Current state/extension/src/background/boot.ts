/**
 * Bootloader (The Brain Transplant)
 * 
 * Initializes the extension on install/update/startup.
 * Downloads the user's "Mental Map" (markers + centroids) from backend.
 * 
 * The Semantic Download ensures the sensor always has
 * the latest target patterns without heavy AI models.
 */

import { storage } from '../storage/db';
import { apiClient } from '../api/client';
import { syncManager } from './sync';

// ============================================================================
// CONFIGURATION
// ============================================================================

const ALARM_NAME = 'MISIR_PULSE';
const MAP_STALE_MS = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the extension.
 * Called on install, update, or service worker startup.
 * 
 * @param reason Why we're initializing
 */
export async function initializeExtension(
  reason: 'install' | 'update' | 'startup'
): Promise<void> {
  console.log(`[Boot] Waking up Misir Sensor (${reason})...`);

  // 1. Ensure storage is ready
  await storage.init();

  // 2. Ensure the Pulse is beating
  await ensurePulseAlarm();

  // 3. Download semantic map if needed
  await syncUserMap(reason === 'install');

  console.log('[Boot] Misir Sensor ready');
}

// ============================================================================
// PULSE ALARM
// ============================================================================

/**
 * Ensure the sync alarm exists.
 */
async function ensurePulseAlarm(): Promise<void> {
  return new Promise((resolve) => {
    chrome.alarms.get(ALARM_NAME, (alarm) => {
      if (!alarm) {
        chrome.alarms.create(ALARM_NAME, { periodInMinutes: 30 });
        console.log('[Boot] Pulse alarm created (30 min interval)');
      }
      resolve();
    });
  });
}

// ============================================================================
// USER MAP SYNC
// ============================================================================

/**
 * Download the user's mental map (markers + centroids).
 * Only fetches if map is missing or stale.
 * 
 * @param force Force download even if cached
 */
async function syncUserMap(force = false): Promise<void> {
  try {
    const localMap = await storage.getUserMap();
    
    // Check if map exists and is fresh
    const isStale = !localMap || (Date.now() - localMap.lastUpdated > MAP_STALE_MS);

    if (!force && !isStale) {
      console.log(`[Boot] Map cached: ${localMap?.centroids.length || 0} centroids`);
      return;
    }

    console.log('[Boot] Downloading Semantic Map...');
    const newMap = await apiClient.fetchUserMap();

    if (newMap) {
      await storage.saveUserMap(newMap);
      console.log(`[Boot] Map loaded: ${newMap.centroids.length} centroids, ${newMap.markers.length} markers`);
    } else {
      console.log('[Boot] No map from server (user not logged in?)');
    }

  } catch (err) {
    console.warn('[Boot] Failed to sync map. Using cached version.', err);
  }
}

// ============================================================================
// MANUAL REFRESH
// ============================================================================

/**
 * Force refresh the user map (called from popup or on login).
 */
export async function refreshUserMap(): Promise<boolean> {
  try {
    const newMap = await apiClient.fetchUserMap();
    
    if (newMap) {
      await storage.saveUserMap(newMap);
      console.log(`[Boot] Map refreshed: ${newMap.centroids.length} centroids`);
      return true;
    }
    
    return false;
  } catch (err) {
    console.error('[Boot] Map refresh failed:', err);
    return false;
  }
}

// ============================================================================
// FULL INITIALIZATION (for background/index.ts)
// ============================================================================

/**
 * Set up all Chrome event listeners for initialization.
 */
export function setupLifecycleListeners(): void {
  // On install or update
  chrome.runtime.onInstalled.addListener((details) => {
    const reason = details.reason as 'install' | 'update';
    if (reason === 'install' || reason === 'update') {
      initializeExtension(reason);
    }
  });

  // On startup (browser launch)
  chrome.runtime.onStartup.addListener(() => {
    initializeExtension('startup');
  });

  // On alarm (the pulse)
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
      console.log('[Pulse] Triggered');
      syncManager.beat();
      
      // Also check if map needs refresh
      syncUserMap(false);
    }
  });
}
