/**
 * Classify Module Index
 * 
 * Smart Sensor Classification Pipeline:
 * 1. Context - Fast metadata scraping (content script)
 * 2. Recognize - Fast marker matching (background)
 * 3. Heuristics - Time/engagement assessment (background)
 * 4. Relevance - Semantic centroid matching (background)
 * 5. Semantics - Text quality validation (background)
 */

// ============================================================================
// TYPES (Strict contracts between layers)
// ============================================================================
export type {
  ContentType,
  EngagementLevel,
  ContextSignal,
  HeuristicResult,
  SemanticResult,
  ArtifactPayload,
  PipelineResult,
  // Smart Sensor types
  SpaceCentroid,
  Marker,
  UserMap,
  MatchResult,
} from './types';

// ============================================================================
// LAYER 1: CONTEXT (content script - fast metadata)
// ============================================================================
export { 
  extractPageContext, 
  detectContentType,
  type PageContext 
} from './context';

// ============================================================================
// LAYER 2: HEURISTICS (background - engagement assessment)
// ============================================================================
export { 
  assessHeuristics, 
  isBlockedUrl,
  MULTIPLIERS,
  THRESHOLDS,
} from './heuristics';

// ============================================================================
// LAYER 3: SEMANTICS (background - content validation)
// ============================================================================
export { 
  validateSemantics, 
  quickValidate,
  SEMANTIC_THRESHOLDS,
} from './semantics';

// ============================================================================
// SMART SENSOR STAGES
// ============================================================================
export {
  recognize,
  hasAnyMarkerMatch,
  checkSemanticRelevance,
  getRelevanceDetails,
  getContentPreview,
} from './stages';

// ============================================================================
// NLP & MATH UTILITIES
// ============================================================================
export {
  analyzeContent,
  quickTokenize,
  extractKeywords,
  cleanText,
} from './nlp';

export {
  cosineSimilarity,
  textToVector,
  topTerms,
  type Vector,
} from './math';

// ============================================================================
// PIPELINE (orchestrator)
// ============================================================================
export {
  processTabSession,
  buildArtifactPayload,
} from './pipeline';

// ============================================================================
// LEGACY EXPORTS (for backward compatibility)
// ============================================================================
export { 
  classifyArtifact, 
  getReadingDepth, 
  getEngagementLabel,
  getArtifactWeight 
} from './artifact_type';

export { 
  extractContent, 
  extractWithRetry, 
  getPageMetadata 
} from './content_extract';
