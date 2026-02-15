/**
 * Groq Output Validation
 * 
 * Enforces quality rules and prevents garbage outputs
 */

import type { PromptMode, SubspaceWithMarkers } from './groq-prompts';

// Banned generic markers that provide no value
const BANNED_MARKERS = [
  'concept',
  'idea',
  'thing',
  'stuff',
  'misc',
  'other',
  'advanced',
  'basic',
  'important',
  'relevant',
  'related',
  'general',
  'specific',
  'various',
];

export const MODE_MARKER_LIMITS: Record<PromptMode, { min: number; max: number }> = {
  standard: { min: 4, max: 6 },
  advanced: { min: 5, max: 6 },
  fast: { min: 3, max: 4 },
};

// Expected output ranges per mode
const OUTPUT_LIMITS = {
  standard: { min: 4, max: 8 },
  advanced: { min: 7, max: 12 },
  fast: { min: 3, max: 5 },
};

export interface ValidationOptions {
  enforceMarkerMinimum?: boolean;
}

function normalizeMarker(marker: string): string {
  return marker.toLowerCase().trim();
}

function dedupeSubspaceMarkers(markers: Array<{ text: string; weight: number }>): Array<{ text: string; weight: number }> {
  const seen = new Set<string>();
  return markers.filter((m) => {
    const normalized = normalizeMarker(m.text);
    if (normalized.length === 0 || seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

function filterAndLimitMarkers(
  markers: Array<{ text: string; weight: number }>,
  globalMarkers: Set<string>,
  mode: PromptMode
): Array<{ text: string; weight: number }> {
  const limits = MODE_MARKER_LIMITS[mode];
  const cleaned: Array<{ text: string; weight: number }> = [];

  for (const markerObj of dedupeSubspaceMarkers(markers)) {
    const marker = markerObj.text;
    const normalized = normalizeMarker(marker);

    if (BANNED_MARKERS.includes(normalized)) {
      console.warn(`Filtering banned marker: "${marker}"`);
      continue;
    }

    // Keep exact normalized global uniqueness only.
    if (globalMarkers.has(normalized)) {
      console.warn(`Filtering duplicate marker across subspaces: "${marker}"`);
      continue;
    }

    cleaned.push(markerObj);
    globalMarkers.add(normalized);

    if (cleaned.length >= limits.max) {
      break;
    }
  }

  return cleaned;
}

/**
 * Validate and clean Groq output
 */
export function validateGroqOutput(
  data: unknown,
  mode: PromptMode,
  options: ValidationOptions = {}
): SubspaceWithMarkers[] {
  const enforceMarkerMinimum = options.enforceMarkerMinimum ?? true;

  // Rule 1: Must be an array
  if (!Array.isArray(data)) {
    throw new Error('Output must be an array');
  }

  if (data.length === 0) {
    throw new Error('Empty output array');
  }

  // Rule 2: Check required fields
  const required = ['name', 'markers'];
  for (const item of data) {
    if (typeof item !== 'object' || item === null) {
      throw new Error('Each subspace must be an object');
    }

    for (const field of required) {
      if (!(field in item)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!Array.isArray(item.markers)) {
      throw new Error(`markers must be an array in subspace "${item.name}"`);
    }
  }

  // Rule 3: Marker quality & global deduplication
  const allMarkersGlobal = new Set<string>();
  const validated: SubspaceWithMarkers[] = [];
  const underfilledSubspaces: string[] = [];
  const markerLimits = MODE_MARKER_LIMITS[mode];

  for (const subspace of data) {
    // Ensure markers are objects with text/weight (backwards compatibility for strings)
    const rawMarkers: Array<{ text: string; weight: number }> = (subspace.markers as any[]).map(m => {
      if (typeof m === 'string') return { text: m, weight: 1.0 };
      return { text: m.text, weight: m.weight || 1.0 };
    });

    const cleanedMarkers = filterAndLimitMarkers(rawMarkers, allMarkersGlobal, mode);

    if (cleanedMarkers.length < markerLimits.min) {
      underfilledSubspaces.push(
        `"${String(subspace.name)}" (${cleanedMarkers.length}/${markerLimits.min})`
      );
    }

    validated.push({
      name: subspace.name,
      description: subspace.description,
      markers: cleanedMarkers,
      depth: subspace.depth,
      prerequisites: subspace.prerequisites,
      suggested_study_order: subspace.suggested_study_order,
    });
  }

  if (validated.length === 0) {
    throw new Error('All subspaces filtered out during validation');
  }

  if (enforceMarkerMinimum && underfilledSubspaces.length > 0) {
    throw new Error(
      `Underfilled markers for mode "${mode}": ${underfilledSubspaces.join(', ')}`
    );
  }

  // Rule 4: Quantity validation
  const limits = OUTPUT_LIMITS[mode];
  const count = validated.length;

  if (count < limits.min || count > limits.max) {
    console.warn(
      `Subspace count ${count} outside expected range ${limits.min}-${limits.max} for mode ${mode}`
    );
    // Don't fail - prefer imperfect result over no result
  }

  return validated;
}

/**
 * Check if a marker is high quality
 */
export function isQualityMarker(marker: string): boolean {
  const cleaned = normalizeMarker(marker);

  // Too short
  if (cleaned.length < 2) {
    return false;
  }

  // Banned terms
  if (BANNED_MARKERS.includes(cleaned)) {
    return false;
  }

  // Just numbers
  if (/^\d+$/.test(cleaned)) {
    return false;
  }

  return true;
}

/**
 * Merge LLM repair markers into validated subspaces while preserving
 * global uniqueness and mode-specific marker limits.
 */
export function applyMarkerRepairs(
  subspaces: SubspaceWithMarkers[],
  repairsBySubspace: Record<string, string[]>,
  mode: PromptMode
): SubspaceWithMarkers[] {
  const limits = MODE_MARKER_LIMITS[mode];
  const globallyUsed = new Set<string>();

  for (const subspace of subspaces) {
    for (const marker of subspace.markers) {
      globallyUsed.add(normalizeMarker(marker.text));
    }
  }

  return subspaces.map((subspace) => {
    const key = String(subspace.name).toLowerCase().trim();
    const repairCandidates = repairsBySubspace[key] ?? [];
    if (repairCandidates.length === 0) {
      return subspace;
    }

    const updatedMarkers = [...subspace.markers];
    const localSet = new Set(updatedMarkers.map((m) => normalizeMarker(m.text)));

    for (const rawCandidate of repairCandidates) {
      if (updatedMarkers.length >= limits.max) {
        break;
      }

      const candidate = normalizeMarker(rawCandidate);
      if (!isQualityMarker(candidate)) {
        continue;
      }
      if (localSet.has(candidate) || globallyUsed.has(candidate)) {
        continue;
      }

      const newMarker = { text: candidate, weight: 0.8 }; // Default weight for repairs
      updatedMarkers.push(newMarker);
      localSet.add(candidate);
      globallyUsed.add(candidate);
    }

    return { ...subspace, markers: updatedMarkers };
  });
}
