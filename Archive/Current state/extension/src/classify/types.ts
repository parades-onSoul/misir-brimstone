/**
 * Classification Types (Contract)
 * 
 * Strict typing for data moving between classification layers.
 * Aligned with the Supabase database schema.
 */

// ============================================================================
// DATABASE ENUMS (from schema constraints)
// ============================================================================

/**
 * Maps to artifacts.content_source CHECK constraint
 * Simplified to 4 core sources
 */
export type ContentSource = 'web' | 'ai' | 'video' | 'pdf';

/**
 * Maps to artifacts.artifact_type CHECK constraint
 */
export type ArtifactType = 'ambient' | 'engaged' | 'committed';

/**
 * Maps to artifacts.decay_rate CHECK constraint
 */
export type DecayRate = 'high' | 'medium' | 'low';

/**
 * Maps to signals.source_type CHECK constraint
 */
export type SignalSourceType = 'extension' | 'backend' | 'batch' | 'reprocessing';

/**
 * Internal classification (includes 'discard' for pipeline filtering)
 */
export type EngagementLevel = ArtifactType | 'discard';

/**
 * Content type detection (internal, maps to content_source)
 */
export type ContentType = 
  | 'article'      // → 'web'
  | 'video'        // → 'video'
  | 'chat'         // → 'ai'
  | 'code'         // → 'web'
  | 'forum'        // → 'web'
  | 'social'       // → 'web' (but may be discarded by heuristics)
  | 'documentation'// → 'web'
  | 'pdf'          // → 'pdf'
  | 'unknown';     // → 'web'

// ============================================================================
// LAYER 1: CONTEXT (What was captured)
// ============================================================================

export interface ContextSignal {
  url: string;
  title: string;
  domain: string;
  contentType: ContentType;
  estimatedWordCount: number;
  hasVideo: boolean;
  hasCode: boolean;
  language?: string;
  author?: string;
  publishedAt?: string;
}

// ============================================================================
// LAYER 2: HEURISTICS (The cost/value assessment)
// ============================================================================

export interface HeuristicResult {
  verdict: EngagementLevel;
  adjustedScoreMs: number;
  rawDwellTimeMs: number;
  multiplierUsed: number;
  shouldValidateSemantics: boolean;
  reason: string;
}

// ============================================================================
// LAYER 3: SEMANTICS (Content quality proof)
// ============================================================================

export interface SemanticResult {
  isValid: boolean;
  confidence: number;  // 0 to 1
  reason?: string;
  metrics: {
    paragraphCount: number;
    sentenceCount: number;
    avgWordsPerParagraph: number;
    linkDensity: number;
    hasStructuredContent: boolean;
  };
}

// ============================================================================
// PIPELINE OUTPUT
// ============================================================================

export interface PipelineResult {
  accepted: boolean;
  engagement: EngagementLevel;
  context: ContextSignal;
  heuristics: HeuristicResult;
  semantics?: SemanticResult;
  capturedAt: string;
}

// ============================================================================
// ARTIFACT PAYLOAD (What gets sent to backend - matches artifacts table)
// ============================================================================

/**
 * Maps to public.artifacts table
 * Backend will add: id, user_id, space_id, subspace_id, content_embedding
 */
export interface ArtifactPayload {
  // Core identifiers (backend assigns id, user_id)
  url: string;                      // NOT NULL
  title: string;                    // NOT NULL
  domain: string;                   // For display/grouping (not in DB but useful)
  
  // Classification
  artifact_type: ArtifactType;      // 'ambient' | 'engaged' | 'committed'
  content_source: ContentSource;    // 'blog' | 'video' | 'ai' | 'document' | 'note'
  
  // Weights (from artifact_type)
  base_weight: 0.2 | 1.0 | 2.0;     // ambient=0.2, engaged=1.0, committed=2.0
  decay_rate: DecayRate;            // 'high' | 'medium' | 'low'
  
  // Engagement metrics
  dwell_time_ms: number;            // Total time on page
  scroll_depth: number;             // 0-1, how far user scrolled
  reading_depth: number;            // 0-1, engagement quality score
  
  // Content (for embedding)
  extracted_text?: string;          // Full text for backend to embed
  word_count?: number;              // Estimated word count
  
  // Relevance (extension-computed similarity)
  relevance: number;                // 0-1, similarity to user's spaces
  
  // Timestamps
  captured_at: string;              // ISO timestamp (maps to created_at)
  
  // Session (optional, backend may track)
  session_id?: string;
  
  // Matching results (for backend space assignment)
  suggested_space_ids?: string[];   // Extension's best guess
  matched_marker_ids?: string[];    // Markers found in content (for subspace matching)
  top_similarity_score?: number;    // Highest centroid match
}

// ============================================================================
// SMART SENSOR: USER MAP (from backend)
// ============================================================================

/**
 * Maps to public.spaces table
 */
export interface Space {
  id: string;
  name: string;
  intention?: string;
  embedding?: number[];           // 384-dim vector
  created_at: string;
  last_updated_at: string;
}

/**
 * Maps to public.subspaces table
 */
export interface Subspace {
  id: string;
  space_id: string;
  name: string;
  markers: string[];              // jsonb array of marker labels
  display_order: number;
  centroid_embedding?: number[];  // 384-dim centroid vector
  centroid_artifact_count: number;
  centroid_updated_at?: string;
}

/**
 * Maps to public.markers table
 */
export interface Marker {
  id: string;
  label: string;
  space_id: string;               // Single space (DB constraint)
  embedding?: number[];           // 384-dim vector
  created_at: string;
  updated_at: string;
}

/**
 * A Space Centroid is a lightweight vector representation of a Space.
 * Derived from subspace centroids for local matching.
 * Uses term-frequency for fast similarity without full embeddings.
 */
export interface SpaceCentroid {
  spaceId: string;
  spaceName: string;
  vector: Record<string, number>;  // term -> weight (0-1) for local matching
  threshold: number;               // minimum similarity to qualify (0-1)
  lastUpdated: number;
}

/**
 * The User's Mental Map - downloaded from backend.
 * Contains spaces, subspaces, markers, and pre-computed centroids.
 */
export interface UserMap {
  userId: string;
  spaces: Space[];                 // Full space objects
  subspaces: Subspace[];           // All subspaces with their markers
  markers: Marker[];               // All markers for fast pattern matching
  centroids: SpaceCentroid[];      // Pre-computed centroids for semantic matching
  lastUpdated: number;
}

/**
 * Result from semantic matching stage
 */
export interface MatchResult {
  pass: boolean;
  score: number;                    // 0-100 similarity score
  suggestedSpaceIds: string[];      // Spaces that matched
  matchedMarkerIds: string[];       // Markers that triggered (Stage 1)
  topMatch?: {
    spaceId: string;
    spaceName: string;
    similarity: number;
  };
}
