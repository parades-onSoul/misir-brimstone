/**
 * Local Database
 * 
 * IndexedDB storage for signals before sync.
 */

import type { Signal } from '../types';

const DB_NAME = 'misir_sensor';
const DB_VERSION = 1;
const SIGNALS_STORE = 'signals';

let db: IDBDatabase | null = null;

// ============================================================================
// DATABASE SETUP
// ============================================================================

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
      
      // Signals store
      if (!database.objectStoreNames.contains(SIGNALS_STORE)) {
        const store = database.createObjectStore(SIGNALS_STORE, { keyPath: 'id' });
        store.createIndex('synced', 'synced', { unique: false });
        store.createIndex('capturedAt', 'capturedAt', { unique: false });
        store.createIndex('url', 'url', { unique: false });
      }
    };
  });
}

// ============================================================================
// SIGNAL OPERATIONS
// ============================================================================

/**
 * Save a signal to local storage
 */
export async function saveSignal(signal: Signal): Promise<void> {
  const database = await getDB();
  
  return new Promise((resolve, reject) => {
    const tx = database.transaction(SIGNALS_STORE, 'readwrite');
    const store = tx.objectStore(SIGNALS_STORE);
    
    // Check for duplicate URL within last hour
    const urlIndex = store.index('url');
    const urlRequest = urlIndex.getAll(signal.url);
    
    urlRequest.onsuccess = () => {
      const existing = urlRequest.result as Signal[];
      const recentDuplicate = existing.find(s => 
        signal.capturedAt - s.capturedAt < 3600000 // 1 hour
      );
      
      if (recentDuplicate) {
        // Update existing instead of creating duplicate
        const updated = {
          ...recentDuplicate,
          dwellTimeMs: Math.max(recentDuplicate.dwellTimeMs, signal.dwellTimeMs),
          scrollDepth: Math.max(recentDuplicate.scrollDepth, signal.scrollDepth),
          readingDepth: Math.max(recentDuplicate.readingDepth, signal.readingDepth),
          artifactType: higherType(recentDuplicate.artifactType, signal.artifactType),
          synced: false,
        };
        store.put(updated);
      } else {
        store.add(signal);
      }
    };
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get all unsynced signals
 */
export async function getUnsyncedSignals(): Promise<Signal[]> {
  const database = await getDB();
  
  return new Promise((resolve, reject) => {
    const tx = database.transaction(SIGNALS_STORE, 'readonly');
    const store = tx.objectStore(SIGNALS_STORE);
    const index = store.index('synced');
    const request = index.getAll(IDBKeyRange.only(0));
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Mark signals as synced
 */
export async function markSynced(ids: string[]): Promise<void> {
  const database = await getDB();
  
  return new Promise((resolve, reject) => {
    const tx = database.transaction(SIGNALS_STORE, 'readwrite');
    const store = tx.objectStore(SIGNALS_STORE);
    
    for (const id of ids) {
      const request = store.get(id);
      request.onsuccess = () => {
        if (request.result) {
          store.put({ ...request.result, synced: true });
        }
      };
    }
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get signal by ID
 */
export async function getSignal(id: string): Promise<Signal | null> {
  const database = await getDB();
  
  return new Promise((resolve, reject) => {
    const tx = database.transaction(SIGNALS_STORE, 'readonly');
    const store = tx.objectStore(SIGNALS_STORE);
    const request = store.get(id);
    
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get recent signals (for UI)
 */
export async function getRecentSignals(limit = 20): Promise<Signal[]> {
  const database = await getDB();
  
  return new Promise((resolve, reject) => {
    const tx = database.transaction(SIGNALS_STORE, 'readonly');
    const store = tx.objectStore(SIGNALS_STORE);
    const index = store.index('capturedAt');
    const request = index.openCursor(null, 'prev');
    
    const results: Signal[] = [];
    
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor && results.length < limit) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete old synced signals (cleanup)
 */
export async function cleanupOldSignals(olderThanDays = 7): Promise<number> {
  const database = await getDB();
  const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
  
  return new Promise((resolve, reject) => {
    const tx = database.transaction(SIGNALS_STORE, 'readwrite');
    const store = tx.objectStore(SIGNALS_STORE);
    const index = store.index('capturedAt');
    const range = IDBKeyRange.upperBound(cutoff);
    const request = index.openCursor(range);
    
    let deleted = 0;
    
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        const signal = cursor.value as Signal;
        if (signal.synced) {
          cursor.delete();
          deleted++;
        }
        cursor.continue();
      }
    };
    
    tx.oncomplete = () => resolve(deleted);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get storage stats
 */
export async function getStats(): Promise<{
  total: number;
  unsynced: number;
  synced: number;
}> {
  const database = await getDB();
  
  return new Promise((resolve, reject) => {
    const tx = database.transaction(SIGNALS_STORE, 'readonly');
    const store = tx.objectStore(SIGNALS_STORE);
    
    const countRequest = store.count();
    const unsyncedRequest = store.index('synced').count(IDBKeyRange.only(0));
    
    let total = 0;
    let unsynced = 0;
    
    countRequest.onsuccess = () => { total = countRequest.result; };
    unsyncedRequest.onsuccess = () => { unsynced = unsyncedRequest.result; };
    
    tx.oncomplete = () => resolve({
      total,
      unsynced,
      synced: total - unsynced,
    });
    
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================================================
// HELPERS
// ============================================================================

function higherType(a: Signal['artifactType'], b: Signal['artifactType']): Signal['artifactType'] {
  const order: Record<Signal['artifactType'], number> = { ambient: 0, engaged: 1, committed: 2 };
  return order[a] >= order[b] ? a : b;
}
