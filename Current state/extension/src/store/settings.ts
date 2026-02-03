/**
 * Settings Storage
 * 
 * User preferences stored in chrome.storage.sync
 */

import type { SensorSettings } from '../types';

const SETTINGS_KEY = 'sensor_settings';

// ============================================================================
// DEFAULTS
// ============================================================================

export const DEFAULT_SETTINGS: SensorSettings = {
  enabled: true,
  minWordCount: 100,
  minDwellTimeMs: 5000,
  apiUrl: 'http://localhost:8000/api/v1',
};

// ============================================================================
// SETTINGS OPERATIONS
// ============================================================================

/**
 * Get current settings
 */
export async function getSettings(): Promise<SensorSettings> {
  const result = await chrome.storage.sync.get(SETTINGS_KEY);
  const stored = result[SETTINGS_KEY] || {};
  
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
  };
}

/**
 * Update settings
 */
export async function updateSettings(
  updates: Partial<SensorSettings>
): Promise<SensorSettings> {
  const current = await getSettings();
  const updated = { ...current, ...updates };
  
  await chrome.storage.sync.set({ [SETTINGS_KEY]: updated });
  
  return updated;
}

/**
 * Reset to defaults
 */
export async function resetSettings(): Promise<SensorSettings> {
  await chrome.storage.sync.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
  return DEFAULT_SETTINGS;
}

/**
 * Listen for settings changes
 */
export function onSettingsChange(
  callback: (settings: SensorSettings) => void
): () => void {
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
    if (changes[SETTINGS_KEY]) {
      callback(changes[SETTINGS_KEY].newValue);
    }
  };
  
  chrome.storage.sync.onChanged.addListener(listener);
  
  return () => {
    chrome.storage.sync.onChanged.removeListener(listener);
  };
}
