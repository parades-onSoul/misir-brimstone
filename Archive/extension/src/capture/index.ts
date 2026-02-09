/**
 * Capture Module Index
 */

export { initTabListener, captureTab, manualCapture } from './tab_listener';
export { startDwellTimer, pauseDwellTimer, getDwellTime, clearDwellTimer } from './dwell_timer';
export { isAllowed, isBrowserPage, isAuthPage, getBlockReason } from './content_guard';
