/**
 * Tab Listener
 * 
 * Three-layer capture pipeline:
 * 1. Context - Fast metadata scraping
 * 2. Heuristics - Time/content gates  
 * 3. Semantics - Text quality validation
 */

import { isAllowed } from './content_guard';
import { startDwellTimer, getDwellTime } from './dwell_timer';
import { classifyArtifact } from '../classify';
import { saveSignal } from '../store/local_db';
import { getSettings } from '../store/settings';
import type { Signal } from '../types';

// Track active processing to prevent duplicates
const processing = new Set<string>();

/**
 * Initialize tab monitoring
 */
export function initTabListener(): void {
  chrome.tabs.onUpdated.addListener(handleTabUpdate);
  chrome.tabs.onActivated.addListener(handleTabActivated);
  chrome.tabs.onRemoved.addListener(handleTabRemoved);
  
  console.log('[Capture] Tab listener initialized');
}

/**
 * Handle tab content loaded
 */
async function handleTabUpdate(
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab
): Promise<void> {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url) return;
  
  // Check if capture is enabled
  const settings = await getSettings();
  if (!settings.enabled) return;
  
  // Check content guard
  if (!isAllowed(tab.url)) {
    console.log('[Capture] Blocked:', tab.url.slice(0, 50));
    return;
  }
  
  // Start dwell timer for this tab
  startDwellTimer(tabId, tab.url);
}

/**
 * Handle tab becoming active
 */
function handleTabActivated(activeInfo: chrome.tabs.TabActiveInfo): void {
  // Resume dwell timer when tab becomes active
  startDwellTimer(activeInfo.tabId);
}

/**
 * Handle tab closed - trigger capture if qualified
 */
async function handleTabRemoved(tabId: number): Promise<void> {
  const dwellData = getDwellTime(tabId);
  if (!dwellData) return;
  
  // Trigger the three-layer pipeline
  await capturePipeline(tabId, dwellData.url, dwellData.totalMs);
}

// ============================================================================
// THREE-LAYER CAPTURE PIPELINE
// ============================================================================

/**
 * Layer 1: Context → Layer 2: Heuristics → Layer 3: Semantics → Extract
 */
async function capturePipeline(
  tabId: number,
  url: string,
  dwellTimeMs: number
): Promise<Signal | null> {
  const pageKey = `${tabId}:${url}`;
  
  if (processing.has(pageKey)) return null;
  processing.add(pageKey);
  
  try {
    // =========================================
    // LAYER 1: CONTEXT (Instant metadata)
    // =========================================
    let context;
    try {
      context = await chrome.tabs.sendMessage(tabId, { action: 'getContext' });
    } catch {
      console.log('[Pipeline] Tab closed before context extraction');
      return null;
    }
    
    console.log(`[Pipeline] Context: ${context.contentType} | ~${context.wordCountEstimate} words | ${context.domain}`);
    
    // =========================================
    // LAYER 2: HEURISTICS (Gates)
    // =========================================
    const settings = await getSettings();
    
    // Gate 1: Absolute minimum dwell time
    if (dwellTimeMs < settings.minDwellTimeMs) {
      console.log(`[Pipeline] GATE: Dwell too short (${Math.round(dwellTimeMs/1000)}s < ${settings.minDwellTimeMs/1000}s)`);
      return null;
    }
    
    // Gate 2: Minimum word count
    if (context.wordCountEstimate < settings.minWordCount) {
      console.log(`[Pipeline] GATE: Too few words (~${context.wordCountEstimate} < ${settings.minWordCount})`);
      return null;
    }
    
    // Gate 3: Content type multiplier
    // Lower = harder to count (need more real time)
    // Higher = easier to count
    const dwellMultipliers: Record<string, number> = {
      video: 0.3,         // 100s watched → 30s credit (passive)
      documentation: 1.2, // Docs: easier (dense content)
      chat: 0.5,          // 60s chat → 30s credit
      code: 1.5,          // Code: easier (slow reading)
      forum: 0.8,         // Forums: slightly harder
      article: 1.0,       // Baseline
      social: 0.5,        // 60s scroll → 30s credit (doomscroll penalty)
      unknown: 1.0,
    };
    
    const multiplier = dwellMultipliers[context.contentType] || 1.0;
    const adjustedDwell = dwellTimeMs * multiplier;
    
    // Determine artifact type from adjusted dwell
    let suggestedType: Signal['artifactType'];
    if (adjustedDwell < 30000) {
      suggestedType = 'ambient';
    } else if (adjustedDwell < 120000) {
      suggestedType = 'engaged';
    } else {
      suggestedType = 'committed';
    }
    
    console.log(`[Pipeline] Heuristics: ${Math.round(dwellTimeMs/1000)}s × ${multiplier} → ${suggestedType}`);
    
    // =========================================
    // LAYER 3: SEMANTICS (Validation)
    // =========================================
    // Only validate if worth processing (not ambient)
    let semanticValidation: {
      isValid: boolean;
      confidence: number;
      reason: string;
      metrics?: { paragraphCount: number };
    } = { isValid: true, confidence: 0.5, reason: 'Skipped for ambient' };
    
    if (suggestedType !== 'ambient') {
      try {
        semanticValidation = await chrome.tabs.sendMessage(tabId, { action: 'validateSemantics' });
        console.log(`[Pipeline] Semantics: ${semanticValidation.isValid ? 'VALID' : 'INVALID'} (${Math.round(semanticValidation.confidence*100)}%)`);
        
        if (!semanticValidation.isValid) {
          console.log(`[Pipeline] GATE: Semantic validation failed - ${semanticValidation.reason}`);
          return null;
        }
      } catch {
        console.log('[Pipeline] Semantic validation skipped (tab closed)');
      }
    }
    
    // =========================================
    // FULL EXTRACTION (Only for valid content)
    // =========================================
    let extraction;
    try {
      extraction = await chrome.tabs.sendMessage(tabId, { action: 'extract' });
    } catch {
      console.log('[Pipeline] Extraction failed (tab closed)');
      return null;
    }
    
    if (!extraction.success || !extraction.data) {
      console.log('[Pipeline] Extraction failed:', extraction.error);
      return null;
    }
    
    // Get reading metrics
    let metrics = { scrollDepth: 0, readingDepth: 0.5 };
    try {
      metrics = await chrome.tabs.sendMessage(tabId, { 
        action: 'getMetrics', 
        wordCount: extraction.data.wordCount 
      });
    } catch {
      // Use defaults
    }
    
    // Re-classify with actual metrics
    const artifactType = classifyArtifact({
      dwellTimeMs,
      scrollDepth: metrics.scrollDepth,
      wordCount: extraction.data.wordCount,
    });
    
    // Detect source platform
    const sourcePlatform = detectPlatform(url);
    
    // =========================================
    // BUILD & SAVE SIGNAL
    // =========================================
    const signal: Signal = {
      id: generateId(),
      url,
      title: extraction.data.title,
      content: extraction.data.content,
      excerpt: extraction.data.excerpt,
      wordCount: extraction.data.wordCount,
      domain: context.domain,
      
      // Metrics
      dwellTimeMs,
      adjustedScoreMs: adjustedDwell,  // Time * Multiplier
      scrollDepth: metrics.scrollDepth,
      readingDepth: metrics.readingDepth,
      
      // Classification
      artifactType,
      contentType: context.contentType,
      contentSource: context.contentType === 'video' ? 'video' 
        : context.contentType === 'chat' ? 'ai'
        : 'web',
      captureMethod: 'auto',
      sourcePlatform,
      
      // Semantic validation (only for non-ambient)
      validation: suggestedType !== 'ambient' ? {
        paragraphCount: semanticValidation.metrics?.paragraphCount || 0,
        confidenceScore: semanticValidation.confidence,
      } : undefined,
      
      capturedAt: Date.now(),
      synced: false,
    };
    
    await saveSignal(signal);
    console.log(`[Pipeline] ✓ Saved: "${signal.title.slice(0, 40)}" (${artifactType})`);
    
    return signal;
    
  } finally {
    processing.delete(pageKey);
  }
}

/**
 * Legacy capture function (still used for manual)
 */
export async function captureTab(
  tabId: number,
  url: string,
  dwellTimeMs: number
): Promise<Signal | null> {
  return capturePipeline(tabId, url, dwellTimeMs);
}

/**
 * Manual capture from popup
 */
export async function manualCapture(tabId: number): Promise<Signal | null> {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url) return null;
  
  const dwellData = getDwellTime(tabId);
  const signal = await capturePipeline(tabId, tab.url, dwellData?.totalMs || 60000);
  
  if (signal) {
    signal.captureMethod = 'manual';
    await saveSignal(signal);
  }
  
  return signal;
}

// ============================================================================
// HELPERS
// ============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function detectPlatform(url: string): string | undefined {
  // Video platforms
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube';
  if (url.includes('vimeo.com')) return 'Vimeo';
  if (url.includes('twitch.tv')) return 'Twitch';
  
  // Code platforms
  if (url.includes('github.com')) return 'GitHub';
  if (url.includes('gitlab.com')) return 'GitLab';
  if (url.includes('stackoverflow.com')) return 'StackOverflow';
  
  // AI platforms
  if (url.includes('chatgpt.com') || url.includes('chat.openai.com')) return 'ChatGPT';
  if (url.includes('claude.ai')) return 'Claude';
  if (url.includes('perplexity.ai')) return 'Perplexity';
  
  // Social platforms
  if (url.includes('twitter.com') || url.includes('x.com')) return 'Twitter';
  if (url.includes('linkedin.com')) return 'LinkedIn';
  if (url.includes('reddit.com')) return 'Reddit';
  if (url.includes('news.ycombinator.com')) return 'HackerNews';
  
  // Content platforms
  if (url.includes('medium.com')) return 'Medium';
  if (url.includes('substack.com')) return 'Substack';
  if (url.includes('dev.to')) return 'DevTo';
  
  // Learning platforms
  if (url.includes('coursera.org')) return 'Coursera';
  if (url.includes('udemy.com')) return 'Udemy';
  
  return undefined;
}
