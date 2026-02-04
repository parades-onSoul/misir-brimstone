/**
 * The Eyes - DOM Scraper
 * 
 * Runs in content script context where we have full DOM access.
 * Uses Readability to extract clean article text from noisy web pages.
 */

import { Readability } from '@mozilla/readability';
import type { EngagementMetrics } from './tracker';

// ============================================================================
// URL NORMALIZATION
// ============================================================================

/** Tracking parameters to strip from URLs */
const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'ref', 'fbclid', 'gclid', 'msclkid', 'twclid',
  '_ga', '_gl', 'mc_cid', 'mc_eid',
  'oly_anon_id', 'oly_enc_id',
  'vero_id', 'vero_conv',
  'spm', 'share_token',
];

/**
 * Normalize URL by stripping tracking parameters.
 * This ensures the same article from different share links
 * is stored as one artifact (URL is the key).
 */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    
    // Remove tracking params
    TRACKING_PARAMS.forEach(p => u.searchParams.delete(p));
    
    // Remove empty hash
    if (u.hash === '#') u.hash = '';
    
    return u.toString();
  } catch {
    // If URL parsing fails, return as-is
    return url;
  }
}

export interface ScrapedContent {
  url: string;
  domain: string;
  path: string;
  title: string;
  contentText: string;      // Clean text for NLP
  contentHtml?: string;     // Keep for storage if needed
  rawLength: number;
  excerpt?: string;
  byline?: string;
  siteName?: string;
  // Reading metrics from PageTracker
  dwellTimeMs?: number;
  scrollDepth?: number;     // 0-1
  readingDepth?: number;    // 0-1.5
  wordCount?: number;
  engagementLevel?: 'ambient' | 'engaged' | 'committed';
}

/**
 * Scrape the current page using Readability.
 * Returns clean, noise-free content ready for NLP analysis.
 * 
 * @param metrics - Optional engagement metrics from PageTracker
 */
export function scrapePageContent(metrics?: EngagementMetrics): ScrapedContent | null {
  // 1. Check if we have a valid DOM
  if (!document || !document.body) {
    console.warn('[Scrape] No document available');
    return null;
  }

  // 2. Clone the DOM (Readability modifies the DOM it parses)
  const clone = document.cloneNode(true) as Document;

  // 3. Run Readability - the "Noise Filter"
  // Strips ads, nav bars, sidebars, footers automatically
  try {
    const reader = new Readability(clone, {
      charThreshold: 100, // Minimum chars to consider content
    });
    const article = reader.parse();

    if (!article || !article.textContent) {
      console.log('[Scrape] Readability could not parse content');
      return null;
    }

    // 4. Return the clean signal with metrics
    // Use normalized URL to deduplicate tracking variants
    const result: ScrapedContent = {
      url: normalizeUrl(window.location.href),
      domain: window.location.hostname,
      path: window.location.pathname,
      title: article.title || document.title,
      contentText: article.textContent.trim(),
      contentHtml: article.content || undefined,
      rawLength: article.length || 0,
      excerpt: article.excerpt || undefined,
      byline: article.byline || undefined,
      siteName: article.siteName || undefined,
    };
    
    // Attach metrics if provided
    if (metrics) {
      result.dwellTimeMs = metrics.dwellTimeMs;
      result.scrollDepth = metrics.scrollDepth;
      result.readingDepth = metrics.readingDepth;
      result.wordCount = metrics.wordCount;
      result.engagementLevel = metrics.engagementLevel;
    }
    
    return result;
  } catch (e) {
    console.error('[Scrape] Readability error:', e);
    return null;
  }
}

/**
 * Quick scrape - just get basic metadata without full Readability parse.
 * Useful for fast checks before committing to full extraction.
 */
export function scrapeQuickContext() {
  return {
    url: window.location.href,
    domain: window.location.hostname,
    path: window.location.pathname,
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
    estimatedWordCount: document.body.innerText.split(/\s+/).length,
  };
}
