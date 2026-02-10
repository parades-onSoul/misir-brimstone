/**
 * Background Service Worker — "The Brain"
 *
 * Orchestrates the capture pipeline:
 *   1. Receives page data from content script
 *   2. Runs NLP classification pipeline
 *   3. Sends to backend API
 *   4. Stores recent captures locally
 *
 * Also handles:
 *   - Config management
 *   - Space fetching
 *   - Health checks
 *   - NLP status
 */

// Guard against service worker context issues
if (typeof window === 'undefined' || !window.addEventListener) {
  console.log('[Misir] Service worker context detected, initializing safely');
}

import { classifyPage, buildPayload } from '@/classify/pipeline';
import {
  fetchSpaces,
  captureArtifact,
  healthCheck,
  getConfig,
  setConfig,
} from '@/api/client';

// Lazy-load auth functions to avoid window access at module init time
let authFunctions: any = null;
async function getAuthFunctions() {
  if (!authFunctions) {
    authFunctions = await import('@/api/supabase');
  }
  return authFunctions;
}
import {
  addToQueue,
  processQueue,
  getQueue,
} from '@/storage/queue';
import type {
  ScrapedPage,
  ReadingMetrics,
  EngagementLevel,
  RecentCapture,
  SensorConfig,
  MessageResponse,
  CapturePayload,
} from '@/types';

// ── Recent Captures (local storage) ──────────────────

async function getRecentCaptures(): Promise<RecentCapture[]> {
  const result = await chrome.storage.local.get(['recentCaptures']);
  return result.recentCaptures || [];
}

async function addRecentCapture(capture: RecentCapture): Promise<void> {
  const recent = await getRecentCaptures();
  recent.unshift(capture);
  await chrome.storage.local.set({ recentCaptures: recent.slice(0, 30) });
}

// ── Message Handler ──────────────────────────────────

chrome.runtime.onMessage.addListener(
  (msg: { type: string;[key: string]: any }, _sender, sendResponse) => {
    const handler = async (): Promise<MessageResponse> => {
      try {
        switch (msg.type) {
          // ── Config ─────────────────────
          case 'GET_CONFIG': {
            const config = await getConfig();
            return { success: true, data: config };
          }

          case 'SET_CONFIG': {
            await setConfig(msg.config as Partial<SensorConfig>);
            return { success: true };
          }

          // ── Spaces ─────────────────────
          case 'FETCH_SPACES': {
            const spaces = await fetchSpaces();
            return { success: true, data: spaces };
          }

          // ── Capture Pipeline ───────────
          case 'CAPTURE': {
            const page = msg.page as ScrapedPage;
            const metrics = msg.metrics as ReadingMetrics;
            const engagement = msg.engagement as EngagementLevel;
            const spaceId = msg.spaceId as number;

            // 1. Run classification pipeline (NLP + heuristics)
            const classification = await classifyPage(page, metrics, engagement);

            // 2. Build payload
            const payload = buildPayload(spaceId, page, metrics, classification);

            try {
              // 3. Send to backend (backend handles Nomic 1.5 embedding)
              const result = await captureArtifact(payload);

              // 4. Store recent capture
              await addRecentCapture({
                url: page.url,
                title: page.title,
                domain: page.domain,
                spaceId,
                engagementLevel: classification.engagementLevel,
                contentType: classification.contentType,
                capturedAt: new Date().toISOString(),
              });

              return {
                success: true,
                data: {
                  ...result,
                  classification,
                  queued: false,
                },
              };
            } catch (error) {
              // API call failed — add to offline queue for retry
              const errorMsg = error instanceof Error ? error.message : 'Unknown error';
              const queueId = await addToQueue(payload, errorMsg);

              console.warn('[Misir BG] Capture failed, added to queue:', queueId, errorMsg);

              return {
                success: false,
                error: `Capture queued for retry: ${errorMsg}`,
                data: {
                  classification,
                  queued: true,
                  queueId,
                },
              };
            }
          }

          // ── Health Check ───────────────
          case 'HEALTH_CHECK': {
            const healthy = await healthCheck();
            return { success: true, data: { healthy } };
          }

          // ── Recent Captures ────────────
          case 'GET_RECENT': {
            const recent = await getRecentCaptures();
            return { success: true, data: recent };
          }

          // ── NLP Status ─────────────────
          case 'GET_NLP_STATUS': {
            const { isNLPReady } = await import('@/classify/nlp');
            const ready = await isNLPReady();
            return { success: true, data: { available: ready } };
          }

          // ── Classify (without capture) ─
          case 'CLASSIFY_CONTENT': {
            const pg = msg.page as ScrapedPage;
            const mt = msg.metrics as ReadingMetrics;
            const eng = msg.engagement as EngagementLevel;
            const cls = await classifyPage(pg, mt, eng);
            return { success: true, data: cls };
          }

          // ── Offline Queue Management ───
          case 'GET_QUEUE': {
            const queue = await getQueue();
            return { success: true, data: queue };
          }

          case 'PROCESS_QUEUE': {
            const result = await processQueue(captureArtifact);
            return { success: true, data: result };
          }

          case 'CLEAR_QUEUE': {
            const { clearQueue } = await import('@/storage/queue');
            await clearQueue();
            return { success: true };
          }

          // ── Auth ───────────────────────
          case 'SIGN_IN': {
            try {
              const auth = await getAuthFunctions();
              const result = await auth.signIn(
                msg.email as string,
                msg.password as string
              );
              return { success: true, data: result };
            } catch (err) {
              return {
                success: false,
                error: err instanceof Error ? err.message : 'Sign in failed',
              };
            }
          }

          case 'SIGN_OUT': {
            const auth = await getAuthFunctions();
            await auth.signOut();
            return { success: true };
          }

          case 'GET_AUTH_STATE': {
            const auth = await getAuthFunctions();
            const authState = await auth.getAuthState();
            return { success: true, data: authState };
          }

          case 'REFRESH_SESSION': {
            const auth = await getAuthFunctions();
            const refreshed = await auth.refreshSession();
            return {
              success: !!refreshed,
              data: refreshed,
              error: refreshed ? undefined : 'Refresh failed',
            };
          }

          // ── Supabase Data Fetching ─────
          case 'FETCH_SPACES_SUPABASE': {
            try {
              const auth = await getAuthFunctions();
              const spaces = await auth.fetchSpacesFromSupabase();
              return { success: true, data: spaces };
            } catch (err) {
              return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to fetch spaces',
              };
            }
          }

          case 'FETCH_SUBSPACES_SUPABASE': {
            try {
              const auth = await getAuthFunctions();
              const subspaces = await auth.fetchSubspacesFromSupabase(
                msg.spaceId as number
              );
              return { success: true, data: subspaces };
            } catch (err) {
              return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to fetch subspaces',
              };
            }
          }

          case 'FETCH_MARKERS_SUPABASE': {
            try {
              const auth = await getAuthFunctions();
              const markers = await auth.fetchMarkersFromSupabase(
                msg.spaceId as number
              );
              return { success: true, data: markers };
            } catch (err) {
              return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to fetch markers',
              };
            }
          }

          default:
            return { success: false, error: `Unknown: ${msg.type}` };
        }
      } catch (err) {
        console.error('[Misir BG]', err);
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        };
      }
    };

    handler().then(sendResponse);
    return true; // keep channel open for async
  }
);

// ── Install Handler ──────────────────────────────────

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Misir] Extension installed:', details.reason);
  if (details.reason === 'install') {
    // Initialize config WITHOUT userId — forces login screen
    // userId will be set by auth module after sign-in
    chrome.storage.local.set({
      apiUrl: 'http://localhost:8000/api/v1',
      enabled: true,
      minWordCount: 50,
      minDwellTimeMs: 3000,
      recentCaptures: [],
    });
  }
  // Attempt to process any queued captures after install/update
  processQueueIfOnline('onInstalled').catch(() => {});
});

// ── Offline Queue Processing (MV3-safe) ─────────────

function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

async function processQueueIfOnline(trigger: string): Promise<void> {
  if (!isOnline()) {
    console.log(`[Misir] Queue skipped (${trigger}): offline`);
    return;
  }
  try {
    const result = await processQueue(captureArtifact);
    if (result.processed > 0) {
      console.log('[Misir] Queue processed:', { trigger, ...result });
    }
  } catch (err) {
    console.error('[Misir] Failed to process queue:', err);
  }
}

chrome.runtime.onStartup.addListener(() => {
  processQueueIfOnline('onStartup').catch(() => {});
});

// ── Pulse alarm (keep service worker alive) ──────────

// Delay first pulse by 5 minutes to avoid network calls on startup
chrome.alarms.create('misir-pulse', { delayInMinutes: 5, periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'misir-pulse') {
    console.log('[Misir] Pulse ♥', new Date().toISOString());
    // Proactively refresh token if needed (silent fail)
    getAuthFunctions().then((auth) => {
      auth.refreshSession().catch((err: any) => {
        console.warn('[Misir] Pulse refresh failed:', err);
      });
    });
    processQueueIfOnline('alarm').catch(() => {});
  }
});

console.log('[Misir] Background service worker started');
