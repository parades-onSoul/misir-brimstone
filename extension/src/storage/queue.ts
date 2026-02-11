/**
 * Offline Capture Queue — IndexedDB-backed
 *
 * Stores captures that fail to send and retries them when online.
 * Uses exponential backoff to avoid hammering the server.
 *
 * Features:
 *   - Persistent IndexedDB storage (survives extension reloads)
 *   - Exponential backoff retry (1s → 2s → 4s → 8s → max 60s)
 *   - Automatic retry on network restoration
 *   - Manual retry trigger from UI
 *   - Error history per item
 */
import type { CapturePayload } from '@/types';

// ── Constants ────────────────────────────────────────

const DB_NAME = 'misir-queue';
const DB_VERSION = 1;
const STORE_NAME = 'captures';
const BACKOFF_MIN_MS = 1000;
const BACKOFF_MAX_MS = 60000;
const BACKOFF_MULTIPLIER = 2;

// ── Types ────────────────────────────────────────────

export interface QueuedCapture {
  id: string; // UUID
  payload: CapturePayload;
  timestamp: number; // When it was first captured
  retries: number; // How many times we've tried
  lastRetryAt?: number; // Timestamp of last attempt
  nextRetryAt?: number; // When to retry next
  error?: string; // Last error message
}

// ── Database Initialization ──────────────────────────

let db: IDBDatabase | null = null;

async function getDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      
      // Create object store if it doesn't exist
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('nextRetryAt', 'nextRetryAt', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

// ── Queue Operations ─────────────────────────────────

/**
 * Generate UUID v4
 */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Calculate next retry time based on retry count
 */
function calculateNextRetry(retries: number): number {
  const delayMs = Math.min(
    BACKOFF_MIN_MS * Math.pow(BACKOFF_MULTIPLIER, retries),
    BACKOFF_MAX_MS
  );
  return Date.now() + delayMs;
}

/**
 * Add capture to queue (when API call fails)
 */
export async function addToQueue(
  payload: CapturePayload,
  error?: string
): Promise<string> {
  const database = await getDB();
  const id = generateId();

  const item: QueuedCapture = {
    id,
    payload,
    timestamp: Date.now(),
    retries: 0,
    lastRetryAt: undefined,
    nextRetryAt: Date.now(), // Try immediately first
    error,
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(item);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(id);
  });
}

/**
 * Get all queued captures
 */
export async function getQueue(): Promise<QueuedCapture[]> {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

/**
 * Get captures ready to retry (nextRetryAt <= now)
 */
export async function getReadyToRetry(): Promise<QueuedCapture[]> {
  const database = await getDB();
  const now = Date.now();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('nextRetryAt');
    
    // Get all items with nextRetryAt <= now
    const range = IDBKeyRange.upperBound(now);
    const request = index.getAll(range);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

/**
 * Get single queued item by ID
 */
export async function getQueueItem(id: string): Promise<QueuedCapture | null> {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

/**
 * Update queue item (after failed retry)
 */
export async function updateQueueItem(
  id: string,
  updates: Partial<QueuedCapture>
): Promise<void> {
  const database = await getDB();
  const current = await getQueueItem(id);

  if (!current) throw new Error(`Queue item ${id} not found`);

  const updated: QueuedCapture = {
    ...current,
    ...updates,
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(updated);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Mark item as successfully sent (remove from queue)
 */
export async function removeFromQueue(id: string): Promise<void> {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Process queue — retry items that are ready
 * Should be called periodically and when network comes online
 */
export async function processQueue(
  captureFunction: (payload: CapturePayload) => Promise<any>
): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const ready = await getReadyToRetry();
  let succeeded = 0;
  let failed = 0;

  for (const item of ready) {
    try {
      console.log(`[Misir Queue] Retrying capture ${item.id} (retry #${item.retries})`);
      
      await captureFunction(item.payload);
      
      // Success — remove from queue
      await removeFromQueue(item.id);
      succeeded++;
      
      console.log(`[Misir Queue] Successfully sent queued capture ${item.id}`);
    } catch (error) {
      // Failed — update retry count and next retry time
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      await updateQueueItem(item.id, {
        retries: item.retries + 1,
        lastRetryAt: Date.now(),
        nextRetryAt: calculateNextRetry(item.retries + 1),
        error: errorMsg,
      });
      
      failed++;
      
      console.warn(
        `[Misir Queue] Retry failed for ${item.id}: ${errorMsg}`,
        `Will retry at ${new Date(calculateNextRetry(item.retries + 1)).toISOString()}`
      );
    }
  }

  return {
    processed: ready.length,
    succeeded,
    failed,
  };
}

/**
 * Clear entire queue (destructive)
 */
export async function clearQueue(): Promise<void> {
  const database = await getDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  total: number;
  readyToRetry: number;
  pending: number;
  oldestItem?: {
    id: string;
    timestamp: number;
    retries: number;
  };
}> {
  const queue = await getQueue();
  const ready = await getReadyToRetry();

  const oldest = queue.reduce((acc, item) => {
    return !acc || item.timestamp < acc.timestamp ? item : acc;
  }, null as QueuedCapture | null);

  return {
    total: queue.length,
    readyToRetry: ready.length,
    pending: queue.length - ready.length,
    oldestItem: oldest
      ? {
          id: oldest.id,
          timestamp: oldest.timestamp,
          retries: oldest.retries,
        }
      : undefined,
  };
}

console.log('[Misir Queue] Offline queue system initialized');
