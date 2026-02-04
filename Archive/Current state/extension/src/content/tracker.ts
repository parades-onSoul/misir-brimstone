/**
 * Page Tracker - The Logic Engine
 * 
 * Handles engagement metrics calculation using the 200 WPM formula.
 * Tracks: dwell time, scroll depth, reading depth
 */

// ============================================================================
// TYPES
// ============================================================================

export interface EngagementMetrics {
  dwellTimeMs: number;
  scrollDepth: number;  // 0.0 to 1.0
  readingDepth: number; // 0.0 to >1.0
  wordCount: number;
  engagementLevel: 'ambient' | 'engaged' | 'committed';
}

// ============================================================================
// PAGE TRACKER CLASS
// ============================================================================

export class PageTracker {
  private startTime: number;
  private maxScrollY: number = 0;
  private totalScrollHeight: number = 0;
  private wordCount: number = 0;
  private scrollListener: (() => void) | null = null;

  constructor() {
    this.startTime = Date.now();
    this.wordCount = this.estimateWordCount();
    this.updateScrollHeight();
    
    // Bind scroll listener
    this.scrollListener = this.handleScroll.bind(this);
    window.addEventListener('scroll', this.scrollListener, { passive: true });
  }

  /**
   * Handle scroll events - track max scroll position
   */
  private handleScroll(): void {
    const currentScroll = window.scrollY;
    if (currentScroll > this.maxScrollY) {
      this.maxScrollY = currentScroll;
    }
  }

  /**
   * Update total scroll height (may change due to lazy loading)
   */
  private updateScrollHeight(): void {
    this.totalScrollHeight = Math.max(
      document.documentElement.scrollHeight - window.innerHeight,
      1 // Prevent division by zero
    );
  }

  /**
   * Fast approximation of word count for reading time calculation
   */
  private estimateWordCount(): number {
    // Try to get main content first
    const main = document.querySelector('main, article, [role="main"], .content, #content') as HTMLElement | null;
    const text = (main?.innerText || document.body.innerText || '').trim();
    return text.split(/\s+/).filter((w: string) => w.length > 0).length;
  }

  /**
   * Calculate engagement metrics using the 200 WPM formula
   * 
   * Reading Depth = (TimeRatio * 0.6) + (ScrollRatio * 0.4)
   * 
   * Where:
   * - TimeRatio = min(dwellTime / expectedReadTime, 1.5)
   * - ScrollRatio = maxScroll / totalScrollHeight
   * - ExpectedReadTime = wordCount / (200 words/min)
   */
  public getMetrics(): EngagementMetrics {
    const now = Date.now();
    const dwellTimeMs = now - this.startTime;

    // 1. Calculate Scroll Depth (0.0 - 1.0)
    // Recalculate height in case of lazy loading images
    this.updateScrollHeight();
    const scrollRatio = Math.min(this.maxScrollY / this.totalScrollHeight, 1.0);

    // 2. Calculate Reading Depth (The Formula)
    // Baseline: 200 words per minute = 200/60000 words per ms
    const WORDS_PER_MS = 200 / 60000;
    const expectedReadTimeMs = this.wordCount / WORDS_PER_MS;
    
    // Cap time ratio at 1.5 (don't reward leaving tab open overnight)
    const timeRatio = expectedReadTimeMs > 0 
      ? Math.min(dwellTimeMs / expectedReadTimeMs, 1.5) 
      : 0;

    // Weighted Score: 60% Time, 40% Scroll
    const readingDepth = (timeRatio * 0.6) + (scrollRatio * 0.4);

    // Determine engagement level
    const engagementLevel = this.determineEngagementLevel(readingDepth);

    return {
      dwellTimeMs,
      scrollDepth: parseFloat(scrollRatio.toFixed(3)),
      readingDepth: parseFloat(readingDepth.toFixed(3)),
      wordCount: this.wordCount,
      engagementLevel,
    };
  }

  /**
   * Map reading depth to engagement level
   */
  private determineEngagementLevel(depth: number): 'ambient' | 'engaged' | 'committed' {
    if (depth >= 0.7) return 'committed'; // Deep Read
    if (depth >= 0.4) return 'engaged';   // Read
    return 'ambient';                      // Skim/Bounce
  }

  /**
   * Get expected reading time in minutes
   */
  public getExpectedReadingTimeMin(): number {
    return Math.ceil(this.wordCount / 200);
  }

  /**
   * Cleanup - remove event listeners
   */
  public destroy(): void {
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener);
      this.scrollListener = null;
    }
  }
}

// ============================================================================
// SINGLETON HELPER
// ============================================================================

let trackerInstance: PageTracker | null = null;

export function getTracker(): PageTracker {
  if (!trackerInstance) {
    trackerInstance = new PageTracker();
  }
  return trackerInstance;
}

export function destroyTracker(): void {
  if (trackerInstance) {
    trackerInstance.destroy();
    trackerInstance = null;
  }
}
