/**
 * Supabase Auth Client — Session management for Chrome Extension
 *
 * Handles:
 *  - Email/password sign-in
 *  - Session persistence via chrome.storage.local
 *  - Token refresh
 *  - Auth state broadcasting
 *
 * Uses the same Supabase project as frontend + backend:
 *   https://vnnhmqrxrcnmcumcorta.supabase.co
 */

// Guard against window not being defined (service worker context)
if (typeof window === 'undefined') {
  // @ts-ignore
  globalThis.window = {
    location: { href: '', hostname: 'chrome-extension', origin: 'chrome-extension://' } as any,
    addEventListener: () => { },
    removeEventListener: () => { },
    localStorage: { getItem: () => null, setItem: () => { }, removeItem: () => { }, clear: () => { } } as any,
  } as any;
}

import { createClient, type SupabaseClient, type Session, type User } from '@supabase/supabase-js';
import type { AuthState } from '@/types';
import { EMPTY_AUTH } from '@/types';

// ── Config ───────────────────────────────────────────

const SUPABASE_URL = 'https://vnnhmqrxrcnmcumcorta.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZubmhtcXJ4cmNubWN1bWNvcnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMjE3NDcsImV4cCI6MjA4NTY5Nzc0N30.WriGsbK_J6yDKK0ICDYP162_cATJHd9_WXk9swb-19U';

const STORAGE_KEY = 'misir_session';

// ── Supabase Client (singleton) ──────────────────────

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // Chrome extensions can't use localStorage — we manage storage ourselves
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

// ── Session Storage (chrome.storage.local) ───────────

interface StoredSession {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch seconds
  user: {
    id: string;
    email: string;
  };
}

async function loadSession(): Promise<StoredSession | null> {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    return result[STORAGE_KEY] || null;
  } catch (err) {
    console.error('[Misir Auth] Failed to load session:', err);
    return null;
  }
}

async function saveSession(session: Session): Promise<void> {
  const stored: StoredSession = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at ?? 0,
    user: {
      id: session.user.id,
      email: session.user.email ?? '',
    },
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: stored });
}

async function clearSession(): Promise<void> {
  await chrome.storage.local.remove([STORAGE_KEY]);
}

// ── Auth Operations ──────────────────────────────────

/**
 * Sign in with email and password.
 * Returns AuthState on success, throws on failure.
 */
export async function signIn(
  email: string,
  password: string
): Promise<AuthState> {
  try {
    const supabase = getClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw new Error(error.message);
    if (!data.session) throw new Error('No session returned');

    await saveSession(data.session);

    return {
      isAuthenticated: true,
      userId: data.session.user.id,
      email: data.session.user.email ?? null,
      accessToken: data.session.access_token,
    };
  } catch (err) {
    console.error('[Misir Auth] Sign in failed:', err);
    throw err;
  }
}

/**
 * Sign out — clears session from storage.
 */
export async function signOut(): Promise<void> {
  const supabase = getClient();

  try {
    await supabase.auth.signOut();
  } catch {
    // Ignore errors — we'll clear local state anyway
  }

  await clearSession();
  await chrome.storage.local.remove(['userId']);
}

/**
 * Get current auth state from stored session.
 * Checks expiry and refreshes if needed.
 */
export async function getAuthState(): Promise<AuthState> {
  try {
    const stored = await loadSession();
    if (!stored) return EMPTY_AUTH;

    // Check if token is expired (with 60s buffer)
    const now = Math.floor(Date.now() / 1000);
    if (stored.expires_at > 0 && stored.expires_at - now < 60) {
      // Try to refresh
      const refreshed = await refreshSession();
      if (refreshed) return refreshed;

      // Refresh failed — clear and return empty
      await clearSession();
      return EMPTY_AUTH;
    }

    return {
      isAuthenticated: true,
      userId: stored.user.id,
      email: stored.user.email,
      accessToken: stored.access_token,
    };
  } catch (err) {
    console.error('[Misir Auth] Failed to get auth state:', err);
    // On any error, clear session and return empty auth
    await clearSession().catch(() => { });
    return EMPTY_AUTH;
  }
}

/**
 * Refresh the access token using the stored refresh token.
 */
export async function refreshSession(): Promise<AuthState | null> {
  try {
    const stored = await loadSession();
    if (!stored?.refresh_token) return null;

    const supabase = getClient();

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: stored.refresh_token,
    });

    if (error || !data.session) {
      console.warn('[Misir Auth] Refresh failed:', error?.message);
      await clearSession();
      return null;
    }

    await saveSession(data.session);
    return {
      isAuthenticated: true,
      userId: data.session.user.id,
      email: data.session.user.email ?? null,
      accessToken: data.session.access_token,
    };
  } catch (err) {
    console.error('[Misir Auth] Refresh session failed:', err);
    await clearSession().catch(() => { });
    return null;
  }
}

/**
 * Get the current access token (for Authorization header).
 * Returns null if not authenticated.
 */
export async function getAccessToken(): Promise<string | null> {
  const state = await getAuthState();
  return state.accessToken;
}

/**
 * Get the current user ID (Supabase user ID).
 * Requires authentication - throws error if not logged in.
 */
export async function getAuthUserId(): Promise<string> {
  const state = await getAuthState();
  if (state.userId) return state.userId;

  throw new Error('Not authenticated - please log in first');
}

// ── Data Fetching (Direct Supabase RLS reads) ────────

/**
 * Fetch all spaces for the authenticated user.
 * Uses RLS so requires valid session.
 */
export async function fetchSpacesFromSupabase(): Promise<import('@/types').Space[]> {
  try {
    const state = await getAuthState();
    if (!state.isAuthenticated) {
      throw new Error('Not authenticated - cannot fetch from Supabase');
    }

    const supabase = getClient();
    const stored = await loadSession();
    if (!stored?.access_token || !stored.refresh_token) {
      throw new Error('No valid Supabase session in storage');
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: stored.access_token,
      refresh_token: stored.refresh_token,
    });
    if (sessionError) throw sessionError;

    const { data, error } = await supabase
      .schema('misir')
      .from('space')
      .select('*')
      .eq('user_id', state.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[Misir Supabase] Failed to fetch spaces:', err);
    throw err;
  }
}

/**
 * Fetch all subspaces for a given space.
 */
export async function fetchSubspacesFromSupabase(
  spaceId: number
): Promise<import('@/types').Subspace[]> {
  try {
    const state = await getAuthState();
    if (!state.isAuthenticated) {
      throw new Error('Not authenticated - cannot fetch from Supabase');
    }

    const supabase = getClient();
    const stored = await loadSession();
    if (!stored?.access_token || !stored.refresh_token) {
      throw new Error('No valid Supabase session in storage');
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: stored.access_token,
      refresh_token: stored.refresh_token,
    });
    if (sessionError) throw sessionError;

    const { data, error } = await supabase
      .schema('misir')
      .from('subspace')
      .select('*')
      .eq('space_id', spaceId)
      .order('artifact_count', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[Misir Supabase] Failed to fetch subspaces:', err);
    throw err;
  }
}

/**
 * Fetch all markers for a given space.
 */
export async function fetchMarkersFromSupabase(
  spaceId: number
): Promise<import('@/types').Marker[]> {
  try {
    const state = await getAuthState();
    if (!state.isAuthenticated) {
      throw new Error('Not authenticated - cannot fetch from Supabase');
    }

    const supabase = getClient();
    const stored = await loadSession();
    if (!stored?.access_token || !stored.refresh_token) {
      throw new Error('No valid Supabase session in storage');
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: stored.access_token,
      refresh_token: stored.refresh_token,
    });
    if (sessionError) throw sessionError;

    const { data, error } = await supabase
      .schema('misir')
      .from('marker')
      .select('*')
      .eq('space_id', spaceId)
      .order('label');

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[Misir Supabase] Failed to fetch markers:', err);
    throw err;
  }
}
