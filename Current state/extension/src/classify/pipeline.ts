/**
 * Pipeline (Orchestrator)
 * 
 * The Smart Sensor Pipeline:
 * 1. Context → Basic metadata (from content script)
 * 2. Recognize → Fast marker matching
 * 3. Heuristics → Time/engagement assessment
 * 4. Relevance → Semantic centroid matching (Smart Gate)
 * 5. Semantics → Content quality validation
 * 
 * Call this from background.ts when a tab closes.
 */

import type { 
  ContextSignal, 
  SemanticResult, 
  PipelineResult,
  EngagementLevel,
} from './types';
import { assessHeuristics, isBlockedUrl } from './heuristics';
import { recognize } from './stages/recognize';
import { checkSemanticRelevance } from './stages/relevance';
import { storage } from '../storage/db';

// ============================================================================
// PIPELINE ORCHESTRATOR
// ============================================================================

/**
 * Process a tab session through the Smart Sensor pipeline.
 * 
 * @param context - Context signal from Layer 1 (content script)
 * @param rawDwellTimeMs - Actual time spent on page
 * @param getSemantics - Async function to get semantic validation from content script
 * @param pageContent - Optional page content for semantic matching
 * @returns PipelineResult or null if discarded
 */
export async function processTabSession(
  context: ContextSignal, 
  rawDwellTimeMs: number,
  getSemantics: () => Promise<SemanticResult>,
  pageContent?: string
): Promise<PipelineResult | null> {
  
  console.log(`[Pipeline] Processing ${context.url} (${Math.round(rawDwellTimeMs/1000)}s)`);

  // =========================================
  // PRE-CHECK: URL Blocklist
  // =========================================
  const blockCheck = isBlockedUrl(context.url);
  if (blockCheck.blocked) {
    console.log(`[Pipeline] Blocked: ${blockCheck.reason}`);
    return null;
  }

  // =========================================
  // LOAD USER MAP (Markers + Centroids)
  // =========================================
  const userMap = await storage.getUserMap();
  const markers = userMap?.markers || [];
  const centroids = userMap?.centroids || [];

  // =========================================
  // STAGE 1: RECOGNIZE (Fast Marker Match)
  // =========================================
  const recognizeResult = recognize(context, markers);
  
  // If markers exist but none matched, early exit for short visits
  if (markers.length > 0 && !recognizeResult.pass && rawDwellTimeMs < 10000) {
    console.log('[Pipeline] No marker match + short visit → skip');
    return null;
  }

  // =========================================
  // LAYER 2: HEURISTICS (Time Assessment)
  // =========================================
  const heuristicResult = assessHeuristics(context, rawDwellTimeMs);
  
  if (heuristicResult.verdict === 'discard') {
    console.log(`[Pipeline] Discarded by Heuristics: ${heuristicResult.reason}`);
    return null;
  }
  
  console.log(`[Pipeline] Heuristics: ${heuristicResult.verdict} (${heuristicResult.reason})`);

  // =========================================
  // STAGE 2: RELEVANCE (Semantic Matching)
  // =========================================
  let matchResult: MatchResult | undefined;
  
  // Only run semantic matching if we have centroids and content
  if (centroids.length > 0 && pageContent && pageContent.length > 200) {
    matchResult = checkSemanticRelevance(pageContent, centroids, { quickMode: true });
    
    if (matchResult.pass) {
      console.log(`[Pipeline] Semantic match: ${matchResult.topMatch?.spaceName} (${matchResult.score}%)`);
    } else {
      console.log(`[Pipeline] No semantic match (best: ${matchResult.score}%)`);
      
      // If no marker match AND no semantic match, consider dropping
      if (!recognizeResult.pass && heuristicResult.verdict === 'ambient') {
        console.log('[Pipeline] No match + ambient → skip');
        return null;
      }
    }
  }

  // =========================================
  // LAYER 3: SEMANTICS (Content Validation)
  // =========================================
  let semanticResult: SemanticResult | undefined;
  
  if (heuristicResult.shouldValidateSemantics) {
    try {
      semanticResult = await getSemantics();
      
      console.log(`[Pipeline] Semantics: ${semanticResult.isValid ? 'VALID' : 'INVALID'} (${Math.round(semanticResult.confidence * 100)}%)`);
      
      if (!semanticResult.isValid) {
        console.log(`[Pipeline] Discarded by Semantics: ${semanticResult.reason}`);
        return null;
      }
    } catch (error) {
      console.log('[Pipeline] Semantics skipped (tab closed or error)');
    }
  } else {
    console.log('[Pipeline] Semantics skipped (ambient signal)');
  }

  // =========================================
  // ACCEPTED: Build result
  // =========================================
  console.log(`[Pipeline] ✓ Accepted as ${heuristicResult.verdict}`);
  
  const pipelineResult: PipelineResult = {
    accepted: true,
    engagement: heuristicResult.verdict as Exclude<EngagementLevel, 'discard'>,
    context,
    heuristics: heuristicResult,
    semantics: semanticResult,
    capturedAt: new Date().toISOString(),
  };

  // Attach match info if available
  if (matchResult && matchResult.pass) {
    (pipelineResult as any).matching = matchResult;
  }

  return pipelineResult;
}

// ============================================================================
// HELPER: Build Artifact Payload
// ============================================================================

import type { ArtifactPayload, MatchResult, ContentSource, ArtifactType, DecayRate } from './types';

/**
 * Map internal ContentType to database ContentSource
 * Only 4 sources: web, ai, video, pdf
 */
function mapContentSource(contentType: string): ContentSource {
  switch (contentType) {
    case 'video':
      return 'video';
    case 'chat':
      return 'ai';
    case 'pdf':
      return 'pdf';
    default:
      // article, forum, code, documentation, social, unknown → web
      return 'web';
  }
}

/**
 * Get base_weight from artifact_type (matches DB constraint)
 */
function getBaseWeight(artifactType: ArtifactType): 0.2 | 1.0 | 2.0 {
  switch (artifactType) {
    case 'ambient': return 0.2;
    case 'engaged': return 1.0;
    case 'committed': return 2.0;
  }
}

/**
 * Get decay_rate from artifact_type
 * - ambient: high decay (fleeting attention)
 * - engaged: medium decay
 * - committed: low decay (lasting interest)
 */
function getDecayRate(artifactType: ArtifactType): DecayRate {
  switch (artifactType) {
    case 'ambient': return 'high';
    case 'engaged': return 'medium';
    case 'committed': return 'low';
  }
}

/**
 * Convert pipeline result to API payload format
 * Matches the public.artifacts database schema
 */
export function buildArtifactPayload(
  result: PipelineResult & { matching?: MatchResult },
  content?: { fullText: string; excerpt: string },
  scrollDepthPercent: number = 0
): ArtifactPayload {
  const artifactType = result.engagement as ArtifactType;
  
  const payload: ArtifactPayload = {
    // Core identifiers
    url: result.context.url,
    title: result.context.title,
    domain: result.context.domain,
    
    // Classification
    artifact_type: artifactType,
    content_source: mapContentSource(result.context.contentType),
    
    // Weights
    base_weight: getBaseWeight(artifactType),
    decay_rate: getDecayRate(artifactType),
    
    // Engagement metrics
    dwell_time_ms: result.heuristics.rawDwellTimeMs,
    scroll_depth: scrollDepthPercent / 100, // Convert percent to 0-1
    reading_depth: result.semantics?.confidence ?? 1.0,
    
    // Content
    word_count: result.context.estimatedWordCount,
    
    // Relevance (default to semantic match score or 0.5)
    relevance: result.matching?.score 
      ? result.matching.score / 100 
      : 0.5,
    
    // Timestamps
    captured_at: result.capturedAt,
  };
  
  // Add extracted text for embedding (only for engaged/committed)
  if (content && artifactType !== 'ambient') {
    payload.extracted_text = content.fullText.slice(0, 50000); // Limit size
  }

  // Add space suggestions
  if (result.matching && result.matching.pass) {
    payload.suggested_space_ids = result.matching.suggestedSpaceIds;
    payload.top_similarity_score = result.matching.score / 100;
  }
  
  return payload;
}
