/**
 * Content Script - "The Eyes"
 * 
 * Runs in the web page context with full DOM access.
 * 
 * Architecture:
 * 1. PageTracker - Tracks engagement metrics (dwell, scroll, reading depth)
 * 2. Scraper - Extracts clean content using Readability
 * 3. Orchestrator (this file) - Coordinates capture timing
 * 
 * Flow:
 * - Page load: Start PageTracker
 * - After 5s dwell: Capture content + metrics → Send to Background
 * - On page exit: Send final metrics update (beforeunload)
 */

import { Readability } from '@mozilla/readability';
import { scrapePageContent } from './scrape';
import { PageTracker, getTracker, destroyTracker } from './tracker';
import type { ExtractionResult } from '../types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DWELL_THRESHOLD_MS = 5000; // 5 seconds to qualify for capture

// ============================================================================
// STATE
// ============================================================================

let tracker: PageTracker | null = null;
let hasCaptured = false;
let capturedUrl: string | null = null;
let captureTimer: ReturnType<typeof setTimeout> | null = null;
let lastUrl = location.href; // For SPA navigation detection

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  const url = window.location.href;
  
  // Skip browser internal pages
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
    return;
  }
  
  // Reset state for fresh page (handles SPA navigation)
  hasCaptured = false;
  capturedUrl = null;
  if (captureTimer) {
    clearTimeout(captureTimer);
    captureTimer = null;
  }
  
  // Destroy old tracker and create fresh one
  destroyTracker();
  tracker = getTracker();
  
  // Schedule the Entry Gate check (5 seconds)
  captureTimer = setTimeout(attemptCapture, DWELL_THRESHOLD_MS);
  
  console.log('[Sensor] Initialized, waiting for 5s dwell...');
}

// ============================================================================
// CAPTURE LOGIC
// ============================================================================

/**
 * Entry Gate - Triggered after 5 seconds of dwell time
 * Captures content and sends to background for NLP analysis
 */
function attemptCapture() {
  if (!tracker || hasCaptured) return;
  
  const metrics = tracker.getMetrics();
  
  // Scrape content with current metrics
  const scraped = scrapePageContent(metrics);
  
  if (!scraped || scraped.contentText.length < 500) {
    console.log('[Sensor] Not enough content to capture');
    return;
  }
  
  console.log(`[Sensor] Capture: ${scraped.title.substring(0, 40)}...`);
  console.log(`[Sensor] Metrics: dwell=${metrics.dwellTimeMs}ms, scroll=${(metrics.scrollDepth*100).toFixed(0)}%, depth=${metrics.readingDepth.toFixed(2)} → ${metrics.engagementLevel}`);
  
  // Send to background for NLP analysis
  chrome.runtime.sendMessage({
    type: 'ANALYZE_CONTENT',
    payload: scraped,
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('[Sensor] Failed to send for analysis:', chrome.runtime.lastError.message);
      return;
    }
    
    if (response?.relevant) {
      hasCaptured = true;
      capturedUrl = scraped.url;
      console.log(`[Sensor] ✓ Relevant: ${response.score}% → ${response.spaceName}`);
    } else {
      console.log(`[Sensor] ✗ Not relevant (score: ${response?.score || 0}%)`);
    }
  });
}

/**
 * Reset dwell timer on user activity
 * This extends the capture window if user is actively engaging
 */
function resetDwellTimer() {
  if (captureTimer && !hasCaptured) {
    clearTimeout(captureTimer);
    captureTimer = setTimeout(attemptCapture, DWELL_THRESHOLD_MS);
  }
}

// ============================================================================
// FINAL METRICS UPDATE (on page exit)
// ============================================================================

/**
 * Send final metrics when user leaves the page
 * This updates dwell_time, scroll_depth, and reading_depth in the DB
 */
function sendFinalMetrics() {
  if (!hasCaptured || !tracker || !capturedUrl) return;
  
  const finalMetrics = tracker.getMetrics();
  
  console.log(`[Sensor] Final metrics: dwell=${finalMetrics.dwellTimeMs}ms, scroll=${(finalMetrics.scrollDepth*100).toFixed(0)}%, depth=${finalMetrics.readingDepth.toFixed(2)} → ${finalMetrics.engagementLevel}`);
  
  // Send update to background
  chrome.runtime.sendMessage({
    type: 'UPDATE_METRICS',
    payload: {
      url: capturedUrl,
      metrics: {
        dwell_time_ms: finalMetrics.dwellTimeMs,
        scroll_depth: finalMetrics.scrollDepth,
        reading_depth: finalMetrics.readingDepth,
        engagement_level: finalMetrics.engagementLevel,
      },
    },
  });
}

// Listen for page exit (multiple strategies for reliability)
window.addEventListener('beforeunload', sendFinalMetrics);
window.addEventListener('pagehide', sendFinalMetrics);

// Visibility change handles backgrounded tabs (more reliable than beforeunload)
// This sends a "checkpoint" - backend upsert handles if user returns
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    sendFinalMetrics();
  }
});

// ============================================================================
// SPA NAVIGATION DETECTION
// ============================================================================

// Detect client-side navigation (React, Next.js, YouTube, Twitter, etc.)
// These apps change URL without full page reload
new MutationObserver(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    console.log(`[Sensor] SPA navigation detected: ${lastUrl.substring(0, 50)}... → ${currentUrl.substring(0, 50)}...`);
    
    // 1. Send final pulse for previous page
    sendFinalMetrics();
    
    // 2. Update URL tracking
    lastUrl = currentUrl;
    
    // 3. Restart tracker for new page
    init();
  }
}).observe(document, { subtree: true, childList: true });

// ============================================================================
// ACTIVITY LISTENERS (reset dwell timer on engagement)
// ============================================================================

document.addEventListener('scroll', resetDwellTimer, { passive: true });
document.addEventListener('click', resetDwellTimer);
document.addEventListener('keydown', resetDwellTimer);

// ============================================================================
// MESSAGE HANDLING (for Background requests)
// ============================================================================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const action = message.action || message.type;
  
  switch (action) {
    // Layer 1: Context (instant metadata)
    case 'getContext':
      sendResponse(getPageContext());
      return true;
    
    // Layer 3: Semantics (validation)
    case 'validateSemantics':
    case 'GET_SEMANTICS':
      sendResponse(validateContent());
      return true;
    
    // Full extraction with current metrics
    case 'extract':
    case 'SCRAPE_CONTENT':
      const metrics = tracker?.getMetrics();
      const scraped = scrapePageContent(metrics);
      sendResponse(scraped || extractContentFallback());
      return true;
      
    // Get current reading metrics
    case 'getMetrics':
      if (tracker) {
        sendResponse(tracker.getMetrics());
      } else {
        sendResponse({ dwellTimeMs: 0, scrollDepth: 0, readingDepth: 0, wordCount: 0, engagementLevel: 'ambient' });
      }
      return true;
      
    case 'getMetadata':
      sendResponse(getMetadata());
      return true;
      
    default:
      return false;
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

type ContentType = 'article' | 'video' | 'documentation' | 'chat' | 'social' | 'code' | 'forum' | 'unknown';

interface PageContext {
  url: string;
  domain: string;
  path: string;
  title: string;
  description?: string;
  contentType: ContentType;
  language?: string;
  publishedAt?: string;
  author?: string;
  wordCountEstimate: number;
  hasVideo: boolean;
  hasCode: boolean;
}

function getPageContext(): PageContext {
  const url = window.location.href;
  const parsedUrl = new URL(url);
  
  const domain = parsedUrl.hostname.replace(/^www\./, '');
  const path = parsedUrl.pathname;
  
  const getMeta = (name: string): string | undefined => 
    document.querySelector(`meta[name="${name}"], meta[property="${name}"]`)
      ?.getAttribute('content') || undefined;
  
  return {
    url,
    domain,
    path,
    title: document.title,
    description: getMeta('description') || getMeta('og:description'),
    contentType: detectContentType(url, path),
    language: document.documentElement.lang || getMeta('language'),
    publishedAt: getMeta('article:published_time') || getMeta('datePublished'),
    author: getMeta('author') || getMeta('article:author'),
    wordCountEstimate: estimateWordCount(),
    hasVideo: hasVideoContent(),
    hasCode: hasCodeContent(),
  };
}

function detectContentType(url: string, _path: string): ContentType {
  if (/youtube\.com\/watch|youtu\.be\/|vimeo\.com\/|twitch\.tv\//.test(url)) return 'video';
  if (/\/docs\/|\/documentation\/|\.readthedocs\.|docs\.[a-z]+\.com/.test(url)) return 'documentation';
  if (/chat\.openai\.com|chatgpt\.com|claude\.ai|gemini\.google\.com|perplexity\.ai/.test(url)) return 'chat';
  if (/github\.com.*\/(blob|tree)\/|gist\.github\.com|gitlab\.com.*\/-\/blob/.test(url)) return 'code';
  if (/reddit\.com\/r\/.*\/comments|news\.ycombinator\.com\/item|stackoverflow\.com\/questions/.test(url)) return 'forum';
  if (/twitter\.com|x\.com|linkedin\.com\/posts/.test(url)) return 'social';
  if (hasVideoContent() && !document.querySelector('article')) return 'video';
  return 'article';
}

function estimateWordCount(): number {
  const main = document.querySelector('main, article, [role="main"], .content, #content');
  const text = (main?.textContent || '').trim();
  if (!text) {
    const bodyText = document.body.textContent || '';
    return Math.floor(bodyText.split(/\s+/).length * 0.5);
  }
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

function hasVideoContent(): boolean {
  return !!(
    document.querySelector('video, iframe[src*="youtube"], iframe[src*="vimeo"]') ||
    document.querySelector('[class*="video-player"], [class*="player-wrapper"]')
  );
}

function hasCodeContent(): boolean {
  return document.querySelectorAll('pre, code, .highlight').length > 0;
}

// ============================================================================
// SEMANTIC VALIDATION
// ============================================================================

interface SemanticValidation {
  isValid: boolean;
  confidence: number;
  reason: string;
  metrics: {
    paragraphCount: number;
    avgWordsPerParagraph: number;
    linkDensity: number;
    textDensity: number;
    sentenceCount: number;
    hasStructuredContent: boolean;
  };
}

function validateContent(): SemanticValidation {
  const main = document.querySelector('main, article, [role="main"], .content, #content');
  const container = main || document.body;
  
  const paragraphs = container.querySelectorAll('p');
  const paragraphTexts = Array.from(paragraphs)
    .map(p => (p.textContent || '').trim())
    .filter(t => t.length > 20);
  
  const paragraphCount = paragraphTexts.length;
  const totalWords = paragraphTexts.reduce((sum, t) => sum + t.split(/\s+/).length, 0);
  const avgWordsPerParagraph = paragraphCount > 0 ? totalWords / paragraphCount : 0;
  
  const allText = (container.textContent || '').trim();
  const allLinks = container.querySelectorAll('a');
  const linkText = Array.from(allLinks).map(a => (a.textContent || '').trim()).join(' ');
  const linkDensity = allText.length > 0 ? linkText.length / allText.length : 0;
  
  const htmlLength = container.innerHTML.length;
  const textDensity = htmlLength > 0 ? allText.length / htmlLength : 0;
  
  const sentences = allText.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const sentenceCount = sentences.length;
  
  const hasHeaders = container.querySelectorAll('h1, h2, h3, h4').length > 0;
  const hasLists = container.querySelectorAll('ul, ol').length > 0;
  const hasStructuredContent = hasHeaders || hasLists;
  
  const checks = [
    { pass: paragraphCount >= 2, weight: 0.3 },
    { pass: avgWordsPerParagraph >= 20, weight: 0.2 },
    { pass: linkDensity <= 0.4, weight: 0.2 },
    { pass: textDensity >= 0.3, weight: 0.15 },
    { pass: sentenceCount >= 3, weight: 0.15 },
  ];
  
  const confidence = checks.reduce((sum, c) => sum + (c.pass ? c.weight : 0), 0);
  const isValid = confidence >= 0.6;
  
  return {
    isValid,
    confidence,
    reason: isValid 
      ? `Valid: ${paragraphCount} paragraphs, ${sentenceCount} sentences`
      : `Invalid: ${paragraphCount} paragraphs, ${Math.round(linkDensity*100)}% links`,
    metrics: {
      paragraphCount,
      avgWordsPerParagraph,
      linkDensity,
      textDensity,
      sentenceCount,
      hasStructuredContent,
    },
  };
}

// ============================================================================
// FALLBACK EXTRACTION
// ============================================================================

function extractContentFallback(): ExtractionResult {
  try {
    const documentClone = document.cloneNode(true) as Document;
    const reader = new Readability(documentClone);
    const article = reader.parse();
    
    if (article && article.textContent) {
      return {
        success: true,
        data: {
          title: article.title || document.title,
          url: window.location.href,
          content: article.textContent.trim(),
          excerpt: article.excerpt || article.textContent.slice(0, 200),
          wordCount: article.textContent.split(/\s+/).length,
        },
      };
    }
    
    const main = document.querySelector('main, article, [role="main"], .content, #content');
    const content = (main?.textContent || document.body.textContent || '').trim();
    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
    
    if (wordCount < 50) {
      return { success: false, error: 'Not enough content' };
    }
    
    return {
      success: true,
      data: {
        title: document.title,
        url: window.location.href,
        content: content.replace(/\s+/g, ' ').trim(),
        excerpt: content.slice(0, 200),
        wordCount,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Extraction failed',
    };
  }
}

function getMetadata() {
  return {
    title: document.title,
    url: window.location.href,
    description: document.querySelector('meta[name="description"]')?.getAttribute('content'),
  };
}

// ============================================================================
// START
// ============================================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

console.log('[Sensor] Content script loaded');
