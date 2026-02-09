/**
 * Content Extraction
 * 
 * Extracts clean content from pages via content script.
 */

import type { ExtractionResult } from '../types';

/**
 * Extract content from a tab
 */
export async function extractContent(tabId: number): Promise<ExtractionResult> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { action: 'extract' });
    return response as ExtractionResult;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Extraction failed',
    };
  }
}

/**
 * Extract with retry (for race conditions with page load)
 */
export async function extractWithRetry(
  tabId: number,
  maxAttempts = 3,
  delayMs = 500
): Promise<ExtractionResult> {
  let lastError: string = 'Unknown error';
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await extractContent(tabId);
    
    if (result.success) {
      return result;
    }
    
    lastError = result.error || 'Extraction failed';
    
    // Check if it's a connection error (content script not ready)
    if (lastError.includes('Receiving end does not exist')) {
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, delayMs * attempt));
        continue;
      }
    }
    
    // Other errors - don't retry
    break;
  }
  
  return {
    success: false,
    error: lastError,
  };
}

/**
 * Get page metadata without full extraction
 */
export async function getPageMetadata(tabId: number): Promise<{
  title: string;
  description?: string;
  url: string;
} | null> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { action: 'getMetadata' });
    return response;
  } catch {
    return null;
  }
}
