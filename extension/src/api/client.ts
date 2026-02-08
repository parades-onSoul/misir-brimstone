/**
 * Backend API Client
 *
 * Communicates with the local FastAPI backend.
 * When authenticated via Supabase, sends Bearer JWT.
 * When MOCK_AUTH=True on the backend, no JWT is needed —
 * get_current_user returns MOCK_USER_ID automatically.
 */
import type {
  CapturePayload,
  CaptureResponse,
  Space,
  SensorConfig,
  DEFAULT_CONFIG,
} from '@/types';
import { getAccessToken, getAuthUserId } from '@/api/supabase';

// ── Config ───────────────────────────────────────────

async function getConfig(): Promise<SensorConfig> {
  const result = await chrome.storage.local.get([
    'apiUrl',
    'userId',
    'enabled',
    'minWordCount',
    'minDwellTimeMs',
  ]);
  return {
    apiUrl: result.apiUrl || 'http://localhost:8000/api/v1',
    userId: result.userId || '', // Will be overridden by getAuthUserId() which requires auth
    enabled: result.enabled !== false,
    minWordCount: result.minWordCount ?? 50,
    minDwellTimeMs: result.minDwellTimeMs ?? 3000,
  };
}

async function setConfig(config: Partial<SensorConfig>): Promise<void> {
  await chrome.storage.local.set(config);
}

// ── Fetch helper ─────────────────────────────────────

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const config = await getConfig();
  const url = `${config.apiUrl}${path}`;

  // Attach Bearer token if authenticated
  const token = await getAccessToken();
  const authHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(options.headers as Record<string, string> || {}),
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

// ── Public API ───────────────────────────────────────

export async function fetchSpaces(): Promise<Space[]> {
  // Use Supabase user ID if authenticated, fall back to config
  const userId = await getAuthUserId();
  if (!userId) throw new Error('No user ID configured');

  const resp = await apiFetch<{ spaces: Space[]; count: number }>(
    `/spaces?user_id=${encodeURIComponent(userId)}`
  );
  return resp.spaces || [];
}

export async function captureArtifact(
  payload: CapturePayload
): Promise<CaptureResponse> {
  return apiFetch<CaptureResponse>('/artifacts/capture', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function healthCheck(): Promise<boolean> {
  try {
    const config = await getConfig();
    const baseUrl = config.apiUrl.replace('/api/v1', '');
    const resp = await fetch(`${baseUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export { getConfig, setConfig };
