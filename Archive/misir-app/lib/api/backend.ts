/**
 * Backend API Client
 * 
 * Connects Next.js frontend to FastAPI backend.
 * Frontend handles: UI, embeddings for spaces/subspaces/markers
 * Backend handles: Artifacts, evidence, insights, reports, extension sync
 */

import { createBrowserClient } from '@supabase/ssr';

// Backend URL configuration
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

/**
 * Get auth token from Supabase session
 */
async function getAuthToken(): Promise<string | null> {
  try {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch {
    return null;
  }
}

/**
 * Make authenticated request to FastAPI backend
 */
export async function backendFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const url = `${BACKEND_URL}${endpoint}`;
  
  // Get token if not provided
  const authToken = token || await getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (authToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `Backend error: ${response.status}`);
  }

  return response.json();
}

/**
 * Backend API endpoints
 */
export const backendApi = {
  // Health check
  health: () => backendFetch<BackendHealthResponse>('/health'),
  
  // Root info (version, status)
  info: () => backendFetch<BackendInfoResponse>('/'),
  
  // Extension endpoints (for dashboard viewing extension data)
  extension: {
    /**
     * Get user map (spaces + centroids) - useful for dashboard to see what extension sees
     */
    getMap: (token?: string) =>
      backendFetch<UserMapResponse>('/api/v1/extension/map', {}, token),
    
    /**
     * Health check for extension API
     */
    health: () => backendFetch<{ status: string; service: string; timestamp: string }>(
      '/api/v1/extension/health'
    ),
  },
  
  // Artifacts - view synced artifacts
  artifacts: {
    /**
     * Get artifacts for a space (dashboard views what extension synced)
     */
    getBySpace: async (spaceId: string, _token?: string) => {
      // Query Supabase directly for now - backend will add this endpoint later
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      const { data, error } = await supabase
        .from('artifacts')
        .select('*')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as Artifact[];
    },
    
    /**
     * Get recent artifacts across all spaces
     */
    getRecent: async (limit = 20, _token?: string) => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      const { data, error } = await supabase
        .from('artifacts')
        .select('*, spaces(name)')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as ArtifactWithSpace[];
    },
  },
  
  // Sessions - view browsing sessions
  sessions: {
    /**
     * Get recent sessions
     */
    getRecent: async (limit = 10, _token?: string) => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      const { data, error } = await supabase
        .from('sessions')
        .select('*, spaces(name)')
        .order('started_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data as Session[];
    },
  },
};

// ============================================================================
// Types - Aligned with FastAPI backend models
// ============================================================================

export interface BackendHealthResponse {
  status: string;
}

export interface BackendInfoResponse {
  message: string;
  version: string;
  codename: string;
  status: string;
}

export interface UserMapResponse {
  userId: string;
  spaces: SpaceResponse[];
  subspaces: SubspaceResponse[];
  markers: MarkerResponse[];
  centroids: CentroidResponse[];
  lastUpdated: number; // Unix timestamp ms
}

export interface SpaceResponse {
  id: string;
  name: string;
  intention?: string;
  embedding?: number[];
  created_at: string;
  last_updated_at: string;
}

export interface SubspaceResponse {
  id: string;
  space_id: string;
  name: string;
  markers: string[];
  display_order: number;
  centroid_embedding?: number[];
  centroid_artifact_count: number;
  centroid_updated_at?: string;
}

export interface MarkerResponse {
  id: string;
  label: string;
  space_id: string;
  embedding?: number[];
  created_at: string;
  updated_at: string;
}

export interface CentroidResponse {
  spaceId: string;
  spaceName: string;
  vector: Record<string, number>; // term -> weight (0-1)
  threshold: number;
  lastUpdated: number;
}

export interface Artifact {
  id: string;
  user_id: string;
  space_id: string;
  subspace_id?: string;
  session_id?: string;
  url: string;
  title: string;
  extracted_text?: string;
  content_source: 'web' | 'ai' | 'video' | 'pdf';
  content_embedding?: number[];
  relevance: number;
  base_weight: number;
  word_count?: number;
  created_at: string;
}

export interface ArtifactWithSpace extends Artifact {
  spaces?: { name: string };
}

export interface Session {
  id: string;
  user_id: string;
  focus_space_id?: string;
  started_at: string;
  ended_at?: string;
  artifact_count: number;
  spaces?: { name: string };
}

export { BACKEND_URL };
