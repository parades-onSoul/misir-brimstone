/**
 * Gemini Output Validation
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

// Expected output ranges per mode
const OUTPUT_LIMITS = {
  standard: { min: 4, max: 8 },
  advanced: { min: 7, max: 12 },
  fast: { min: 3, max: 5 },
};

/**
 * Validate and clean Gemini output
 */
export function validateGeminiOutput(
  data: unknown,
  mode: PromptMode
): SubspaceWithMarkers[] {
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

  for (const subspace of data) {
    // Remove duplicates within subspace
    const uniqueMarkers = new Set(
      (subspace.markers as string[])
        .map((m) => m.toLowerCase().trim())
        .filter((m) => m.length > 0)
    );

    const cleanedMarkers: string[] = [];

    for (const marker of uniqueMarkers) {
      // Check if banned
      if (BANNED_MARKERS.includes(marker.toLowerCase())) {
        console.warn(`Filtering banned marker: "${marker}"`);
        continue;
      }

      // Check global duplicates
      if (allMarkersGlobal.has(marker)) {
        console.warn(`Filtering duplicate marker across subspaces: "${marker}"`);
        continue;
      }

      allMarkersGlobal.add(marker);
      cleanedMarkers.push(marker);
    }

    // Require at least 2 markers per subspace
    if (cleanedMarkers.length < 2) {
      console.warn(`Subspace "${subspace.name}" has insufficient markers after filtering`);
      continue;
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

  // Rule 4: Quantity validation
  const limits = OUTPUT_LIMITS[mode];
  const count = validated.length;

  if (count < limits.min || count > limits.max) {
    console.warn(
      `Subspace count ${count} outside expected range ${limits.min}-${limits.max} for mode ${mode}`
    );
    // Don't fail - prefer imperfect result over no result
  }

  if (validated.length === 0) {
    throw new Error('All subspaces filtered out during validation');
  }

  return validated;
}

/**
 * Check if a marker is high quality
 */
export function isQualityMarker(marker: string): boolean {
  const cleaned = marker.toLowerCase().trim();
  
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
