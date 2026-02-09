/**
 * Content Script Entry — "The Eyes"
 *
 * Runs on every page at document_idle.
 * Handles:
 *  - Page scraping (Readability)
 *  - Reading metric tracking (scroll, dwell, depth)
 *  - Message handling from popup / background
 */
import { scrapePageContent, scrapeQuickContext, normalizeUrl } from './scrape';
import { initTracker, getMetrics, classifyEngagement } from './tracker';
import type { ScrapedPage, ReadingMetrics } from '@/types';

// Start tracking immediately
initTracker();

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// ── Message Handler ──────────────────────────────────

chrome.runtime.onMessage.addListener(
  (msg: { type: string }, _sender, sendResponse) => {
    if (msg.type === 'SCRAPE_PAGE') {
      try {
        const scraped = scrapePageContent();
        const metrics = getMetrics(scraped.wordCount);
        const engagement = classifyEngagement(
          metrics.dwellTimeMs,
          metrics.scrollDepth,
          scraped.wordCount
        );

        const page: ScrapedPage = {
          url: normalizeUrl(window.location.href),
          title: scraped.title,
          content: scraped.content,
          excerpt: scraped.excerpt,
          wordCount: scraped.wordCount,
          domain: getDomain(window.location.href),
        };

        sendResponse({
          success: true,
          data: {
            page,
            metrics,
            engagement,
          },
        });
      } catch (err) {
        sendResponse({
          success: false,
          error: err instanceof Error ? err.message : 'Scrape failed',
        });
      }
      return true;
    }

    if (msg.type === 'GET_METRICS') {
      const quick = scrapeQuickContext();
      const metrics = getMetrics(quick.wordCount);
      sendResponse({ success: true, data: metrics });
      return true;
    }

    if (msg.type === 'GET_QUICK_CONTEXT') {
      const ctx = scrapeQuickContext();
      sendResponse({ success: true, data: ctx });
      return true;
    }
  }
);

console.log('[Misir] Content script loaded on', window.location.hostname);
