/**
 * Storage Module Index
 * 
 * Local-first storage with IndexedDB:
 * - artifacts: Permanent vault of captured content
 * - sync_queue: Outbox for pending API syncs
 */

export { 
  LocalStore, 
  storage,
  type QueueItem,
  type StorageStats,
} from './db';
