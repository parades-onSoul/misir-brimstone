/**
 * Session Manager
 * 
 * Tracks research sessions to group related artifacts.
 * A session expires after 30 minutes of inactivity.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_STORAGE_KEY = 'misir_session';

// ============================================================================
// TYPES
// ============================================================================

export interface Session {
  id: string;
  startedAt: number;      // Unix timestamp ms
  lastActivityAt: number; // Unix timestamp ms
  artifactCount: number;
  tabIds: Set<number>;    // Tabs that are part of this session
}

interface StoredSession {
  id: string;
  startedAt: number;
  lastActivityAt: number;
  artifactCount: number;
  tabIds: number[];
}

// ============================================================================
// SESSION MANAGER
// ============================================================================

class SessionManager {
  private currentSession: Session | null = null;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.loadSession();
  }

  /**
   * Wait for session to load from storage
   */
  async waitForInit(): Promise<void> {
    return this.initPromise;
  }

  /**
   * Load session from storage
   */
  private async loadSession(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(SESSION_STORAGE_KEY);
      if (result[SESSION_STORAGE_KEY]) {
        const stored: StoredSession = result[SESSION_STORAGE_KEY];
        
        // Check if session is still valid (not expired)
        const now = Date.now();
        if (now - stored.lastActivityAt < SESSION_TIMEOUT_MS) {
          this.currentSession = {
            ...stored,
            tabIds: new Set(stored.tabIds),
          };
          console.log(`[Session] Restored session: ${this.currentSession.id.substring(0, 8)}...`);
        } else {
          console.log('[Session] Previous session expired, will create new on activity');
          await this.clearSession();
        }
      }
    } catch (e) {
      console.error('[Session] Failed to load:', e);
    }
  }

  /**
   * Save session to storage
   */
  private async saveSession(): Promise<void> {
    if (!this.currentSession) return;
    
    const stored: StoredSession = {
      id: this.currentSession.id,
      startedAt: this.currentSession.startedAt,
      lastActivityAt: this.currentSession.lastActivityAt,
      artifactCount: this.currentSession.artifactCount,
      tabIds: Array.from(this.currentSession.tabIds),
    };
    
    await chrome.storage.local.set({ [SESSION_STORAGE_KEY]: stored });
  }

  /**
   * Clear session from storage
   */
  private async clearSession(): Promise<void> {
    this.currentSession = null;
    await chrome.storage.local.remove(SESSION_STORAGE_KEY);
  }

  /**
   * Generate a new session ID
   */
  private generateSessionId(): string {
    // Format: YYYYMMDD-HHMMSS-RANDOM
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timePart = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const randomPart = Math.random().toString(36).substring(2, 8);
    return `${datePart}-${timePart}-${randomPart}`;
  }

  /**
   * Get or create current session
   */
  async getSession(): Promise<Session> {
    await this.initPromise;
    
    const now = Date.now();
    
    // Check if current session is still valid
    if (this.currentSession) {
      if (now - this.currentSession.lastActivityAt < SESSION_TIMEOUT_MS) {
        // Session still active, update last activity
        this.currentSession.lastActivityAt = now;
        await this.saveSession();
        return this.currentSession;
      } else {
        // Session expired
        console.log(`[Session] Expired after ${Math.round((now - this.currentSession.lastActivityAt) / 60000)} min idle`);
        await this.clearSession();
      }
    }
    
    // Create new session
    this.currentSession = {
      id: this.generateSessionId(),
      startedAt: now,
      lastActivityAt: now,
      artifactCount: 0,
      tabIds: new Set(),
    };
    
    console.log(`[Session] Started new session: ${this.currentSession.id}`);
    await this.saveSession();
    
    return this.currentSession;
  }

  /**
   * Get current session ID (for artifact tagging)
   */
  async getSessionId(): Promise<string> {
    const session = await this.getSession();
    return session.id;
  }

  /**
   * Record activity (extends session, tracks tab)
   */
  async recordActivity(tabId?: number): Promise<void> {
    const session = await this.getSession();
    session.lastActivityAt = Date.now();
    
    if (tabId) {
      session.tabIds.add(tabId);
    }
    
    await this.saveSession();
  }

  /**
   * Record artifact capture (increments count)
   */
  async recordArtifact(): Promise<string> {
    const session = await this.getSession();
    session.artifactCount++;
    session.lastActivityAt = Date.now();
    await this.saveSession();
    return session.id;
  }

  /**
   * Get session stats
   */
  async getStats(): Promise<{
    sessionId: string | null;
    startedAt: number | null;
    durationMs: number;
    artifactCount: number;
    tabCount: number;
  }> {
    await this.initPromise;
    
    if (!this.currentSession) {
      return {
        sessionId: null,
        startedAt: null,
        durationMs: 0,
        artifactCount: 0,
        tabCount: 0,
      };
    }
    
    return {
      sessionId: this.currentSession.id,
      startedAt: this.currentSession.startedAt,
      durationMs: Date.now() - this.currentSession.startedAt,
      artifactCount: this.currentSession.artifactCount,
      tabCount: this.currentSession.tabIds.size,
    };
  }

  /**
   * End current session (for manual logout or testing)
   */
  async endSession(): Promise<void> {
    if (this.currentSession) {
      console.log(`[Session] Ended: ${this.currentSession.id} (${this.currentSession.artifactCount} artifacts)`);
    }
    await this.clearSession();
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const sessionManager = new SessionManager();
