/**
 * Backend API Client
 *
 * Communicates with the local FastAPI backend.
 * When authenticated via Supabase, sends Bearer JWT.
 * When MOCK_AUTH=True on the backend, no JWT is needed —
 * get_current_user returns MOCK_USER_ID automatically.
 *
 * Features:
 *   - Automatic retry with exponential backoff
 *   - Bearer token authentication
 *   - Request timeout handling
 *   - Search endpoint integration
 */
import type {
  CapturePayload,
  CaptureResponse,
  Space,
  SensorConfig,
} from '@/types';
// Lazy imports moved to functions to avoid loading supabase in service worker context

// ── Constants ────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 1000;
const RETRY_BACKOFF_MULTIPLIER = 2;
const REQUEST_TIMEOUT_MS = 15000;

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

// ── Fetch helper with retry logic ────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retryCount = 0
): Promise<T> {
  const config = await getConfig();
  const url = `${config.apiUrl}${path}`;

  // Dynamically import getAccessToken to avoid loading supabase in service worker
  const { getAccessToken } = await import('@/api/supabase');

  // Attach Bearer token if authenticated
  const token = await getAccessToken();
  const authHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...(options.headers as Record<string, string> || {}),
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      // Retry on 5xx server errors or connection errors
      if (response.status >= 500 && retryCount < MAX_RETRIES) {
        const delayMs = RETRY_BACKOFF_MS * Math.pow(RETRY_BACKOFF_MULTIPLIER, retryCount);
        console.warn(
          `[Misir API] HTTP ${response.status}, retrying in ${delayMs}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`
        );
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return apiFetch<T>(path, options, retryCount + 1);
      }

      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    return response.json() as Promise<T>;
  } catch (error) {
    // Retry on network errors
    if (retryCount < MAX_RETRIES && (
      error instanceof TypeError ||
      (error instanceof Error && error.name === 'AbortError')
    )) {
      const delayMs = RETRY_BACKOFF_MS * Math.pow(RETRY_BACKOFF_MULTIPLIER, retryCount);
      console.warn(
        `[Misir API] Network error, retrying in ${delayMs}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`,
        error
      );
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return apiFetch<T>(path, options, retryCount + 1);
    }
    throw error;
  }
}

// ── Public API ───────────────────────────────────────

export async function fetchSpaces(): Promise<Space[]> {
  // Dynamically import getAuthUserId to avoid loading supabase in service worker
  const { getAuthUserId } = await import('@/api/supabase');

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

/**
 * Search artifacts by query
 */
export async function searchArtifacts(
  query: string,
  spaceId?: number,
  threshold = 0.5,
  limit = 20
): Promise<Array<{
  artifact_id: number;
  similarity: number;
  title: string;
  url: string;
  space_id: number;
}>> {
  const params = new URLSearchParams({
    q: query,
    threshold: threshold.toString(),
    limit: limit.toString(),
  });

  if (spaceId) {
    params.append('space_id', spaceId.toString());
  }

  const resp = await apiFetch<{
    results: Array<{
      artifact_id: number;
      similarity: number;
      title: string;
      url: string;
      space_id: number;
    }>;
    count: number;
  }>(`/search?${params.toString()}`);

  return resp.results || [];
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

