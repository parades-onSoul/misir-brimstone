/**
 * Sensor Types
 * 
 * Core type definitions for the sensor extension.
 */

// ============================================================================
// ARTIFACT TYPES
// ============================================================================

/** Artifact engagement level */
export type ArtifactType = 'ambient' | 'engaged' | 'committed';

/** Content source detection */
export type ContentSource = 'web' | 'video' | 'ai' | 'document';

/** How the signal was captured */
export type CaptureMethod = 'auto' | 'manual';

// ============================================================================
// SIGNAL
// ============================================================================

/** A captured browsing signal (internal storage) */
export interface Signal {
  id: string;
  url: string;
  title: string;
  content: string;
  excerpt?: string;
  wordCount: number;
  domain?: string;
  
  // Engagement metrics
  dwellTimeMs: number;
  adjustedScoreMs: number;  // Time * Multiplier
  scrollDepth: number;      // 0-1
  readingDepth: number;     // 0-1.5 multiplier
  
  // Classification
  artifactType: ArtifactType;
  contentType: ContentType;
  contentSource: ContentSource;  // Legacy
  captureMethod: CaptureMethod;
  sourcePlatform?: string;  // e.g., 'Youtube', 'Github'
  
  // Semantic validation (only for engaged/committed)
  validation?: {
    paragraphCount: number;
    confidenceScore: number;
  };
  
  // State
  capturedAt: number;
  synced: boolean;
}

// ============================================================================
// CONTENT EXTRACTION
// ============================================================================

/** Result from content script extraction */
export interface ExtractionResult {
  success: boolean;
  data?: {
    title: string;
    url: string;
    content: string;
    excerpt: string;
    wordCount: number;
  };
  error?: string;
}

/** Reading metrics from content script */
export interface ReadingMetrics {
  dwellTimeMs: number;
  scrollDepth: number;
  readingDepth: number;
  scrollEvents: number;
}

// ============================================================================
// CONTENT TYPES (for classification)
// ============================================================================

export type ContentType = 'article' | 'video' | 'chat' | 'code' | 'social' | 'documentation' | 'forum' | 'unknown';

// ============================================================================
// API PAYLOADS
// ============================================================================

/**
 * The strict payload sent from Extension to Backend.
 * This dictates the database schema.
 */
export interface ArtifactPayload {
  // 1. Context (The "What")
  url: string;
  title: string;
  domain: string;
  captured_at: string;  // ISO Timestamp
  
  // 2. Classification (The "Type")
  content_type: ContentType;
  source_platform?: string;  // e.g., 'Youtube', 'Github'
  
  // 3. Heuristics (The "Cost")
  metrics: {
    dwell_time_ms: number;        // Actual clock time
    adjusted_score_ms: number;    // Calculated score (Time * Multiplier)
    scroll_depth_percent?: number;
    engagement_level: ArtifactType;
  };
  
  // 4. Semantics (The "Proof")
  // Only present if engagement_level != 'ambient'
  validation?: {
    word_count: number;
    paragraph_count: number;
    confidence_score: number;     // 0-1 from validation checks
    top_keywords?: string[];      // Optional, can leave for backend
  };
  
  // 5. Content (Only for engaged/committed)
  content?: {
    full_text: string;
    excerpt: string;
  };
}

/** Legacy SignalPayload - deprecated, use ArtifactPayload */
export interface SignalPayload {
  url: string;
  title: string;
  content: string;
  excerpt?: string;
  word_count: number;
  domain?: string;
  dwell_time_ms: number;
  scroll_depth: number;
  reading_depth: number;
  artifact_type: ArtifactType;
  content_source: ContentSource;
  capture_method: CaptureMethod;
  captured_at: string;
}

/** Generic API response */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// SETTINGS
// ============================================================================

export interface SensorSettings {
  enabled: boolean;
  minWordCount: number;
  minDwellTimeMs: number;
  apiUrl: string;
}
