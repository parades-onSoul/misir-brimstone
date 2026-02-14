/**
 * Misir Sensor — Core Type Definitions
 * 
 * Aligned with backend DB enums:
 *   engagement_level: latent | discovered | engaged | saturated
 *   content_source:   web | pdf | video | chat | note | other
 */

// ── Enums (match DB schema exactly) ──────────────────

/** Engagement level — semantic ordering: latent < discovered < engaged < saturated */
export type EngagementLevel = 'latent' | 'discovered' | 'engaged' | 'saturated';

/** Content source — how the content was found */
export type ContentSource = 'web' | 'pdf' | 'video' | 'chat' | 'note' | 'other';

/** How the capture was triggered */
export type CaptureMethod = 'auto' | 'manual';

// ── Content Classification ───────────────────────────

/** NLP-detected content type */
export type ContentType =
  | 'article'
  | 'video'
  | 'chat'
  | 'code'
  | 'social'
  | 'documentation'
  | 'forum'
  | 'unknown';

// ── Content Extraction ───────────────────────────────

/** Result from content script page scrape */
export interface ScrapedPage {
  url: string;
  title: string;
  content: string;
  excerpt: string;
  wordCount: number;
  domain: string;
}

/** Reading metrics tracked by content script */
export interface ReadingMetrics {
  dwellTimeMs: number;
  scrollDepth: number;      // 0–1
  readingDepth: number;     // 0–1.5
  scrollEvents: number;
}

// ── NLP Analysis ─────────────────────────────────────

/** Token/structure analysis metadata from classifier pipeline */
export interface NLPResult {
  keywords: string[];
  entities: string[];
  sentenceCount: number;
  avgSentenceLength: number;
  contentDensity: number;    // 0–1 quality score
}

// ── Classification Pipeline ──────────────────────────

/** Full pipeline output before API send */
export interface ClassificationResult {
  engagementLevel: EngagementLevel;
  contentSource: ContentSource;
  contentType: ContentType;
  readingDepth: number;
  confidence: number;        // 0–1
  keywords: string[];
  nlpAvailable: boolean;
}

// ── API Payload ──────────────────────────────────────

/**
 * Payload sent to POST /api/v1/artifacts/capture
 * Must match backend CaptureRequest schema exactly.
 */
export interface CapturePayload {
  space_id: number;
  url: string;
  title?: string;
  content?: string;

  // Metrics (client-provided)
  reading_depth: number;
  scroll_depth: number;
  dwell_time_ms: number;
  word_count: number;
  engagement_level: EngagementLevel;
  content_source: ContentSource;
}

/** Backend capture response */
export interface CaptureResponse {
  artifact_id: number;
  signal_id: number;
  is_new: boolean;
  message: string;
}

// ── Spaces ───────────────────────────────────────────

export interface Space {
  id: number;
  name: string;
  description: string | null;
  user_id: string;
  artifact_count?: number;
  evidence?: number;
  created_at: string;
  updated_at: string;
}

export interface Subspace {
  id: number;
  space_id: number;
  user_id: string;
  name: string;
  description: string | null;
  artifact_count: number;
  confidence: number;
  learning_rate: number;
  created_at: string;
  updated_at: string;
}

export interface Marker {
  id: number;
  space_id: number;
  user_id: string;
  label: string;
  weight: number;
  created_at: string;
}

// ── Extension Config ─────────────────────────────────

export interface SensorConfig {
  apiUrl: string;
  userId?: string;
  enabled: boolean;
  minWordCount: number;
  minDwellTimeMs: number;
  autoCaptureEnabled: boolean;
  autoCaptureConfidenceThreshold: number;
  autoCaptureCooldownMs: number;
  autoCaptureSpaceId?: number;
}

export const DEFAULT_CONFIG: SensorConfig = {
  apiUrl: 'http://localhost:8000/api/v1',
  enabled: true,
  minWordCount: 50,
  minDwellTimeMs: 3000,
  autoCaptureEnabled: false,
  autoCaptureConfidenceThreshold: 0.55,
  autoCaptureCooldownMs: 1800000,
};

// ── Auth ─────────────────────────────────────────────

export interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
  accessToken: string | null;
}

export const EMPTY_AUTH: AuthState = {
  isAuthenticated: false,
  userId: null,
  email: null,
  accessToken: null,
};

// ── Messages (popup ↔ background ↔ content) ─────────

export type MessageType =
  | 'SCRAPE_PAGE'
  | 'GET_METRICS'
  | 'GET_CONFIG'
  | 'SET_CONFIG'
  | 'FETCH_SPACES'
  | 'CAPTURE'
  | 'HEALTH_CHECK'
  | 'GET_RECENT'
  | 'GET_NLP_STATUS'
  | 'CLASSIFY_CONTENT'
  | 'SIGN_IN'
  | 'SIGN_OUT'
  | 'GET_AUTH_STATE'
  | 'REFRESH_SESSION'
  | 'FETCH_SPACES_SUPABASE'
  | 'FETCH_SUBSPACES_SUPABASE'
  | 'FETCH_MARKERS_SUPABASE';

export interface Message {
  type: MessageType;
  [key: string]: unknown;
}

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ── Recent Capture (local storage) ───────────────────

export interface RecentCapture {
  url: string;
  title: string;
  domain: string;
  spaceId: number;
  engagementLevel: EngagementLevel;
  contentType: ContentType;
  capturedAt: string;
}
