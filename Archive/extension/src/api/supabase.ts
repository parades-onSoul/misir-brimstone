/**
 * Supabase Client for Extension
 * 
 * Handles:
 * - Auth (login, logout, session management)
 * - Direct reads (UserMap, spaces, markers)
 * - Real-time subscriptions
 * 
 * Writes go through backend (needs embeddings).
 */

import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';
import type { UserMap, Space, Subspace, Marker, SpaceCentroid } from '../classify/types';

// ============================================================================
// CONFIGURATION
// ============================================================================

// These are public keys - safe to include in extension
const SUPABASE_URL = 'https://tgjpqtkrluisklagyinw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_v0BEavwPVPA40S4K-n3vJg_OTkTw1xv';

// Storage keys
const SESSION_STORAGE_KEY = 'misir_session';

// ============================================================================
// TYPES
// ============================================================================

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  session: Session | null;
}

interface DbSpace {
  id: string;
  user_id: string;
  name: string;
  intention: string | null;
  embedding: number[] | null;
  created_at: string;
  last_updated_at: string;
}

interface DbSubspace {
  id: string;
  space_id: string;
  user_id: string;
  name: string;
  markers: string[];
  display_order: number;
  centroid_embedding: number[] | null;
  centroid_artifact_count: number;
  centroid_updated_at: string | null;
}

interface DbMarker {
  id: string;
  label: string;
  space_id: string;
  embedding: number[] | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// SUPABASE AUTH CLIENT
// ============================================================================

class SupabaseAuth {
  private client: SupabaseClient;
  private session: Session | null = null;
  private authListeners: ((state: AuthState) => void)[] = [];
  private initPromise: Promise<void>;

  constructor() {
    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,  // We'll manage session in chrome.storage
        autoRefreshToken: true,
      },
    });

    // Load session from storage on init (save promise for awaiting)
    this.initPromise = this.loadSession();
  }

  /**
   * Wait for initialization to complete
   */
  async waitForInit(): Promise<void> {
    return this.initPromise;
  }

  /**
   * Reload session from storage (call this before operations that need fresh auth)
   */
  async reloadSession(): Promise<void> {
    await this.loadSession();
  }

  // --------------------------------------------------------------------------
  // SESSION MANAGEMENT
  // --------------------------------------------------------------------------

  private async loadSession(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(SESSION_STORAGE_KEY);
      if (result[SESSION_STORAGE_KEY]) {
        const stored = result[SESSION_STORAGE_KEY];
        
        // Set session in Supabase client
        const { data, error } = await this.client.auth.setSession({
          access_token: stored.access_token,
          refresh_token: stored.refresh_token,
        });

        if (error) {
          console.log('[Supabase] Session restore failed, clearing:', error.message);
          await this.clearSession();
        } else if (data.session) {
          this.session = data.session;
          this.notifyListeners();
          console.log('[Supabase] Session restored for:', data.session.user.email);
        }
      }
    } catch (e) {
      console.error('[Supabase] Failed to load session:', e);
    }
  }

  private async saveSession(session: Session): Promise<void> {
    this.session = session;
    await chrome.storage.local.set({
      [SESSION_STORAGE_KEY]: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
      },
    });
    this.notifyListeners();
  }

  private async clearSession(): Promise<void> {
    this.session = null;
    await chrome.storage.local.remove(SESSION_STORAGE_KEY);
    this.notifyListeners();
  }

  private notifyListeners(): void {
    const state = this.getAuthState();
    this.authListeners.forEach(cb => cb(state));
  }

  // --------------------------------------------------------------------------
  // PUBLIC AUTH API
  // --------------------------------------------------------------------------

  /**
   * Get current auth state
   */
  getAuthState(): AuthState {
    return {
      isAuthenticated: !!this.session,
      user: this.session?.user || null,
      session: this.session,
    };
  }

  /**
   * Get access token for API calls
   */
  getAccessToken(): string | null {
    return this.session?.access_token || null;
  }

  /**
   * Get user ID
   */
  getUserId(): string | null {
    return this.session?.user?.id || null;
  }

  /**
   * Subscribe to auth state changes
   */
  onAuthChange(callback: (state: AuthState) => void): () => void {
    this.authListeners.push(callback);
    // Immediately call with current state
    callback(this.getAuthState());
    // Return unsubscribe function
    return () => {
      this.authListeners = this.authListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Sign in with email/password
   */
  async signInWithEmail(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await this.client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.session) {
        await this.saveSession(data.session);
        console.log('[Supabase] Signed in:', data.user?.email);
        return { success: true };
      }

      return { success: false, error: 'No session returned' };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
  }

  /**
   * Sign in with OAuth (opens browser tab)
   */
  async signInWithOAuth(provider: 'google' | 'github'): Promise<{ success: boolean; error?: string }> {
    try {
      // For Chrome extensions, we need to use chrome.identity or a custom flow
      // This opens the OAuth provider in a new tab
      const { error } = await this.client.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: chrome.runtime.getURL('src/settings/index.html'),
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      // OAuth opens a new tab, session will be captured via URL params
      // The settings page will need to handle the callback
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    await this.client.auth.signOut();
    await this.clearSession();
    console.log('[Supabase] Signed out');
  }

  /**
   * Refresh the session token
   */
  async refreshSession(): Promise<boolean> {
    if (!this.session?.refresh_token) return false;

    try {
      const { data, error } = await this.client.auth.refreshSession();
      if (error || !data.session) {
        await this.clearSession();
        return false;
      }
      await this.saveSession(data.session);
      return true;
    } catch {
      await this.clearSession();
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // DIRECT DATABASE READS (via RLS)
  // --------------------------------------------------------------------------

  /**
   * Fetch user's spaces from Supabase
   */
  async getSpaces(): Promise<Space[]> {
    if (!this.session) return [];

    const { data, error } = await this.client
      .from('spaces')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Supabase] Failed to fetch spaces:', error);
      return [];
    }

    return (data as DbSpace[]).map(s => ({
      id: s.id,
      name: s.name,
      intention: s.intention || undefined,
      embedding: s.embedding || undefined,
      created_at: s.created_at,
      last_updated_at: s.last_updated_at,
    }));
  }

  /**
   * Fetch user's subspaces from Supabase
   */
  async getSubspaces(): Promise<Subspace[]> {
    if (!this.session) return [];

    const { data, error } = await this.client
      .from('subspaces')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('[Supabase] Failed to fetch subspaces:', error);
      return [];
    }

    return (data as DbSubspace[]).map(ss => ({
      id: ss.id,
      space_id: ss.space_id,
      name: ss.name,
      markers: ss.markers || [],
      display_order: ss.display_order,
      centroid_embedding: ss.centroid_embedding || undefined,
      centroid_artifact_count: ss.centroid_artifact_count,
      centroid_updated_at: ss.centroid_updated_at || undefined,
    }));
  }

  /**
   * Fetch user's markers from Supabase
   */
  async getMarkers(): Promise<Marker[]> {
    if (!this.session) return [];

    const { data, error } = await this.client
      .from('markers')
      .select('*')
      .order('label', { ascending: true });

    if (error) {
      console.error('[Supabase] Failed to fetch markers:', error);
      return [];
    }

    return (data as DbMarker[]).map(m => ({
      id: m.id,
      label: m.label,
      space_id: m.space_id,
      embedding: m.embedding || undefined,
      created_at: m.created_at,
      updated_at: m.updated_at,
    }));
  }

  /**
   * Fetch complete UserMap (combines spaces, subspaces, markers)
   */
  async getUserMap(): Promise<UserMap | null> {
    // Ensure session is loaded first
    await this.initPromise;
    
    if (!this.session) {
      console.log('[Supabase] getUserMap: No session');
      return null;
    }

    try {
      const [spaces, subspaces, markers] = await Promise.all([
        this.getSpaces(),
        this.getSubspaces(),
        this.getMarkers(),
      ]);

      // Build lightweight centroids from subspace data
      // These are term-frequency vectors for local matching
      const centroids: SpaceCentroid[] = spaces.map(space => {
        // Get markers for this space
        const spaceMarkers = markers.filter(m => m.space_id === space.id);
        
        // Build simple term-weight vector from marker labels
        const vector: Record<string, number> = {};
        spaceMarkers.forEach(m => {
          // Split multi-word markers
          const terms = m.label.toLowerCase().split(/\s+/);
          terms.forEach(term => {
            vector[term] = (vector[term] || 0) + 0.5;
          });
        });

        return {
          spaceId: space.id,
          spaceName: space.name,
          vector,
          threshold: 0.05, // 5% threshold for easy matching
          lastUpdated: Date.now(),
        };
      });

      return {
        userId: this.getUserId()!,
        spaces,
        subspaces,
        markers,
        centroids,
        lastUpdated: Date.now(),
      };
    } catch (e) {
      console.error('[Supabase] Failed to build UserMap:', e);
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // RAW CLIENT ACCESS (for advanced queries)
  // --------------------------------------------------------------------------

  getClient(): SupabaseClient {
    return this.client;
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const supabaseAuth = new SupabaseAuth();
