/**
 * Backend API Client
 *
 * Communicates with the local FastAPI backend.
 * Uses Supabase JWT auth (Bearer token).
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
  ScrapedPage,
  ReadingMetrics,
  EngagementLevel,
  ClassificationResult,
} from '@/types';
import { getAccessToken, getAuthState } from '@/api/supabase';

// ── Constants ────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 1000;
const RETRY_BACKOFF_MULTIPLIER = 2;
const REQUEST_TIMEOUT_MS = 15000;
const CAPTURE_REQUEST_TIMEOUT_MS = 60000;
type BackendEngagementLevel = 'latent' | 'discovered' | 'engaged' | 'saturated';
type BackendContentSource = 'web' | 'pdf' | 'video' | 'chat' | 'note' | 'other';

// ── Config ───────────────────────────────────────────

async function getConfig(): Promise<SensorConfig> {
  const result = await chrome.storage.local.get([
    'apiUrl',
    'userId',
    'enabled',
    'minWordCount',
    'minDwellTimeMs',
    'autoCaptureEnabled',
    'autoCaptureConfidenceThreshold',
    'autoCaptureCooldownMs',
    'autoCaptureSpaceId',
  ]);
  const normalizedApiUrl = normalizeApiUrl(result.apiUrl);
  const minWordCount = Number(result.minWordCount ?? 50);
  const minDwellTimeMs = Number(result.minDwellTimeMs ?? 3000);
  const autoCaptureConfidenceThresholdRaw = Number(result.autoCaptureConfidenceThreshold ?? 0.55);
  const autoCaptureCooldownMsRaw = Number(result.autoCaptureCooldownMs ?? 1800000);
  const autoCaptureSpaceIdRaw = result.autoCaptureSpaceId;
  return {
    apiUrl: normalizedApiUrl,
    userId: result.userId,
    enabled: result.enabled !== false,
    minWordCount: Number.isFinite(minWordCount) ? Math.max(0, minWordCount) : 50,
    minDwellTimeMs: Number.isFinite(minDwellTimeMs) ? Math.max(0, minDwellTimeMs) : 3000,
    autoCaptureEnabled: result.autoCaptureEnabled === true,
    autoCaptureConfidenceThreshold: Number.isFinite(autoCaptureConfidenceThresholdRaw)
      ? Math.min(1, Math.max(0, autoCaptureConfidenceThresholdRaw))
      : 0.55,
    autoCaptureCooldownMs: Number.isFinite(autoCaptureCooldownMsRaw)
      ? Math.max(60000, autoCaptureCooldownMsRaw)
      : 1800000,
    autoCaptureSpaceId:
      typeof autoCaptureSpaceIdRaw === 'number' && Number.isInteger(autoCaptureSpaceIdRaw) && autoCaptureSpaceIdRaw > 0
        ? autoCaptureSpaceIdRaw
        : undefined,
  };
}

async function setConfig(config: Partial<SensorConfig>): Promise<void> {
  const next = { ...config };
  let clearAutoCaptureSpaceId = false;
  if (typeof next.apiUrl === 'string') {
    next.apiUrl = normalizeApiUrl(next.apiUrl);
  }
  if (typeof next.minWordCount === 'number' && Number.isFinite(next.minWordCount)) {
    next.minWordCount = Math.max(0, Math.round(next.minWordCount));
  }
  if (typeof next.minDwellTimeMs === 'number' && Number.isFinite(next.minDwellTimeMs)) {
    next.minDwellTimeMs = Math.max(0, Math.round(next.minDwellTimeMs));
  }
  if (
    typeof next.autoCaptureConfidenceThreshold === 'number' &&
    Number.isFinite(next.autoCaptureConfidenceThreshold)
  ) {
    next.autoCaptureConfidenceThreshold = Math.min(
      1,
      Math.max(0, next.autoCaptureConfidenceThreshold)
    );
  }
  if (
    typeof next.autoCaptureCooldownMs === 'number' &&
    Number.isFinite(next.autoCaptureCooldownMs)
  ) {
    next.autoCaptureCooldownMs = Math.max(60000, Math.round(next.autoCaptureCooldownMs));
  }
  if (next.autoCaptureSpaceId === null || next.autoCaptureSpaceId === undefined) {
    clearAutoCaptureSpaceId = true;
    delete next.autoCaptureSpaceId;
  } else if (
    typeof next.autoCaptureSpaceId !== 'number' ||
    !Number.isInteger(next.autoCaptureSpaceId) ||
    next.autoCaptureSpaceId <= 0
  ) {
    clearAutoCaptureSpaceId = true;
    delete next.autoCaptureSpaceId;
  }

  if (clearAutoCaptureSpaceId) {
    await chrome.storage.local.remove('autoCaptureSpaceId');
  }
  await chrome.storage.local.set(next);
}

function normalizeApiUrl(value: unknown): string {
  const fallback = 'http://localhost:8000/api/v1';
  if (typeof value !== 'string') return fallback;

  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return fallback;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return fallback;
  }

  const path = parsed.pathname.replace(/\/+$/, '');
  if (path === '' || path === '/') {
    parsed.pathname = '/api/v1';
    return parsed.toString().replace(/\/+$/, '');
  }

  // Accept exact API base or nested deployment paths that already include /api/v1.
  if (path.endsWith('/api/v1')) {
    parsed.pathname = path;
    return parsed.toString().replace(/\/+$/, '');
  }

  // Common misconfiguration: user enters /api or bare host.
  if (path.endsWith('/api')) {
    parsed.pathname = `${path}/v1`;
    return parsed.toString().replace(/\/+$/, '');
  }

  // Any other path is treated as host root and we append /api/v1.
  parsed.pathname = `${path}/api/v1`;
  return parsed.toString().replace(/\/+$/, '');
}

// ── Fetch helper with retry logic ────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retryCount = 0,
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<T> {
  const config = await getConfig();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${config.apiUrl}${normalizedPath}`;

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
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      // Retry on 5xx server errors or connection errors
      if (response.status >= 500 && retryCount < MAX_RETRIES) {
        const delayMs = RETRY_BACKOFF_MS * Math.pow(RETRY_BACKOFF_MULTIPLIER, retryCount);
        console.warn(
          `[Misir API] HTTP ${response.status}, retrying in ${delayMs}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`
        );
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return apiFetch<T>(path, options, retryCount + 1, timeoutMs);
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
      return apiFetch<T>(path, options, retryCount + 1, timeoutMs);
    }
    throw error;
  }
}

// ── Public API ───────────────────────────────────────

export async function fetchSpaces(): Promise<Space[]> {
  const authState = await getAuthState();
  if (!authState?.isAuthenticated) {
    throw new Error('Not authenticated');
  }

  const resp = await apiFetch<{ spaces: Space[]; count: number }>(
    `/spaces`
  );
  return resp.spaces || [];
}

export async function captureArtifact(
  payload: CapturePayload
): Promise<CaptureResponse> {
  const normalizedPayload = {
    ...payload,
    engagement_level: normalizeEngagementLevel(payload.engagement_level),
    content_source: normalizeContentSource(payload.content_source),
  };

  return apiFetch<CaptureResponse>('/artifacts/capture', {
    method: 'POST',
    body: JSON.stringify(normalizedPayload),
  }, 0, CAPTURE_REQUEST_TIMEOUT_MS);
}

export async function classifyContent(
  page: ScrapedPage,
  metrics: ReadingMetrics,
  engagement: EngagementLevel
): Promise<ClassificationResult> {
  return apiFetch<ClassificationResult>('/artifacts/classify', {
    method: 'POST',
    body: JSON.stringify({ page, metrics, engagement }),
  });
}

export async function getClassifierStatus(): Promise<{ available: boolean; mode: string }> {
  return apiFetch<{ available: boolean; mode: string }>('/artifacts/classify/status');
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
    const baseUrl = config.apiUrl.replace(/\/api\/v1\/?$/, '');
    const resp = await fetch(`${baseUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export { getConfig, setConfig };

function normalizeEngagementLevel(level: string): BackendEngagementLevel {
  switch (level) {
    case 'ambient':
      return 'latent';
    case 'committed':
      return 'saturated';
    case 'latent':
    case 'discovered':
    case 'engaged':
    case 'saturated':
      return level;
    default:
      return 'latent';
  }
}

function normalizeContentSource(source: string): BackendContentSource {
  switch (source) {
    case 'ai':
      return 'chat';
    case 'document':
      return 'pdf';
    case 'web':
    case 'pdf':
    case 'video':
    case 'chat':
    case 'note':
    case 'other':
      return source;
    default:
      return 'web';
  }
}
