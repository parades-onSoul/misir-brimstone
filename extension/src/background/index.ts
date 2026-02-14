/**
 * Background Service Worker — "The Brain"
 *
 * Orchestrates the capture pipeline:
 *   1. Receives page data from content script
 *   2. Runs backend classification pipeline
 *   3. Sends to backend API
 *   4. Stores recent captures locally
 *
 * Also handles:
 *   - Config management
 *   - Space fetching
 *   - Health checks
 *   - Classifier status
 */

// Guard against service worker context issues
if (typeof window === 'undefined' || !window.addEventListener) {
  console.log('[Misir] Service worker context detected, initializing safely');
}

import {
  fetchSpaces,
  captureArtifact,
  classifyContent,
  getClassifierStatus,
  healthCheck,
  getConfig,
  setConfig,
} from '@/api/client';
import {
  addToQueue,
  processQueue,
  getQueue,
  clearQueue,
} from '@/storage/queue';
import * as auth from '@/api/supabase';
import type {
  ScrapedPage,
  ReadingMetrics,
  EngagementLevel,
  ClassificationResult,
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

function normalizeUrlForDedup(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    u.hash = '';
    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      'ref',
      'fbclid',
      'gclid',
    ];
    for (const param of trackingParams) {
      u.searchParams.delete(param);
    }
    return u.toString().replace(/\/$/, '');
  } catch {
    return rawUrl;
  }
}

function isHttpUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

function isSystemPage(url: string): boolean {
  try {
    const u = new URL(url);
    // Block local app development and production app
    if (u.hostname === 'localhost' && u.port === '3000') return true;
    if (u.hostname === 'misir.app') return true;
    if (u.hostname.endsWith('.misir.app')) return true;
    return false;
  } catch {
    return false;
  }
}

async function ensureContentScript(tabId: number): Promise<void> {
  const manifest = chrome.runtime.getManifest();
  const contentScriptFile = manifest.content_scripts?.[0]?.js?.[0];
  if (!contentScriptFile) return;
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [contentScriptFile],
  });
}

async function scrapeTabWithFallback(
  tabId: number
): Promise<{ page: ScrapedPage; metrics: ReadingMetrics; engagement: EngagementLevel } | null> {
  try {
    const resp = await chrome.tabs.sendMessage(tabId, { type: 'SCRAPE_PAGE' });
    if (resp?.success && resp.data) {
      return resp.data;
    }
  } catch {
    // Continue to injection fallback.
  }

  try {
    await ensureContentScript(tabId);
    await new Promise((resolve) => setTimeout(resolve, 200));
    const retryResp = await chrome.tabs.sendMessage(tabId, { type: 'SCRAPE_PAGE' });
    if (retryResp?.success && retryResp.data) {
      return retryResp.data;
    }
  } catch {
    return null;
  }

  return null;
}

async function resolveAutoCaptureSpaceId(config: SensorConfig): Promise<number | null> {
  if (typeof config.autoCaptureSpaceId === 'number' && config.autoCaptureSpaceId > 0) {
    return config.autoCaptureSpaceId;
  }

  try {
    const spaces = await fetchSpaces();
    if (spaces.length === 1) {
      await setConfig({ autoCaptureSpaceId: spaces[0].id });
      return spaces[0].id;
    }
  } catch {
    // Ignore auth/network failures and skip auto capture.
  }

  return null;
}

async function isInAutoCaptureCooldown(
  spaceId: number,
  url: string,
  cooldownMs: number
): Promise<boolean> {
  const normalized = normalizeUrlForDedup(url);
  const recent = await getRecentCaptures();
  const now = Date.now();

  for (const item of recent) {
    if (item.spaceId !== spaceId) continue;
    if (normalizeUrlForDedup(item.url) !== normalized) continue;
    const capturedAt = new Date(item.capturedAt).getTime();
    if (!Number.isFinite(capturedAt)) continue;
    if (now - capturedAt < cooldownMs) {
      return true;
    }
  }

  return false;
}

async function runAutoCaptureCycle(): Promise<void> {
  const config = await getConfig();
  if (!config.enabled || !config.autoCaptureEnabled) {
    return;
  }

  const spaceId = await resolveAutoCaptureSpaceId(config);
  if (!spaceId) {
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabUrl = tab?.url ?? tab?.pendingUrl ?? '';
  if (!tab?.id || !tabUrl || !isHttpUrl(tabUrl)) {
    return;
  }

  if (isSystemPage(tabUrl)) {
    return;
  }

  const scraped = await scrapeTabWithFallback(tab.id);
  if (!scraped) {
    return;
  }

  const { page, metrics, engagement } = scraped;
  if (page.wordCount < config.minWordCount) {
    return;
  }
  if (metrics.dwellTimeMs < config.minDwellTimeMs) {
    return;
  }

  // Cooldown removed per user request - allow continuous updates
  // const cooldownMs = Math.max(60000, config.autoCaptureCooldownMs || 1800000);
  // if (await isInAutoCaptureCooldown(spaceId, page.url, cooldownMs)) {
  //   return;
  // }

  let classification: ClassificationResult;
  try {
    classification = await classifyContent(page, metrics, engagement);
  } catch (error) {
    console.warn('[Misir BG] Auto-capture classify failed, using fallback', error);
    classification = fallbackClassification(metrics, engagement);
  }

  if (classification.confidence < config.autoCaptureConfidenceThreshold) {
    return;
  }

  // Latent check removed per user request - capture instantly if relevant
  // if (classification.engagementLevel === 'latent') {
  //   return;
  // }

  const payload = buildCapturePayload(spaceId, page, metrics, classification);
  try {
    await captureArtifact(payload);
    await addRecentCapture({
      url: page.url,
      title: page.title,
      domain: page.domain,
      spaceId,
      engagementLevel: classification.engagementLevel,
      contentType: classification.contentType,
      capturedAt: new Date().toISOString(),
    });
    console.log('[Misir BG] Auto-captured relevant page', {
      spaceId,
      url: page.url,
      confidence: classification.confidence,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const queueId = await addToQueue(payload, errorMsg);
    console.warn('[Misir BG] Auto-capture failed, added to queue:', queueId, errorMsg);
  }
}

function buildCapturePayload(
  spaceId: number,
  page: ScrapedPage,
  metrics: ReadingMetrics,
  classification: Pick<ClassificationResult, 'engagementLevel' | 'contentSource' | 'readingDepth'>
): CapturePayload {
  return {
    space_id: spaceId,
    url: page.url,
    title: page.title,
    content: page.content.substring(0, 30000),
    reading_depth: classification.readingDepth,
    scroll_depth: metrics.scrollDepth,
    dwell_time_ms: metrics.dwellTimeMs,
    word_count: page.wordCount,
    engagement_level: classification.engagementLevel,
    content_source: classification.contentSource,
  };
}

function fallbackClassification(
  metrics: ReadingMetrics,
  engagement: EngagementLevel
): ClassificationResult {
  return {
    engagementLevel: engagement,
    contentSource: 'web' as const,
    contentType: 'article' as const,
    readingDepth: metrics.readingDepth,
    confidence: 0.2,
    keywords: [] as string[],
    nlpAvailable: false,
  };
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

            // 1. Run backend classification
            let classification: ClassificationResult;
            try {
              classification = await classifyContent(page, metrics, engagement);
            } catch (error) {
              console.warn('[Misir BG] Backend classify failed, using fallback', error);
              classification = fallbackClassification(metrics, engagement);
            }

            // 2. Build payload
            const payload = buildCapturePayload(spaceId, page, metrics, classification);

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
            const status = await getClassifierStatus();
            return { success: true, data: status };
          }

          // ── Classify (without capture) ─
          case 'CLASSIFY_CONTENT': {
            const pg = msg.page as ScrapedPage;
            const mt = msg.metrics as ReadingMetrics;
            const eng = msg.engagement as EngagementLevel;
            let cls: ClassificationResult;
            try {
              cls = await classifyContent(pg, mt, eng);
            } catch (error) {
              console.warn('[Misir BG] CLASSIFY_CONTENT failed, using fallback', error);
              cls = fallbackClassification(mt, eng);
            }
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
            await clearQueue();
            return { success: true };
          }

          // ── Auth ───────────────────────
          case 'SIGN_IN': {
            try {
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
            await auth.signOut();
            return { success: true };
          }

          case 'GET_AUTH_STATE': {
            const authState = await auth.getAuthState();
            return { success: true, data: authState };
          }

          case 'REFRESH_SESSION': {
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

// ── Instant Capture Trigger ──────────────────────────

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    // Wait a brief moment for dynamic content/readability
    setTimeout(() => {
      runAutoCaptureCycle().catch(err => {
        console.warn('[Misir BG] Instant capture failed:', err);
      });
    }, 3000);
  }
});

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
      autoCaptureEnabled: false,
      autoCaptureConfidenceThreshold: 0.50,
      autoCaptureCooldownMs: 0, // Default to continuous updates
      recentCaptures: [],
    });
  }
  // Attempt to process any queued captures after install/update
  processQueueIfOnline('onInstalled').catch(() => { });
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

  try {
    await runAutoCaptureCycle();
  } catch (err) {
    console.error('[Misir] Auto-capture cycle failed:', err);
  }
}

chrome.runtime.onStartup.addListener(() => {
  processQueueIfOnline('onStartup').catch(() => { });
});

// ── Pulse alarm (keep service worker alive) ──────────

// Delay first pulse by 5 minutes to avoid network calls on startup
chrome.alarms.create('misir-pulse', { delayInMinutes: 5, periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'misir-pulse') {
    console.log('[Misir] Pulse ♥', new Date().toISOString());
    // Proactively refresh token if needed (silent fail)
    auth.refreshSession().catch((err: any) => {
      console.warn('[Misir] Pulse refresh failed:', err);
    });
    processQueueIfOnline('alarm').catch(() => { });
  }
});

console.log('[Misir] Background service worker started');
