/**
 * Dwell Timer
 * 
 * Tracks time spent on each tab, handling focus/blur.
 */

interface DwellData {
  url: string;
  startedAt: number;
  totalMs: number;
  isActive: boolean;
  lastActiveAt: number;
}

// Tab ID -> Dwell data
const dwellTimers = new Map<number, DwellData>();

/**
 * Start or resume dwell timer for a tab
 */
export function startDwellTimer(tabId: number, url?: string): void {
  const existing = dwellTimers.get(tabId);
  
  if (existing) {
    // Resume existing timer
    if (!existing.isActive) {
      existing.isActive = true;
      existing.lastActiveAt = Date.now();
    }
    // Update URL if changed
    if (url && url !== existing.url) {
      // New page - reset timer
      dwellTimers.set(tabId, {
        url,
        startedAt: Date.now(),
        totalMs: 0,
        isActive: true,
        lastActiveAt: Date.now(),
      });
    }
  } else if (url) {
    // New timer
    dwellTimers.set(tabId, {
      url,
      startedAt: Date.now(),
      totalMs: 0,
      isActive: true,
      lastActiveAt: Date.now(),
    });
  }
}

/**
 * Pause dwell timer (tab lost focus)
 */
export function pauseDwellTimer(tabId: number): void {
  const data = dwellTimers.get(tabId);
  if (data && data.isActive) {
    data.totalMs += Date.now() - data.lastActiveAt;
    data.isActive = false;
  }
}

/**
 * Get dwell time for a tab
 */
export function getDwellTime(tabId: number): DwellData | null {
  const data = dwellTimers.get(tabId);
  if (!data) return null;
  
  // Calculate current total
  let totalMs = data.totalMs;
  if (data.isActive) {
    totalMs += Date.now() - data.lastActiveAt;
  }
  
  return {
    ...data,
    totalMs,
  };
}

/**
 * Clear dwell timer for a tab
 */
export function clearDwellTimer(tabId: number): void {
  dwellTimers.delete(tabId);
}

/**
 * Get all active dwell timers (for debugging)
 */
export function getAllDwellTimers(): Map<number, DwellData> {
  return new Map(dwellTimers);
}

// ============================================================================
// WINDOW FOCUS HANDLING
// ============================================================================

// Pause all timers when window loses focus
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus - pause all
    for (const [tabId] of dwellTimers) {
      pauseDwellTimer(tabId);
    }
  } else {
    // Browser gained focus - resume active tab
    chrome.tabs.query({ active: true, windowId }, (tabs) => {
      if (tabs[0]?.id) {
        startDwellTimer(tabs[0].id);
      }
    });
  }
});
