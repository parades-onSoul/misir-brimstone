/**
 * API Client (Hybrid Approach)
 * 
 * READS: Supabase Direct (via RLS with user JWT)
 * WRITES: Backend API (needs embeddings)
 * 
 * This gives us:
 * - Fast reads without backend latency
 * - Proper embedding generation on writes
 * - Real-time subscriptions potential
 */

import type { ArtifactPayload, UserMap, Space, Marker } from '../classify/types';
import { supabaseAuth } from './supabase';

// ============================================================================
// TYPES
// ============================================================================

export interface SyncResult {
  success: boolean;
  error?: string;
  failedUrls?: string[];
  syncedCount?: number;
}

export interface ApiConfig {
  backendUrl: string;
  timeout: number;
}

interface BackendSyncResponse {
  success: boolean;
  synced_count: number;
  failed_urls: string[];
  errors: string[];
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: ApiConfig = {
  backendUrl: 'http://localhost:8000/api/v1',
  timeout: 30000,
};

const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

// ============================================================================
// HYBRID API CLIENT
// ============================================================================

class ApiClient {
  private config: ApiConfig;

  constructor(config: Partial<ApiConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // --------------------------------------------------------------------------
  // READS: Via Supabase Direct
  // --------------------------------------------------------------------------

  /**
   * Fetch the user's mental map directly from Supabase.
   * Uses RLS - no backend needed.
   */
  async fetchUserMap(): Promise<UserMap | null> {
    console.log('[API] Fetching user map from Supabase...');
    
    const userMap = await supabaseAuth.getUserMap();
    
    if (userMap) {
      console.log(`[API] Loaded: ${userMap.spaces.length} spaces, ${userMap.markers.length} markers`);
    } else {
      console.log('[API] No user map (not authenticated or empty)');
    }
    
    return userMap;
  }

  /**
   * Get spaces directly from Supabase
   */
  async getSpaces(): Promise<Space[]> {
    return supabaseAuth.getSpaces();
  }

  /**
   * Get markers directly from Supabase
   */
  async getMarkers(): Promise<Marker[]> {
    return supabaseAuth.getMarkers();
  }

  // --------------------------------------------------------------------------
  // WRITES: Via Backend (needs embeddings)
  // --------------------------------------------------------------------------

  /**
   * Push a batch of artifacts to the backend.
   * Backend will generate embeddings and store in Supabase.
   * POST /extension/sync
   */
  async pushBatch(batch: ArtifactPayload[]): Promise<SyncResult> {
    if (batch.length === 0) {
      return { success: true, syncedCount: 0 };
    }

    // Wait for initialization and reload session from storage
    await supabaseAuth.waitForInit();
    await supabaseAuth.reloadSession();
    
    const token = supabaseAuth.getAccessToken();
    if (!token) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      console.log(`[API] Pushing batch of ${batch.length} artifacts to backend...`);
      
      const response = await this.fetchWithRetry(
        `${this.config.backendUrl}/extension/sync`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ artifacts: batch }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('[API] Sync failed:', response.status, error);
        return { success: false, error: `HTTP ${response.status}: ${error}` };
      }

      const data: BackendSyncResponse = await response.json();
      
      console.log(`[API] Synced ${data.synced_count} artifacts`);
      
      return { 
        success: data.success, 
        syncedCount: data.synced_count,
        failedUrls: data.failed_urls,
        error: data.errors.length > 0 ? data.errors.join('; ') : undefined,
      };

    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      console.error('[API] Push failed:', error);
      return { success: false, error };
    }
  }

  // --------------------------------------------------------------------------
  // HEALTH CHECKS
  // --------------------------------------------------------------------------

  /**
   * Check backend connectivity.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.backendUrl}/extension/health`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Check if user is authenticated with Supabase
   */
  isAuthenticated(): boolean {
    return supabaseAuth.getAuthState().isAuthenticated;
  }

  /**
   * Get current user info
   */
  getUser() {
    return supabaseAuth.getAuthState().user;
  }

  // --------------------------------------------------------------------------
  // CONFIGURATION
  // --------------------------------------------------------------------------

  /**
   * Update configuration.
   */
  configure(config: Partial<ApiConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[API] Configuration updated:', { 
      backendUrl: this.config.backendUrl,
    });
  }

  /**
   * Get current backend URL.
   */
  getBackendUrl(): string {
    return this.config.backendUrl;
  }

  // --------------------------------------------------------------------------
  // INTERNAL: Fetch with Retry
  // --------------------------------------------------------------------------

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    attempts = RETRY_ATTEMPTS
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let i = 1; i <= attempts; i++) {
      try {
        const response = await fetch(url, {
          ...options,
          signal: AbortSignal.timeout(this.config.timeout),
        });

        // Don't retry client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          return response;
        }

        // Retry server errors (5xx)
        if (response.status >= 500) {
          throw new Error(`Server error: ${response.status}`);
        }

        return response;

      } catch (err) {
        lastError = err instanceof Error ? err : new Error('Unknown error');
        console.log(`[API] Attempt ${i}/${attempts} failed: ${lastError.message}`);

        if (i < attempts) {
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS * i));
        }
      }
    }

    throw lastError || new Error('Fetch failed after retries');
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const apiClient = new ApiClient();
