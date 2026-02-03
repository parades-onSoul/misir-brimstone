/**
 * Backend Sync
 * 
 * Sends signals to the backend API.
 */

import type { Signal, ArtifactPayload, ApiResponse } from '../types';
import { getSettings } from '../store/settings';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_TIMEOUT_MS = 10000;
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

// ============================================================================
// API OPERATIONS
// ============================================================================

/**
 * Sync multiple signals to backend
 */
export async function syncSignals(signals: Signal[]): Promise<{
  success: boolean;
  syncedIds?: string[];
  error?: string;
}> {
  if (signals.length === 0) {
    return { success: true, syncedIds: [] };
  }
  
  const settings = await getSettings();
  const payloads = signals.map(signalToPayload);
  
  try {
    const response = await fetchWithRetry(
      `${settings.apiUrl}/signals/batch`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signals: payloads }),
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }
    
    await response.json();
    
    return {
      success: true,
      syncedIds: signals.map(s => s.id),
    };
    
  } catch (error) {
    console.error('[Sync] Failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    };
  }
}

/**
 * Sync a single signal (for manual captures)
 */
export async function syncSingleSignal(signal: Signal): Promise<ApiResponse> {
  const settings = await getSettings();
  const payload = signalToPayload(signal);
  
  try {
    const response = await fetchWithRetry(
      `${settings.apiUrl}/signals`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }
    
    const data = await response.json();
    return { success: true, data };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    };
  }
}

/**
 * Check backend connectivity
 */
export async function checkConnection(): Promise<{
  connected: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const settings = await getSettings();
  const start = Date.now();
  
  try {
    const baseUrl = new URL(settings.apiUrl).origin;
    const response = await fetch(`${baseUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    
    const latencyMs = Date.now() - start;
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return { connected: true, latencyMs };
    
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert Signal to ArtifactPayload for API
 * This is the strict schema the backend expects
 */
function signalToPayload(signal: Signal): ArtifactPayload {
  const payload: ArtifactPayload = {
    // 1. Context (The "What")
    url: signal.url,
    title: signal.title,
    domain: signal.domain || new URL(signal.url).hostname,
    captured_at: new Date(signal.capturedAt).toISOString(),
    
    // 2. Classification (The "Type")
    content_type: signal.contentType || 'article',
    source_platform: signal.sourcePlatform,
    
    // 3. Heuristics (The "Cost")
    metrics: {
      dwell_time_ms: signal.dwellTimeMs,
      adjusted_score_ms: signal.adjustedScoreMs || signal.dwellTimeMs,
      scroll_depth_percent: Math.round(signal.scrollDepth * 100),
      engagement_level: signal.artifactType,
    },
  };
  
  // 4. Semantics (The "Proof") - only for non-ambient
  if (signal.artifactType !== 'ambient' && signal.validation) {
    payload.validation = {
      word_count: signal.wordCount,
      paragraph_count: signal.validation.paragraphCount,
      confidence_score: signal.validation.confidenceScore,
    };
  }
  
  // 5. Content - only for engaged/committed
  if (signal.artifactType !== 'ambient') {
    payload.content = {
      full_text: signal.content.slice(0, 50000), // Limit size
      excerpt: signal.excerpt || signal.content.slice(0, 200),
    };
  }
  
  return payload;
}

/**
 * Fetch with retry logic
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  attempts = RETRY_ATTEMPTS
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let i = 1; i <= attempts; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      });
      
      // Don't retry client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        return response;
      }
      
      // Retry server errors (5xx)
      if (response.status >= 500 && i < attempts) {
        await delay(RETRY_DELAY_MS * i);
        continue;
      }
      
      return response;
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (i < attempts) {
        await delay(RETRY_DELAY_MS * i);
      }
    }
  }
  
  throw lastError || new Error('Request failed after retries');
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
