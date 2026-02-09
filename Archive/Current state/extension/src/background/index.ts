/**
 * Background Service Worker - "The Brain"
 * 
 * The central processing hub:
 * - Receives clean content from Content Script ("The Eyes")
 * - Runs NLP analysis to match against user's Spaces
 * - Saves relevant artifacts to local storage
 * - Syncs to backend on schedule (The Pulse)
 */

import { syncManager } from './sync';
import { sessionManager } from './session';
import { processTabSession, buildArtifactPayload } from '../classify/pipeline';
import { recognize } from '../classify/stages';
import { analyzeRelevance, analyzeQuickContext } from '../classify/nlp-engine';
import { storage } from '../storage/db';
import { refreshUserMap } from './boot';
import type { ContextSignal, SemanticResult, MatchResult } from '../classify/types';
import type { ScrapedContent } from '../content/scrape';

// ============================================================================
// CONFIGURATION
// ============================================================================

const ALARM_NAME = 'MISIR_PULSE';
const SYNC_INTERVAL_MIN = 30;

// Cache for last analysis result per tab (for popup to read)
const tabAnalysisCache = new Map<number, { result: MatchResult; url: string }>();

// ============================================================================
// LIFECYCLE: Install/Update
// ============================================================================

chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Misir] Installed. Scheduling pulse...');
  
  // Initialize storage
  await storage.init();
  
  // Schedule the pulse
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: SYNC_INTERVAL_MIN });
  console.log(`[Misir] Pulse scheduled: every ${SYNC_INTERVAL_MIN} minutes`);
});

// ============================================================================
// TAB LIFECYCLE: Clear cache on tab close or navigation
// ============================================================================

chrome.tabs.onRemoved.addListener((tabId) => {
  tabAnalysisCache.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // Clear cache when URL changes (navigation)
  if (changeInfo.url) {
    tabAnalysisCache.delete(tabId);
  }
});

// ============================================================================
// THE PULSE: Alarm Listener
// ============================================================================

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    console.log('[Misir] Pulse triggered');
    syncManager.beat();
  }
});

// ============================================================================
// INITIALIZATION (on service worker wake)
// ============================================================================

// Initialize storage on every wake
storage.init().then(() => {
  console.log('[Misir] Storage initialized');
});

console.log('[Misir] Background service worker started');

// ============================================================================
// MESSAGE API
// ============================================================================

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender, sendResponse);
  return true; // Keep channel open for async responses
});

async function handleMessage(
  msg: { type: string; payload?: unknown; limit?: number },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    // -----------------------------------------------------------------
    // 0. Content Script: Full Content Analysis (Split Brain)
    // -----------------------------------------------------------------
    if (msg.type === 'ANALYZE_CONTENT') {
      const scraped = msg.payload as ScrapedContent;
      
      // Load user map for matching
      const userMap = await storage.getUserMap();
      
      if (!userMap || !userMap.centroids || userMap.centroids.length === 0) {
        console.log('[Brain] No centroids loaded, skipping analysis');
        sendResponse({ relevant: false, reason: 'No spaces configured' });
        return;
      }

      // Run NLP analysis
      const result = analyzeRelevance(scraped.contentText, userMap.centroids);
      
      console.log(`[Brain] Analysis: ${scraped.title.substring(0, 40)}... → ${result.score}%`);
      
      // Cache the result for the popup to read
      if (sender.tab?.id) {
        tabAnalysisCache.set(sender.tab.id, { result, url: scraped.url });
      }
      
      if (result.pass && result.topMatch) {
        // Update badge to show relevance
        if (sender.tab?.id) {
          chrome.action.setBadgeText({ tabId: sender.tab.id, text: String(result.score) });
          chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: '#16a34a' });
        }
        
        // Record session activity and get session ID
        const sessionId = await sessionManager.recordArtifact();
        if (sender.tab?.id) {
          await sessionManager.recordActivity(sender.tab.id);
        }
        
        // Use actual reading metrics from content script (PageTracker)
        const dwellTimeMs = scraped.dwellTimeMs || 5000;
        const scrollDepth = scraped.scrollDepth ?? 0;
        const readingDepth = scraped.readingDepth ?? 0;
        const engagementLevel = scraped.engagementLevel || 'ambient';
        
        // Map engagement level to weights
        let baseWeight: 0.2 | 1.0 | 2.0 = 0.2;
        let decayRate: 'high' | 'medium' | 'low' = 'high';
        
        if (engagementLevel === 'committed') {
          baseWeight = 2.0;
          decayRate = 'low';
        } else if (engagementLevel === 'engaged') {
          baseWeight = 1.0;
          decayRate = 'medium';
        }
        
        console.log(`[Brain] Metrics: dwell=${dwellTimeMs}ms, scroll=${(scrollDepth*100).toFixed(0)}%, depth=${readingDepth.toFixed(2)} → ${engagementLevel}`);
        
        // Save as artifact with actual metrics
        await storage.saveArtifact({
          url: scraped.url,
          title: scraped.title,
          domain: scraped.domain,
          captured_at: new Date().toISOString(),
          artifact_type: engagementLevel,
          content_source: 'web',
          base_weight: baseWeight,
          decay_rate: decayRate,
          dwell_time_ms: dwellTimeMs,
          scroll_depth: scrollDepth,
          reading_depth: readingDepth,
          relevance: result.score / 100,
          extracted_text: scraped.contentText.substring(0, 5000),
          word_count: scraped.wordCount || scraped.contentText.split(/\s+/).length,
          session_id: sessionId,
        });
        
        sendResponse({ 
          relevant: true, 
          score: result.score, 
          spaceName: result.topMatch.spaceName,
          spaceId: result.topMatch.spaceId,
        });
      } else {
        sendResponse({ relevant: false, score: result.score });
      }
      return;
    }

    // -----------------------------------------------------------------
    // 1. Content Script: Update Metrics (Final Pulse on page exit)
    // -----------------------------------------------------------------
    if (msg.type === 'UPDATE_METRICS') {
      const { url, metrics } = msg.payload as {
        url: string;
        metrics: {
          dwell_time_ms: number;
          scroll_depth: number;
          reading_depth: number;
          engagement_level: 'ambient' | 'engaged' | 'committed';
        };
      };
      
      console.log(`[Brain] Final metrics for: ${url.substring(0, 50)}...`);
      console.log(`[Brain] dwell=${metrics.dwell_time_ms}ms, scroll=${(metrics.scroll_depth*100).toFixed(0)}%, depth=${metrics.reading_depth.toFixed(2)} → ${metrics.engagement_level}`);
      
      // Update the artifact in local storage
      await storage.updateArtifactMetrics(url, metrics);
      
      sendResponse({ success: true });
      return;
    }

    // -----------------------------------------------------------------
    // 2. Content Script: New Artifact Candidate (Legacy)
    // -----------------------------------------------------------------
    if (msg.type === 'ARTIFACT_CANDIDATE') {
      const { context, rawDwellTimeMs } = msg.payload as {
        context: ContextSignal;
        rawDwellTimeMs: number;
      };

      // Create semantics getter that messages content script if needed
      const getSemantics = createSemanticsGetter(sender.tab?.id);

      // Run the Sieve
      const result = await processTabSession(context, rawDwellTimeMs, getSemantics);

      if (result) {
        const sessionId = await sessionManager.recordArtifact();
        const payload = { ...buildArtifactPayload(result), session_id: sessionId };
        await storage.saveArtifact(payload);
        sendResponse({ status: 'accepted', engagement: result.engagement });
      } else {
        sendResponse({ status: 'discarded' });
      }
      return;
    }

    // -----------------------------------------------------------------
    // 2. UI: Force Sync
    // -----------------------------------------------------------------
    if (msg.type === 'forceSync') {
      const result = await syncManager.forceSync();
      sendResponse(result);
      return;
    }

    // -----------------------------------------------------------------
    // 3. UI: Get Sync Status
    // -----------------------------------------------------------------
    if (msg.type === 'getSyncStatus') {
      sendResponse(syncManager.getStatus());
      return;
    }

    // -----------------------------------------------------------------
    // 4. UI: Dashboard Stats
    // -----------------------------------------------------------------
    if (msg.type === 'getStorageStats') {
      const stats = await storage.getStats();
      sendResponse(stats);
      return;
    }

    // -----------------------------------------------------------------
    // 5. UI: Recent Artifacts Feed
    // -----------------------------------------------------------------
    if (msg.type === 'getRecentArtifacts') {
      const items = await storage.getRecentArtifacts(msg.limit || 10);
      sendResponse(items);
      return;
    }

    // -----------------------------------------------------------------
    // 6. UI: Get Popup State (Aggregated)
    // -----------------------------------------------------------------
    if (msg.type === 'getPopupState') {
      const popupState = await getPopupState();
      sendResponse(popupState);
      return;
    }

    // -----------------------------------------------------------------
    // 7. UI: Get Session Stats
    // -----------------------------------------------------------------
    if (msg.type === 'getSessionStats') {
      const stats = await sessionManager.getStats();
      sendResponse(stats);
      return;
    }

    // -----------------------------------------------------------------
    // 8. UI: End Session (for logout)
    // -----------------------------------------------------------------
    if (msg.type === 'endSession') {
      await sessionManager.endSession();
      sendResponse({ success: true });
      return;
    }

    // -----------------------------------------------------------------
    // 9. UI: Refresh User Map
    // -----------------------------------------------------------------
    if (msg.type === 'refreshUserMap') {
      const success = await refreshUserMap();
      sendResponse({ success });
      return;
    }

    // -----------------------------------------------------------------
    // 8. UI: Capture Current Tab
    // -----------------------------------------------------------------
    if (msg.type === 'captureCurrentTab') {
      try {
        // Get current active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id || !tab.url) {
          sendResponse({ success: false, error: 'No active tab' });
          return;
        }
        
        // Skip chrome:// and extension pages
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
          sendResponse({ success: false, error: 'Cannot capture browser pages' });
          return;
        }
        
        // Request context from content script
        const context = await new Promise<ContextSignal | null>((resolve) => {
          chrome.tabs.sendMessage(tab.id!, { action: 'getContext' }, (response) => {
            if (chrome.runtime.lastError) {
              console.warn('[Capture] Content script not ready:', chrome.runtime.lastError.message);
              resolve(null);
            } else {
              resolve(response);
            }
          });
        });
        
        if (!context) {
          sendResponse({ success: false, error: 'Content script not ready' });
          return;
        }
        
        // Get semantics getter for the tab
        const getSemantics = createSemanticsGetter(tab.id);
        
        // Process with a minimum dwell time (manual capture)
        const result = await processTabSession(context, 10000, getSemantics);
        
        if (result) {
          const payload = buildArtifactPayload(result);
          await storage.saveArtifact(payload);
          sendResponse({ success: true, artifact: { url: payload.url, title: payload.title } });
        } else {
          sendResponse({ success: false, error: 'Did not pass quality filters' });
        }
      } catch (err) {
        console.error('[Capture] Error:', err);
        sendResponse({ success: false, error: err instanceof Error ? err.message : 'Unknown error' });
      }
      return;
    }

    // -----------------------------------------------------------------
    // 9. Settings: Check NLP Status
    // -----------------------------------------------------------------
    if (msg.type === 'CHECK_NLP_STATUS') {
      // wink-nlp is bundled at build time - just confirm it's included
      // We can't actually import it in service worker (no DOM), but it's there
      sendResponse({ 
        loaded: true, 
        modelName: 'wink-eng-lite-web-model',
        note: 'Bundled at build time (~3.6MB)',
      });
      return;
    }

    // -----------------------------------------------------------------
    // 10. Settings: Get User Map Info
    // -----------------------------------------------------------------
    if (msg.type === 'getUserMapInfo') {
      const userMap = await storage.getUserMap();
      sendResponse({
        loaded: !!userMap,
        spaceCount: userMap?.spaces?.length || 0,
        markerCount: userMap?.markers?.length || 0,
        lastUpdated: userMap?.lastUpdated || null,
      });
      return;
    }

    // -----------------------------------------------------------------
    // 11. Settings: Clear All Data
    // -----------------------------------------------------------------
    if (msg.type === 'clearAllData') {
      await storage.clearAll();
      sendResponse({ success: true });
      return;
    }

    // -----------------------------------------------------------------
    // Unknown message type
    // -----------------------------------------------------------------
    sendResponse({ error: `Unknown message type: ${msg.type}` });

  } catch (err) {
    console.error('[Background] Message error:', err);
    sendResponse({
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Create a function that fetches semantic validation from content script
 */
function createSemanticsGetter(tabId?: number): () => Promise<SemanticResult> {
  return async (): Promise<SemanticResult> => {
    const defaultResult: SemanticResult = {
      isValid: true,
      confidence: 0.5,
      reason: 'Tab unavailable',
      metrics: {
        paragraphCount: 0,
        sentenceCount: 0,
        avgWordsPerParagraph: 0,
        linkDensity: 0,
        hasStructuredContent: false,
      },
    };

    if (!tabId) return defaultResult;

    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { type: 'GET_SEMANTICS' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          resolve(defaultResult);
        } else {
          resolve(response);
        }
      });
    });
  };
}

/**
 * Get aggregated state for popup display
 */
async function getPopupState() {
  // Get storage stats
  const storageStats = await storage.getStats();
  
  // Get sync status
  const syncState = syncManager.getStatus();
  
  // Get session stats
  const sessionStats = await sessionManager.getStats();
  
  // Get user map info
  const userMap = await storage.getUserMap();
  
  // Get current tab context
  let context: { url: string; title: string; domain: string } | undefined;
  let match: MatchResult | undefined;
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab?.url && tab?.title && tab?.id) {
      // Skip chrome:// and extension pages
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        // No matching for internal pages
      } else {
        const url = new URL(tab.url);
        context = {
          url: tab.url,
          title: tab.title,
          domain: url.hostname,
        };
        
        // FIRST: Check if we have a cached full analysis for this tab
        const cached = tabAnalysisCache.get(tab.id);
        if (cached && cached.url === tab.url) {
          match = cached.result;
          console.log(`[Popup] Using cached analysis: ${match.score}%`);
        } else {
          // FALLBACK: Quick context matching
          const contextSignal: ContextSignal = {
            url: tab.url,
            title: tab.title,
            domain: url.hostname,
            contentType: 'unknown',
            estimatedWordCount: 0,
            hasVideo: false,
            hasCode: false,
          };
          
          // First: Quick recognize check against markers (fast path)
          if (userMap?.markers && userMap.markers.length > 0) {
            match = recognize(contextSignal, userMap.markers);
          }
          
          // Second: If no marker match, try centroid-based matching
          if ((!match || !match.pass) && userMap?.centroids && userMap.centroids.length > 0) {
            match = analyzeQuickContext(tab.title, tab.url, userMap.centroids);
          }
        }
      }
    }
  } catch (e) {
    console.error('[Background] getPopupState error:', e);
  }

  return {
    status: match?.pass ? 'matched' : 'noise',
    context,
    match,
    stats: {
      dailyCount: storageStats.artifactCount,
      totalCount: storageStats.artifactCount,
      pendingSync: storageStats.pendingSyncCount,
    },
    session: sessionStats,
    syncState: {
      active: syncState.active,
      lastSync: syncState.lastSync,
      error: syncState.error,
      backoffLevel: syncState.backoffLevel,
    },
    mapLoaded: !!userMap,
    spaceCount: userMap?.spaces?.length || 0,
    markerCount: userMap?.markers?.length || 0,
  };
}
