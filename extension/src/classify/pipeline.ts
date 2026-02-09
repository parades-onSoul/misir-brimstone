/**
 * Classification Pipeline — Orchestrator
 *
 * Takes raw page data + metrics and produces a full ClassificationResult
 * by running NLP analysis, content detection, and engagement heuristics.
 *
 * Pipeline:
 *   1. Detect content type (pattern matching on URL/title)
 *   2. Analyse content with NLP (keyword extraction, quality scoring)
 *   3. Assess engagement heuristics (time * multiplier + scroll + words)
 *   4. Compute final reading depth
 *   5. Return ClassificationResult
 */
import type {
  ScrapedPage,
  ReadingMetrics,
  ClassificationResult,
  CapturePayload,
  EngagementLevel,
} from '@/types';
import { analyzeContent, isNLPReady } from './nlp';
import { detectContent } from './context';
import { assessEngagement } from './heuristics';

// ── Main Pipeline ────────────────────────────────────

/**
 * Run the full classification pipeline.
 */
export async function classifyPage(
  page: ScrapedPage,
  metrics: ReadingMetrics,
  engagement: EngagementLevel
): Promise<ClassificationResult> {
  // 1. Content type detection (fast, pattern-based)
  const detection = detectContent(page.url, page.title);

  // 2. NLP analysis (async, may use wink-nlp or fallback)
  let nlpResult;
  try {
    nlpResult = await analyzeContent(page.content.substring(0, 5000));
  } catch {
    nlpResult = {
      keywords: [],
      entities: [],
      sentenceCount: 0,
      avgSentenceLength: 0,
      contentDensity: 0,
    };
  }

  // 3. Engagement heuristics (refines the content-script level classification)
  const heuristics = assessEngagement(metrics, page.wordCount, detection.contentType);

  // Use the higher engagement level (heuristics may upgrade based on content type multiplier)
  const finalEngagement = higherEngagement(engagement, heuristics.engagementLevel);

  // 4. Reading depth (already computed by content script, but we can refine)
  const readingDepth = metrics.readingDepth;

  // 5. Confidence: combine detection confidence, NLP density, heuristic confidence
  const confidence =
    detection.confidence * 0.3 +
    nlpResult.contentDensity * 0.3 +
    heuristics.confidence * 0.4;

  const nlpReady = await isNLPReady();

  return {
    engagementLevel: finalEngagement,
    contentSource: detection.contentSource,
    contentType: detection.contentType,
    readingDepth,
    confidence: Math.round(confidence * 100) / 100,
    keywords: nlpResult.keywords,
    nlpAvailable: nlpReady,
  };
}

/**
 * Build a CapturePayload from page data + classification.
 */
export function buildPayload(
  spaceId: number,
  page: ScrapedPage,
  metrics: ReadingMetrics,
  classification: ClassificationResult
): CapturePayload {
  return {
    space_id: spaceId,
    url: page.url,
    title: page.title,
    content: page.content.substring(0, 30000), // cap content for API

    reading_depth: classification.readingDepth,
    scroll_depth: metrics.scrollDepth,
    dwell_time_ms: metrics.dwellTimeMs,
    word_count: page.wordCount,
    engagement_level: classification.engagementLevel,
    content_source: classification.contentSource,
  };
}

// ── Helpers ──────────────────────────────────────────

const ENGAGEMENT_ORDER: EngagementLevel[] = ['ambient', 'engaged', 'committed'];

function higherEngagement(a: EngagementLevel, b: EngagementLevel): EngagementLevel {
  const ia = ENGAGEMENT_ORDER.indexOf(a);
  const ib = ENGAGEMENT_ORDER.indexOf(b);
  return ia >= ib ? a : b;
}
