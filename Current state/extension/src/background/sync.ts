/**
 * Sync Manager (The Pulse)
 * 
 * Design Philosophy: "Quiet Batching"
 * - Periodic Heartbeat: Sync every 30 minutes, not on every save
 * - Exponential Backoff: Waits longer after failures
 * - Silent Failures: Failed syncs stay in queue for next beat
 */

import { storage } from '../storage/db';
import { apiClient } from '../api/client';

// ============================================================================
// CONFIGURATION
// ============================================================================

const SYNC_LIMIT = 50;
const MAX_BACKOFF_MS = 60 * 60 * 1000; // 1 hour max

// ============================================================================
// SYNC MANAGER
// ============================================================================

export class SyncManager {
  private isSyncing = false;
  private lastSyncTime: number | null = null;
  private lastError: string | null = null;
  private failCount = 0; // For exponential backoff

  /**
   * The Public "Beat" (Called by Alarm or UI)
   * @param force - Skip backoff check if true
   */
  async beat(force = false): Promise<void> {
    if (this.isSyncing) {
      console.log('[Sync] Skipped: already in progress');
      return;
    }

    // Backoff check (skip if not forced and in penalty box)
    if (!force && this.failCount > 0) {
      const backoffTime = Math.min(1000 * Math.pow(2, this.failCount), MAX_BACKOFF_MS);
      const timeSinceLastAttempt = Date.now() - (this.lastSyncTime || 0);
      
      if (timeSinceLastAttempt < backoffTime) {
        const remainingMs = backoffTime - timeSinceLastAttempt;
        console.log(`[Sync] Backing off. Retry in ${Math.round(remainingMs / 1000)}s`);
        return;
      }
    }

    try {
      this.isSyncing = true;
      const payloads = await storage.getPendingSyncItems(SYNC_LIMIT);

      if (payloads.length === 0) {
        console.log('[Sync] Idle: Queue empty');
        this.failCount = 0; // Reset on clean idle
        return;
      }

      console.log(`[Sync] Processing batch of ${payloads.length} items...`);

      const result = await apiClient.pushBatch(payloads);

      if (result.success) {
        await storage.markSynced(payloads.map(p => p.url));
        this.lastSyncTime = Date.now();
        this.lastError = null;
        this.failCount = 0; // Success resets backoff
        console.log(`[Sync] ✓ Successfully synced ${payloads.length} items`);
      } else {
        throw new Error(result.error || 'Unknown sync error');
      }

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[Sync] Failed:', errorMessage);
      this.lastError = errorMessage;
      this.failCount++;
      this.lastSyncTime = Date.now(); // Mark attempt time for backoff calculation
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Force an immediate sync (for UI trigger)
   */
  async forceSync(): Promise<{ success: boolean; synced?: number; error?: string }> {
    try {
      await this.beat(true);
      const stats = await storage.getStats();
      return { success: true, synced: stats.artifactCount - stats.pendingSyncCount };
    } catch (err) {
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Unknown error' 
      };
    }
  }

  /**
   * UI Status Getter
   */
  getStatus() {
    return {
      active: this.isSyncing,
      lastSync: this.lastSyncTime,
      error: this.lastError,
      backoffLevel: this.failCount,
    };
  }

  /**
   * Reset backoff (for manual intervention)
   */
  resetBackoff(): void {
    this.failCount = 0;
    this.lastError = null;
    console.log('[Sync] Backoff reset');
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const syncManager = new SyncManager();
