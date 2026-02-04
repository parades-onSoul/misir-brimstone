/**
 * Local-First Storage (The Vault + Outbox)
 * 
 * Strategy:
 * - Resilience: Never lose data if network is down
 * - Privacy: Can run local summaries without cloud
 * - Batching: Sync queue prevents 50 API calls for 50 tabs
 * 
 * Two Stores:
 * 1. artifacts - Permanent record of what passed the Sieve
 * 2. sync_queue - Lightweight outbox of items awaiting push
 */

import type { ArtifactPayload, UserMap } from '../classify/types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DB_NAME = 'MisirStorage';
const DB_VERSION = 1;

const STORES = {
  ARTIFACTS: 'artifacts',
  SYNC_QUEUE: 'sync_queue',
} as const;

// ============================================================================
// TYPES
// ============================================================================

export interface QueueItem {
  id?: number;          // Auto-increment key
  url: string;          // Reference to artifact
  added_at: number;     // Timestamp for ordering
  attempts: number;     // Retry count
  last_error?: string;  // Last sync error
}

export interface StorageStats {
  artifactCount: number;
  pendingSyncCount: number;
  oldestPending: number | null;  // Timestamp
}

// ============================================================================
// LOCAL STORE CLASS
// ============================================================================

export class LocalStore {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  // --------------------------------------------------------------------------
  // INITIALIZATION
  // --------------------------------------------------------------------------

  /**
   * Initialize the database with schema.
   * Safe to call multiple times (idempotent).
   */
  async init(): Promise<void> {
    // Prevent multiple parallel inits
    if (this.initPromise) return this.initPromise;
    if (this.db) return;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        this.initPromise = null;
        reject(new Error(`Failed to open database: ${request.error?.message}`));
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store 1: Artifacts (The "Vault")
        // KeyPath: url (unique per page)
        if (!db.objectStoreNames.contains(STORES.ARTIFACTS)) {
          const artifactStore = db.createObjectStore(STORES.ARTIFACTS, { keyPath: 'url' });
          // Index for queries by domain, time, etc.
          artifactStore.createIndex('domain', 'domain', { unique: false });
          artifactStore.createIndex('captured_at', 'captured_at', { unique: false });
          artifactStore.createIndex('content_type', 'content_type', { unique: false });
        }

        // Store 2: Sync Queue (The "Outbox")
        // KeyPath: auto-increment for FIFO ordering
        if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
          const queueStore = db.createObjectStore(STORES.SYNC_QUEUE, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          queueStore.createIndex('url', 'url', { unique: true }); // No duplicates in queue
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        
        // Handle unexpected closes
        this.db.onclose = () => {
          this.db = null;
          this.initPromise = null;
        };
        
        resolve();
      };
    });

    return this.initPromise;
  }

  /**
   * Ensure DB is ready before any operation
   */
  private async ensureDb(): Promise<IDBDatabase> {
    if (!this.db) await this.init();
    return this.db!;
  }

  // --------------------------------------------------------------------------
  // SAVE OPERATIONS
  // --------------------------------------------------------------------------

  /**
   * Save artifact and queue for sync (atomic).
   * If artifact with same URL exists, it will be updated.
   */
  async saveArtifact(payload: ArtifactPayload): Promise<void> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [STORES.ARTIFACTS, STORES.SYNC_QUEUE], 
        'readwrite'
      );

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => {
        console.log(`[Storage] Saved artifact: ${payload.url}`);
        resolve();
      };

      const artifactStore = transaction.objectStore(STORES.ARTIFACTS);
      const queueStore = transaction.objectStore(STORES.SYNC_QUEUE);

      // A. Save/Update the artifact
      artifactStore.put(payload);

      // B. Add to sync queue (if not already there)
      const queueItem: Omit<QueueItem, 'id'> = {
        url: payload.url,
        added_at: Date.now(),
        attempts: 0,
      };

      // Use index to check if already queued
      const urlIndex = queueStore.index('url');
      const checkRequest = urlIndex.get(payload.url);
      
      checkRequest.onsuccess = () => {
        if (!checkRequest.result) {
          // Not in queue, add it
          queueStore.add(queueItem);
        }
        // If already queued, skip (don't create duplicates)
      };
    });
  }

  // --------------------------------------------------------------------------
  // SYNC QUEUE OPERATIONS
  // --------------------------------------------------------------------------

  /**
   * Get pending sync items (oldest first, for FIFO).
   * Returns full artifact payloads hydrated from the vault.
   */
  async getPendingSyncItems(limit: number = 50): Promise<ArtifactPayload[]> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [STORES.SYNC_QUEUE, STORES.ARTIFACTS], 
        'readonly'
      );

      const queueStore = transaction.objectStore(STORES.SYNC_QUEUE);
      const artifactStore = transaction.objectStore(STORES.ARTIFACTS);

      const results: ArtifactPayload[] = [];
      let count = 0;

      // Open cursor for FIFO order (auto-increment = insertion order)
      const cursorRequest = queueStore.openCursor();

      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        
        if (cursor && count < limit) {
          const queueItem = cursor.value as QueueItem;
          
          // Hydrate: Get full artifact from vault
          const getRequest = artifactStore.get(queueItem.url);
          
          getRequest.onsuccess = () => {
            if (getRequest.result) {
              results.push(getRequest.result);
            }
            count++;
            cursor.continue();
          };
        } else {
          resolve(results);
        }
      };

      cursorRequest.onerror = () => reject(cursorRequest.error);
    });
  }

  /**
   * Get queue items with metadata (for retry logic).
   */
  async getQueueItems(limit: number = 50): Promise<QueueItem[]> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.SYNC_QUEUE, 'readonly');
      const store = transaction.objectStore(STORES.SYNC_QUEUE);

      const results: QueueItem[] = [];
      let count = 0;

      const cursorRequest = store.openCursor();

      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        
        if (cursor && count < limit) {
          results.push(cursor.value);
          count++;
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      cursorRequest.onerror = () => reject(cursorRequest.error);
    });
  }

  /**
   * Mark items as synced (remove from queue).
   */
  async markSynced(urls: string[]): Promise<void> {
    if (urls.length === 0) return;
    
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
      const store = transaction.objectStore(STORES.SYNC_QUEUE);
      const urlIndex = store.index('url');

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => {
        console.log(`[Storage] Marked ${urls.length} items as synced`);
        resolve();
      };

      // Delete each queued item by URL
      for (const url of urls) {
        const request = urlIndex.getKey(url);
        request.onsuccess = () => {
          if (request.result !== undefined) {
            store.delete(request.result);
          }
        };
      }
    });
  }

  /**
   * Record a sync failure (increment attempts, store error).
   */
  async recordSyncFailure(url: string, error: string): Promise<void> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
      const store = transaction.objectStore(STORES.SYNC_QUEUE);
      const urlIndex = store.index('url');

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();

      const request = urlIndex.get(url);
      request.onsuccess = () => {
        if (request.result) {
          const item = request.result as QueueItem;
          item.attempts += 1;
          item.last_error = error;
          store.put(item);
        }
      };
    });
  }

  // --------------------------------------------------------------------------
  // QUERY OPERATIONS
  // --------------------------------------------------------------------------

  /**
   * Get a single artifact by URL.
   */
  async getArtifact(url: string): Promise<ArtifactPayload | null> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.ARTIFACTS, 'readonly');
      const store = transaction.objectStore(STORES.ARTIFACTS);

      const request = store.get(url);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update artifact metrics (for final pulse on page exit).
   * Updates dwell_time, scroll_depth, reading_depth, and possibly artifact_type.
   * 
   * CRITICAL: Re-queues the artifact for sync if it was already synced.
   * This ensures the server gets the final metrics even if an earlier
   * "ambient" version was already uploaded.
   */
  async updateArtifactMetrics(
    url: string, 
    metrics: {
      dwell_time_ms: number;
      scroll_depth: number;
      reading_depth: number;
      engagement_level: 'ambient' | 'engaged' | 'committed';
    }
  ): Promise<boolean> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      // CRITICAL: Include SYNC_QUEUE in transaction for re-queueing
      const transaction = db.transaction(
        [STORES.ARTIFACTS, STORES.SYNC_QUEUE], 
        'readwrite'
      );
      const artifactStore = transaction.objectStore(STORES.ARTIFACTS);
      const queueStore = transaction.objectStore(STORES.SYNC_QUEUE);

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve(true);

      const getRequest = artifactStore.get(url);
      getRequest.onsuccess = () => {
        const artifact = getRequest.result as ArtifactPayload | undefined;
        
        if (!artifact) {
          console.log(`[Storage] No artifact found for URL: ${url.substring(0, 50)}...`);
          resolve(false);
          return;
        }

        // Update metrics
        artifact.dwell_time_ms = metrics.dwell_time_ms;
        artifact.scroll_depth = metrics.scroll_depth;
        artifact.reading_depth = metrics.reading_depth;
        
        // Update artifact type and weights based on new reading depth
        const level = metrics.engagement_level;
        artifact.artifact_type = level;
        
        if (level === 'committed') {
          artifact.base_weight = 2.0;
          artifact.decay_rate = 'low';
        } else if (level === 'engaged') {
          artifact.base_weight = 1.0;
          artifact.decay_rate = 'medium';
        } else {
          artifact.base_weight = 0.2;
          artifact.decay_rate = 'high';
        }

        // Save updated artifact
        artifactStore.put(artifact);
        console.log(`[Storage] Updated metrics for: ${url.substring(0, 50)}... → ${level}`);

        // CRITICAL: Re-queue for sync (handles the race condition)
        // Check if already in queue first to avoid duplicates
        const urlIndex = queueStore.index('url');
        const checkRequest = urlIndex.get(url);
        
        checkRequest.onsuccess = () => {
          if (checkRequest.result) {
            // Already in queue, update it to mark as needing re-sync
            const existing = checkRequest.result as QueueItem;
            existing.added_at = Date.now(); // Refresh timestamp
            queueStore.put(existing);
            console.log(`[Storage] Updated queue item for: ${url.substring(0, 50)}...`);
          } else {
            // Not in queue (was already synced), re-add it
            const queueItem: Omit<QueueItem, 'id'> = {
              url: artifact.url,
              added_at: Date.now(),
              attempts: 0,
            };
            queueStore.add(queueItem);
            console.log(`[Storage] Re-queued for sync: ${url.substring(0, 50)}...`);
          }
        };
      };
      
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Get all artifacts (for local analysis).
   */
  async getAllArtifacts(): Promise<ArtifactPayload[]> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.ARTIFACTS, 'readonly');
      const store = transaction.objectStore(STORES.ARTIFACTS);

      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get artifacts by domain (for domain-specific analysis).
   */
  async getArtifactsByDomain(domain: string): Promise<ArtifactPayload[]> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.ARTIFACTS, 'readonly');
      const store = transaction.objectStore(STORES.ARTIFACTS);
      const domainIndex = store.index('domain');

      const request = domainIndex.getAll(domain);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get recent artifacts (for popup display).
   */
  async getRecentArtifacts(limit: number = 10): Promise<ArtifactPayload[]> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.ARTIFACTS, 'readonly');
      const store = transaction.objectStore(STORES.ARTIFACTS);
      const timeIndex = store.index('captured_at');

      const results: ArtifactPayload[] = [];
      
      // Open cursor in reverse order (newest first)
      const cursorRequest = timeIndex.openCursor(null, 'prev');

      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      cursorRequest.onerror = () => reject(cursorRequest.error);
    });
  }

  // --------------------------------------------------------------------------
  // STATS & MAINTENANCE
  // --------------------------------------------------------------------------

  /**
   * Get storage statistics.
   */
  async getStats(): Promise<StorageStats> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [STORES.ARTIFACTS, STORES.SYNC_QUEUE], 
        'readonly'
      );

      const artifactStore = transaction.objectStore(STORES.ARTIFACTS);
      const queueStore = transaction.objectStore(STORES.SYNC_QUEUE);

      let artifactCount = 0;
      let pendingSyncCount = 0;
      let oldestPending: number | null = null;

      const countArtifacts = artifactStore.count();
      countArtifacts.onsuccess = () => {
        artifactCount = countArtifacts.result;
      };

      const countQueue = queueStore.count();
      countQueue.onsuccess = () => {
        pendingSyncCount = countQueue.result;
      };

      // Get oldest queue item
      const cursorRequest = queueStore.openCursor();
      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          oldestPending = (cursor.value as QueueItem).added_at;
        }
      };

      transaction.oncomplete = () => {
        resolve({ artifactCount, pendingSyncCount, oldestPending });
      };

      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Clear old artifacts (retention policy).
   */
  async pruneOldArtifacts(maxAgeDays: number = 30): Promise<number> {
    const db = await this.ensureDb();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxAgeDays);
    const cutoffIso = cutoff.toISOString();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.ARTIFACTS, 'readwrite');
      const store = transaction.objectStore(STORES.ARTIFACTS);
      const timeIndex = store.index('captured_at');

      let deletedCount = 0;

      // Get all items older than cutoff
      const range = IDBKeyRange.upperBound(cutoffIso);
      const cursorRequest = timeIndex.openCursor(range);

      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        }
      };

      transaction.oncomplete = () => {
        console.log(`[Storage] Pruned ${deletedCount} old artifacts`);
        resolve(deletedCount);
      };

      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Clear all data (for testing/reset).
   */
  async clear(): Promise<void> {
    const db = await this.ensureDb();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [STORES.ARTIFACTS, STORES.SYNC_QUEUE], 
        'readwrite'
      );

      transaction.objectStore(STORES.ARTIFACTS).clear();
      transaction.objectStore(STORES.SYNC_QUEUE).clear();

      transaction.oncomplete = () => {
        console.log('[Storage] All data cleared');
        resolve();
      };

      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Clear ALL data including UserMap (full reset).
   */
  async clearAll(): Promise<void> {
    await this.clear();
    await this.clearUserMap();
    console.log('[Storage] Full reset complete');
  }

  // --------------------------------------------------------------------------
  // USER MAP (Markers + Centroids)
  // Using chrome.storage.local for simpler single-object storage
  // --------------------------------------------------------------------------

  /**
   * Get the user's mental map (markers + centroids).
   */
  async getUserMap(): Promise<UserMap | null> {
    return new Promise((resolve) => {
      chrome.storage.local.get(['userMap'], (result) => {
        resolve(result.userMap || null);
      });
    });
  }

  /**
   * Save the user's mental map.
   */
  async saveUserMap(map: UserMap): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ userMap: map }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          console.log(`[Storage] UserMap saved: ${map.centroids.length} centroids, ${map.markers.length} markers`);
          resolve();
        }
      });
    });
  }

  /**
   * Clear the user's mental map (on logout).
   */
  async clearUserMap(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.remove(['userMap'], () => {
        console.log('[Storage] UserMap cleared');
        resolve();
      });
    });
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const storage = new LocalStore();
