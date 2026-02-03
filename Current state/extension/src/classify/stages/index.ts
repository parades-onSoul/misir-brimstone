/**
 * Stages Module Index
 * 
 * The two-stage Smart Sensor pipeline:
 * - Stage 1: Recognize (fast marker matching)
 * - Stage 2: Relevance (semantic centroid matching)
 */

// Stage 1: Fast pattern matching
export { 
  recognize, 
  hasAnyMarkerMatch 
} from './recognize';

// Stage 2: Semantic similarity
export { 
  checkSemanticRelevance, 
  getRelevanceDetails,
  getContentPreview,
  type RelevanceDetail,
} from './relevance';
