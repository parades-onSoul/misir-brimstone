/**
 * NLP Engine — wink-nlp wrapper
 *
 * Provides keyword extraction, entity recognition, and content quality
 * analysis using wink-nlp in the background service worker.
 *
 * Falls back to simple regex-based analysis if wink-nlp fails to load.
 */
import type { NLPResult } from '@/types';

let nlpInstance: any = null;
let nlpAvailable = false;
let initPromise: Promise<void> | null = null;

function isServiceWorkerContext(): boolean {
  const swGlobal = (globalThis as any).ServiceWorkerGlobalScope;
  return typeof swGlobal !== 'undefined' && globalThis instanceof swGlobal;
}

// ── Lazy init ────────────────────────────────────────

async function ensureNLP(): Promise<boolean> {
  if (nlpAvailable) return true;
  if (initPromise) {
    await initPromise;
    return nlpAvailable;
  }

  initPromise = (async () => {
    try {
      // Avoid loading wink-nlp in the service worker
      if (isServiceWorkerContext()) {
        console.log('[Misir NLP] Service worker context detected, using fallback');
        nlpAvailable = false;
        return;
      }

      const winkNLP = (await import('wink-nlp')).default;
      const model = (await import('wink-eng-lite-web-model')).default;
      nlpInstance = winkNLP(model);
      nlpAvailable = true;
      console.log('[Misir NLP] wink-nlp loaded successfully');
    } catch (e) {
      console.warn('[Misir NLP] wink-nlp failed to load, using fallback:', e);
      nlpAvailable = false;
    }
  })();

  await initPromise;
  return nlpAvailable;
}

// ── Stop words ───────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'up', 'about', 'into', 'over', 'after', 'beneath', 'under', 'above',
  'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either',
  'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most',
  'other', 'some', 'such', 'no', 'only', 'own', 'same', 'than',
  'too', 'very', 'just', 'because', 'as', 'until', 'while', 'that',
  'this', 'these', 'those', 'it', 'its', 'i', 'me', 'my', 'we', 'our',
  'you', 'your', 'he', 'him', 'his', 'she', 'her', 'they', 'them',
  'their', 'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how',
  'also', 'like', 'get', 'make', 'go', 'know', 'take', 'see', 'come',
  'think', 'look', 'want', 'give', 'use', 'find', 'tell', 'ask',
  'work', 'seem', 'feel', 'try', 'leave', 'call', 'new', 'first', 'last',
]);

// ── Public API ───────────────────────────────────────

/**
 * Full content analysis with wink-nlp.
 * Returns keywords, entities, sentence stats, and density score.
 */
export async function analyzeContent(text: string): Promise<NLPResult> {
  const ready = await ensureNLP();

  if (ready && nlpInstance) {
    return analyzeWithWink(text);
  }
  return analyzeWithFallback(text);
}

/**
 * Quick keyword extraction — lighter than full analysis.
 */
export async function extractKeywords(text: string, topN = 10): Promise<string[]> {
  const result = await analyzeContent(text.substring(0, 5000));
  return result.keywords.slice(0, topN);
}

/**
 * Check if NLP engine is available.
 */
export async function isNLPReady(): Promise<boolean> {
  return ensureNLP();
}

// ── wink-nlp analysis ────────────────────────────────

function analyzeWithWink(text: string): NLPResult {
  const trimmed = text.substring(0, 10000);
  const doc = nlpInstance.readDoc(trimmed);

  // Extract tokens
  const tokens: string[] = [];
  doc.tokens().each((t: any) => {
    const val = t.out().toLowerCase();
    if (val.length > 2 && !STOP_WORDS.has(val) && /^[a-z]+$/i.test(val)) {
      tokens.push(val);
    }
  });

  // Frequency-based keywords
  const freq: Record<string, number> = {};
  tokens.forEach((t) => {
    freq[t] = (freq[t] || 0) + 1;
  });
  const keywords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word);

  // Extract entities
  const entities: string[] = [];
  doc.entities().each((e: any) => {
    const val = e.out().trim();
    if (val.length > 1) entities.push(val);
  });

  // Sentence stats
  const sentences = doc.sentences().length();
  const avgLen =
    sentences > 0
      ? trimmed.split(/\s+/).length / sentences
      : 0;

  // Content density: higher = more substantive
  const uniqueRatio = new Set(tokens).size / Math.max(tokens.length, 1);
  const lengthFactor = Math.min(1, tokens.length / 200);
  const density = uniqueRatio * 0.5 + lengthFactor * 0.3 + Math.min(1, entities.length / 5) * 0.2;

  return {
    keywords,
    entities: [...new Set(entities)].slice(0, 10),
    sentenceCount: sentences,
    avgSentenceLength: Math.round(avgLen * 10) / 10,
    contentDensity: Math.round(density * 100) / 100,
  };
}

// ── Fallback regex analysis ──────────────────────────

function analyzeWithFallback(text: string): NLPResult {
  const trimmed = text.substring(0, 10000).toLowerCase();
  const words = trimmed
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  const freq: Record<string, number> = {};
  words.forEach((w) => {
    freq[w] = (freq[w] || 0) + 1;
  });

  const keywords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word);

  const sentences = trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 0);

  const uniqueRatio = new Set(words).size / Math.max(words.length, 1);
  const density = uniqueRatio * 0.6 + Math.min(1, words.length / 200) * 0.4;

  return {
    keywords,
    entities: [],
    sentenceCount: sentences.length,
    avgSentenceLength:
      sentences.length > 0
        ? Math.round((words.length / sentences.length) * 10) / 10
        : 0,
    contentDensity: Math.round(density * 100) / 100,
  };
}
