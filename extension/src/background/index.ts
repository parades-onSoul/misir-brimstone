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

// Import logger first
import { loggers } from '@/utils/logger';

// Guard against service worker context issues
if (typeof window === 'undefined' || !window.addEventListener) {
  loggers.background.debug('Service worker context detected, initializing safely');
}

import {
  fetchSpaces,
  captureArtifact,
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
import { calculateRelevance } from '@/utils/relevance-scorer';
import type {
  ScrapedPage,
  ReadingMetrics,
  EngagementLevel,
  ClassificationResult,
  RecentCapture,
  SensorConfig,
  MessageResponse,
  CapturePayload,
  Marker,
} from '@/types';

// ── Marker Cache ─────────────────────────────────────

const MARKER_CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes
const markerCache: Record<number, { markers: Marker[]; timestamp: number }> = {};

async function getCachedMarkers(spaceId: number): Promise<Marker[]> {
  const now = Date.now();
  const cached = markerCache[spaceId];

  if (cached && (now - cached.timestamp < MARKER_CACHE_TTL_MS)) {
    return cached.markers;
  }

  try {
    const markers = await auth.fetchMarkersFromSupabase(spaceId);
    markerCache[spaceId] = { markers, timestamp: now };
    return markers;
  } catch (error) {
    loggers.background.warn('Failed to fetch markers', { spaceId, error });
    return cached ? cached.markers : []; // Return stale if avail, else empty
  }
}

// ── Recent Captures (local storage) ──────────────────

async function getRecentCaptures(): Promise<RecentCapture[]> {
  const result = await chrome.storage.local.get(['recentCaptures']);
  return result.recentCaptures || [];
}

async function addRecentCapture(capture: RecentCapture): Promise<void> {
  const recent = await getRecentCaptures();
  recent.unshift(capture);
  const truncated = recent.slice(0, 30);
  await chrome.storage.local.set({ recentCaptures: truncated });
  loggers.background.debug('Stored recent capture', { 
    url: capture.url, 
    totalRecent: truncated.length,
    spaceId: capture.spaceId 
  });
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

async function ensureContentScript(tabId: number): Promise<boolean> {
  try {
    const manifest = chrome.runtime.getManifest();
    const contentScriptFile = manifest.content_scripts?.[0]?.js?.[0];
    if (!contentScriptFile) {
      loggers.background.warn('Content script file not found in manifest');
      return false;
    }
    
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [contentScriptFile],
    });
    
    loggers.background.debug('Content script injected successfully', { tabId });
    return true;
  } catch (error) {
    loggers.background.warn('Failed to inject content script', { 
      tabId, 
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

async function scrapeTabWithFallback(
  tabId: number
): Promise<{ page: ScrapedPage; metrics: ReadingMetrics; engagement: EngagementLevel } | null> {
  try {
    // Attempt 1: Direct message (content script may already be loaded)
    const resp = await chrome.tabs.sendMessage(tabId, { type: 'SCRAPE_PAGE' });
    if (resp?.success && resp.data) {
      loggers.capture.debug('Page scraped successfully (content script already loaded)');
      return resp.data;
    }
  } catch (firstError) {
    loggers.capture.debug('First scrape attempt failed, trying injection...', {
      error: firstError instanceof Error ? firstError.message : String(firstError)
    });
  }

  // Attempt 2: Inject content script and retry
  try {
    const injected = await ensureContentScript(tabId);
    if (!injected) {
      loggers.capture.warn('Failed to inject content script');
      return null;
    }

    // Wait for content script to initialize
    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      const retryResp = await chrome.tabs.sendMessage(tabId, { type: 'SCRAPE_PAGE' });
      if (retryResp?.success && retryResp.data) {
        loggers.capture.debug('Page scraped successfully (after injection)');
        return retryResp.data;
      }
    } catch (retryError) {
      loggers.capture.warn('Scrape failed even after injection', {
        error: retryError instanceof Error ? retryError.message : String(retryError)
      });
      return null;
    }
  } catch (injectionError) {
    loggers.capture.warn('Content script injection failed', {
      error: injectionError instanceof Error ? injectionError.message : String(injectionError)
    });
    return null;
  }

  return null;
}

async function resolveAutoCaptureSpaceId(
  config: SensorConfig,
  pageSummary?: { content: string; title: string; url: string }
): Promise<number | null> {
  try {
    const spaces = await fetchSpaces();
    if (spaces.length === 0) return null;

    // If no page content available, fallback to most recent space or pinned space
    if (!pageSummary) {
      // Prefer pinned space if configured and still exists
      if (typeof config.autoCaptureSpaceId === 'number' && config.autoCaptureSpaceId > 0) {
        const pinnedExists = spaces.some(s => s.id === config.autoCaptureSpaceId);
        if (pinnedExists) {
          return config.autoCaptureSpaceId;
        }
      }
      // Otherwise use most recent
      return spaces[0]?.id || null;
    }

    // Smart Resolution: Check relevance against ALL spaces
    // This allows "automatic" detection of the correct space
    let bestSpaceId = spaces[0].id;
    let maxConfidence = -1;
    let bestSpaceHasMarkers = false;

    for (const space of spaces) {
      try {
        const markers = await getCachedMarkers(space.id);
        const hasMarkers = markers.length > 0;
        
        const score = calculateRelevance(
          pageSummary.content,
          pageSummary.title,
          pageSummary.url,
          markers
        );

        // Prefer spaces with markers and higher confidence
        if (score.confidence > maxConfidence) {
          maxConfidence = score.confidence;
          bestSpaceId = space.id;
          bestSpaceHasMarkers = hasMarkers;
        }
      } catch (err) {
        // Continue checking others
      }
    }

    // If we found a good match (space with markers and decent confidence), use it
    // This ensures multi-space users get intelligent routing instead of pinned-space dominance
    if (bestSpaceHasMarkers && maxConfidence > 0.1) {
      loggers.background.debug('Auto-capture routed to best-match space', {
        spaceId: bestSpaceId,
        confidence: maxConfidence,
      });
      return bestSpaceId;
    }

    // Fallback: use pinned space if configured, otherwise use most recent
    if (typeof config.autoCaptureSpaceId === 'number' && config.autoCaptureSpaceId > 0) {
      const pinnedExists = spaces.some(s => s.id === config.autoCaptureSpaceId);
      if (pinnedExists) {
        loggers.background.debug('Auto-capture using pinned space (no good match found)', {
          spaceId: config.autoCaptureSpaceId,
        });
        return config.autoCaptureSpaceId;
      }
    }

    // Last resort: most recent space
    return spaces[0]?.id || null;

  } catch (err) {
    // Ignore auth/network failures
    loggers.background.warn('Failed to resolve auto-capture space', { err });
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

  // SCRAPE FIRST to get content for smart resolution
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
    loggers.capture.debug('Auto-capture skipped: failed to scrape page', { url: tab.url });
    return;
  }

  const { page, metrics, engagement } = scraped;

  // NOW resolve space using the scraped content
  const spaceId = await resolveAutoCaptureSpaceId(config, page);
  if (!spaceId) {
    loggers.capture.debug('Auto-capture skipped: no space configured');
    return;
  }

  if (page.wordCount < config.minWordCount) {
    loggers.capture.debug('Auto-capture skipped: word count too low', {
      url: page.url,
      wordCount: page.wordCount,
      minRequired: config.minWordCount
    });
    return;
  }
  if (metrics.dwellTimeMs < config.minDwellTimeMs) {
    loggers.capture.debug('Auto-capture skipped: dwell time too short', {
      url: page.url,
      dwellTime: metrics.dwellTimeMs,
      minRequired: config.minDwellTimeMs
    });
    return;
  }

  // Cooldown removed per user request - allow continuous updates
  // const cooldownMs = Math.max(60000, config.autoCaptureCooldownMs || 1800000);
  // if (await isInAutoCaptureCooldown(spaceId, page.url, cooldownMs)) {
  //   return;
  // }

  // ── Local Relevance Scoring ──
  // Replaces backend classification

  let classification: ClassificationResult;
  let markers: Marker[] = [];

  try {
    markers = await getCachedMarkers(spaceId);

    // 1. Calculate relevance locally
    const relevance = calculateRelevance(
      page.content, // Use full text content
      page.title,
      page.url,
      markers
    );

    loggers.capture.debug('Local relevance score', {
      url: page.url,
      confidence: relevance.confidence,
      matched: relevance.matchedMarkers
    });

    if (relevance.confidence < config.autoCaptureConfidenceThreshold) {
      loggers.capture.debug('Auto-capture skipped: confidence below threshold', {
        url: page.url,
        confidence: relevance.confidence,
        threshold: config.autoCaptureConfidenceThreshold,
        reason: relevance.matchedMarkers.length === 0 ? 'No markers matched' : 'Low total weight'
      });
      return;
    }

    // 2. Construct classification result locally
    // We assume 'article' and 'web' for now as we lack local classifier for types
    classification = {
      engagementLevel: engagement, // Trust the client's dwell/scroll engagement
      contentSource: 'web',
      contentType: 'article',
      readingDepth: metrics.readingDepth,
      confidence: relevance.confidence,
      keywords: relevance.matchedMarkers,
      nlpAvailable: true,
    };

  } catch (error) {
    loggers.capture.warn('Local scoring failed, skipping capture', { error });
    return;
  }



  // Latent check removed per user request - capture instantly if relevant
  // if (classification.engagementLevel === 'latent') {
  //   return;
  // }

  const payload = buildCapturePayload(spaceId, page, metrics, classification);
  try {
    await captureArtifact(payload);
    const capture: RecentCapture = {
      url: page.url,
      title: page.title,
      domain: page.domain,
      spaceId,
      engagementLevel: classification.engagementLevel,
      contentType: classification.contentType,
      capturedAt: new Date().toISOString(),
    };
    await addRecentCapture(capture);
    
    // Notify popup if it's open
    notifyPopupsOfCapture(capture);
    
    loggers.capture.info('Auto-captured relevant page', {
      url: page.url,
      confidence: classification.confidence,
      spaceId,
      engagement: classification.engagementLevel,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const queueId = await addToQueue(payload, errorMsg);
    loggers.queue.warn('Auto-capture failed, added to queue', { queueId, error: errorMsg });
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

/**
 * Notify all open popups that a capture completed
 * This ensures the UI updates in real-time
 */
function notifyPopupsOfCapture(capture: RecentCapture) {
  try {
    chrome.runtime.sendMessage({
      type: 'CAPTURE_COMPLETED',
      data: capture,
    }).catch(() => {
      // Ignore if popup not open - this is expected
    });
  } catch (err) {
    // Silently ignore - pop may not be open
  }
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

            // 1. Run local relevance scoring
            let classification: ClassificationResult;
            try {
              const markers = await getCachedMarkers(spaceId);
              const relevance = calculateRelevance(page.content, page.title, page.url, markers);

              classification = {
                engagementLevel: engagement,
                contentSource: 'web',
                contentType: 'article',
                readingDepth: metrics.readingDepth,
                confidence: relevance.confidence,
                keywords: relevance.matchedMarkers,
                nlpAvailable: true,
              };
            } catch (error) {
              loggers.capture.warn('Local scoring failed, using fallback', { error });
              classification = fallbackClassification(metrics, engagement);
            }

            // 2. Build payload
            const payload = buildCapturePayload(spaceId, page, metrics, classification);

            try {
              // 3. Send to backend (backend handles Nomic 1.5 embedding)
              const result = await captureArtifact(payload);

              // 4. Store recent capture
              const capture: RecentCapture = {
                url: page.url,
                title: page.title,
                domain: page.domain,
                spaceId,
                engagementLevel: classification.engagementLevel,
                contentType: classification.contentType,
                capturedAt: new Date().toISOString(),
              };
              await addRecentCapture(capture);

              // 5. Notify popup if it's open
              notifyPopupsOfCapture(capture);

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

              loggers.queue.warn('Capture failed, added to queue', { queueId, error: errorMsg });

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
            // Always available clients-side now
            return {
              success: true,
              data: { available: true, mode: 'client-wink-nlp' }
            };
          }

          // ── Classify (without capture) ─
          case 'CLASSIFY_CONTENT': {
            const pg = msg.page as ScrapedPage;
            const mt = msg.metrics as ReadingMetrics;
            const eng = msg.engagement as EngagementLevel;
            let cls: ClassificationResult;

            // Best-effort local scoring: try to use auto-capture space
            try {
              const config = await getConfig();
              const spaceId = await resolveAutoCaptureSpaceId(config, pg);

              if (spaceId) {
                const markers = await getCachedMarkers(spaceId);
                const relevance = calculateRelevance(pg.content, pg.title, pg.url, markers);
                cls = {
                  engagementLevel: eng,
                  contentSource: 'web',
                  contentType: 'article',
                  readingDepth: mt.readingDepth,
                  confidence: relevance.confidence,
                  keywords: relevance.matchedMarkers,
                  nlpAvailable: true,
                };
              } else {
                cls = fallbackClassification(mt, eng);
              }
            } catch (error) {
              loggers.capture.warn('Local scoring failed in CLASSIFY_CONTENT', { error });
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

          // ── Auto-detect best space based on page content ─────
          case 'GET_BEST_SPACE': {
            try {
              const config = await getConfig();
              const pageSummary = msg.page as { content: string; title: string; url: string };
              const bestSpaceId = await resolveAutoCaptureSpaceId(config, pageSummary);
              return { success: true, data: bestSpaceId };
            } catch (err) {
              return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to get best space',
              };
            }
          }

          default:
            return { success: false, error: `Unknown: ${msg.type}` };
        }
      } catch (err) {
        loggers.background.error('Background error', { error: err });
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
        loggers.capture.warn('Instant capture failed', { error: err });
      });
    }, 3000);
  }
});

// ── Offline Queue Processing (MV3-safe) ─────────────

function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

async function processQueueIfOnline(trigger: string): Promise<void> {
  if (!isOnline()) {
    loggers.queue.debug('Queue skipped: offline', { trigger });
    return;
  }
  try {
    const result = await processQueue(captureArtifact);
    if (result.processed > 0) {
      loggers.queue.info('Queue processed', { trigger, ...result });
    }
  } catch (err) {
    loggers.queue.error('Failed to process queue', { error: err });
  }

  try {
    await runAutoCaptureCycle();
  } catch (err) {
    loggers.background.error('Auto-capture cycle failed', { error: err });
  }
}

// ── Pulse alarm (keep service worker alive) ──────────

async function setupPulse() {
  const alarm = await chrome.alarms.get('misir-pulse');
  if (!alarm) {
    // 1 min delay, 1 min period
    chrome.alarms.create('misir-pulse', { delayInMinutes: 1, periodInMinutes: 1 });
    loggers.background.debug('Pulse alarm created');
  }
}

chrome.runtime.onInstalled.addListener(() => {
  loggers.background.info('Extension installed');
  processQueueIfOnline('onInstalled').catch(() => { });
  setupPulse().catch(err => loggers.background.warn('Failed to setup pulse', { error: err }));

  // Initialize config if fresh install
  chrome.storage.local.get(['enabled'], (result) => {
    if (result.enabled === undefined) {
      chrome.storage.local.set({
        apiUrl: 'http://localhost:8000/api/v1',
        enabled: true,
        minWordCount: 50,
        minDwellTimeMs: 3000,
        autoCaptureEnabled: false,
        autoCaptureConfidenceThreshold: 0.50,
        autoCaptureCooldownMs: 0,
        recentCaptures: [],
      });
    }
  });
});

chrome.runtime.onStartup.addListener(() => {
  processQueueIfOnline('onStartup').catch(() => { });
  setupPulse().catch(() => { });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'misir-pulse') {
    loggers.background.debug('Pulse ♥', { timestamp: new Date().toISOString() });
    auth.refreshSession().catch((err: any) => {
      loggers.background.warn('Pulse refresh failed', { error: err });
    });
    // Triggers auto-capture cycle to update metrics for active tabs
    processQueueIfOnline('alarm').catch(() => { });
  }
});

loggers.background.info('Background service worker started');
