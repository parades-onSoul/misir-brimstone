/**
 * Page Tracker — Reading engagement metrics
 *
 * Tracks scroll depth, dwell time, and reading depth
 * using the 200 WPM model from the original sensor.
 */
import type { ReadingMetrics, EngagementLevel } from '@/types';

const AVG_WPM = 200;

let startTime = Date.now();
let maxScrollDepth = 0;
let scrollEventCount = 0;
let isActive = true;

// ── Scroll tracking ──────────────────────────────────

function handleScroll() {
  scrollEventCount++;
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
  if (scrollHeight > 0) {
    const depth = Math.min(1, scrollTop / scrollHeight);
    if (depth > maxScrollDepth) maxScrollDepth = depth;
  }
}

// ── Visibility tracking ──────────────────────────────

function handleVisibility() {
  isActive = !document.hidden;
}

// ── Initialize ───────────────────────────────────────

export function initTracker(): void {
  startTime = Date.now();
  maxScrollDepth = 0;
  scrollEventCount = 0;
  isActive = true;

  window.addEventListener('scroll', handleScroll, { passive: true });
  document.addEventListener('visibilitychange', handleVisibility);
}

// ── Metrics ──────────────────────────────────────────

export function getMetrics(wordCount: number): ReadingMetrics {
  const dwellTimeMs = Date.now() - startTime;
  const scrollDepth = Math.round(maxScrollDepth * 100) / 100;
  const readingDepth = calculateReadingDepth(dwellTimeMs, scrollDepth, wordCount);

  return {
    dwellTimeMs,
    scrollDepth,
    readingDepth,
    scrollEvents: scrollEventCount,
  };
}

/**
 * Reading depth formula:
 *   depth = (timeRatio * 0.6) + (scrollDepth * 0.4)
 *   timeRatio = min(1.5, actualTime / expectedReadTime)
 *   expectedReadTime = wordCount / 200wpm * 60s
 */
function calculateReadingDepth(
  dwellMs: number,
  scrollDepth: number,
  wordCount: number
): number {
  if (wordCount === 0) return 0;
  const expectedTimeMs = (wordCount / AVG_WPM) * 60000;
  const timeRatio = Math.min(1.5, dwellMs / Math.max(expectedTimeMs, 1));
  const depth = timeRatio * 0.6 + scrollDepth * 0.4;
  return Math.round(Math.min(1.5, depth) * 1000) / 1000;
}

/**
 * Classify engagement level from heuristics.
 */
export function classifyEngagement(
  dwellMs: number,
  scrollDepth: number,
  wordCount: number
): EngagementLevel {
  const seconds = dwellMs / 1000;
  if (seconds >= 60 && scrollDepth >= 0.5 && wordCount >= 300) return 'saturated';
  if (seconds >= 15 && (scrollDepth >= 0.2 || wordCount >= 100)) return 'engaged';
  if (seconds >= 8 && (scrollDepth >= 0.1 || wordCount >= 40)) return 'discovered';
  return 'latent';
}

// ── Cleanup ──────────────────────────────────────────

export function destroyTracker(): void {
  window.removeEventListener('scroll', handleScroll);
  document.removeEventListener('visibilitychange', handleVisibility);
}
