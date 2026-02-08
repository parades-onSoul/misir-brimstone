/**
 * Content Scraper — Readability-based page extraction
 *
 * Uses @mozilla/readability for clean article extraction,
 * with fallback to manual DOM scraping.
 */
import { Readability } from '@mozilla/readability';

export interface ScrapedContent {
  title: string;
  content: string;
  excerpt: string;
  wordCount: number;
  byline: string | null;
  siteName: string | null;
}

/**
 * Full page scrape using Readability.
 * Falls back to manual extraction if Readability fails.
 */
export function scrapePageContent(): ScrapedContent {
  // Try Readability first
  try {
    const docClone = document.cloneNode(true) as Document;
    const reader = new Readability(docClone, {
      charThreshold: 100,
    });
    const article = reader.parse();

    if (article && article.textContent && article.textContent.length > 200) {
      const content = article.textContent.trim();
      return {
        title: article.title || document.title,
        content: content.substring(0, 50000),
        excerpt: article.excerpt || content.substring(0, 300),
        wordCount: countWords(content),
        byline: article.byline ?? null,
        siteName: article.siteName ?? null,
      };
    }
  } catch (e) {
    console.warn('[Misir] Readability failed, using fallback:', e);
  }

  // Fallback: manual DOM extraction
  return fallbackScrape();
}

/**
 * Quick context grab — lightweight scrape for classification.
 * Used when full scrape is too heavy (e.g., during browsing).
 */
export function scrapeQuickContext(): { title: string; text: string; wordCount: number } {
  const title = document.title || '';
  const meta = document.querySelector('meta[name="description"]');
  const descr = meta?.getAttribute('content') || '';

  // Grab first ~500 chars from main content area
  const main = document.querySelector('article, main, [role="main"]');
  const text = main?.textContent?.trim().substring(0, 500) || descr;

  return {
    title,
    text: `${title} ${text}`.trim(),
    wordCount: countWords(text),
  };
}

function fallbackScrape(): ScrapedContent {
  const body = document.body.cloneNode(true) as HTMLElement;
  body
    .querySelectorAll(
      'nav, header, footer, aside, script, style, noscript, ' +
      '[role="navigation"], [role="banner"], .sidebar, .nav, ' +
      '.footer, .header, .ad, .ads, .advertisement, .cookie-banner'
    )
    .forEach((el) => el.remove());

  const content = body.innerText.trim().substring(0, 50000);
  const title = document.title || '';

  return {
    title,
    content,
    excerpt: content.substring(0, 300),
    wordCount: countWords(content),
    byline: null,
    siteName: null,
  };
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Normalize a URL for deduplication.
 */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    // Remove tracking params
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'fbclid', 'gclid'].forEach((p) =>
      u.searchParams.delete(p)
    );
    return u.toString().replace(/\/$/, '');
  } catch {
    return url;
  }
}
