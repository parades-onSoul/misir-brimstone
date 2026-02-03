/**
 * NLP Engine (wink-nlp wrapper)
 * 
 * Lightweight NLP processing for the Smart Sensor.
 * Uses wink-eng-lite-web-model (~1MB) for:
 * - Tokenization
 * - Stop word removal
 * - Lemmatization (stemming)
 * 
 * This runs in milliseconds and produces clean tokens
 * ready for vector conversion.
 */

import winkNLP from 'wink-nlp';
import model from 'wink-eng-lite-web-model';

// ============================================================================
// INITIALIZATION
// ============================================================================

// Initialize wink-nlp once (lazy singleton)
let nlpInstance: ReturnType<typeof winkNLP> | null = null;

function getNLP() {
  if (!nlpInstance) {
    nlpInstance = winkNLP(model);
  }
  return nlpInstance;
}

// ============================================================================
// CONTENT ANALYSIS
// ============================================================================

export interface AnalysisResult {
  tokens: string[];           // Clean, stemmed tokens
  wordCount: number;          // Total words (before filtering)
  uniqueTerms: number;        // Unique tokens after processing
  sentenceCount: number;      // Number of sentences
  entities?: EntityInfo[];    // Named entities (optional)
}

export interface EntityInfo {
  text: string;
  type: string;  // PERSON, ORG, PLACE, etc.
}

/**
 * Analyze content and extract clean tokens for vectorization.
 * 
 * @param text Raw text content
 * @param options Processing options
 */
export function analyzeContent(
  text: string,
  options: { extractEntities?: boolean; maxTokens?: number } = {}
): AnalysisResult {
  const nlp = getNLP();
  const its = nlp.its;
  
  // Read the document
  const doc = nlp.readDoc(text);
  
  // Get all tokens
  const allTokens = doc.tokens();
  const wordCount = allTokens.filter(t => t.out(its.type) === 'word').length();
  
  // Get clean tokens:
  // - Filter out stop words
  // - Only keep actual words (not punctuation)
  // - Get normalized form
  const filteredTokens = allTokens
    .filter(t => !t.out(its.stopWordFlag) && t.out(its.type) === 'word');
  
  // Get token values and normalize (lowercase)
  const tokens = (filteredTokens.out() as string[]).map(t => t.toLowerCase());
  
  // Apply max tokens limit if specified
  const finalTokens = options.maxTokens 
    ? tokens.slice(0, options.maxTokens)
    : tokens;
  
  const result: AnalysisResult = {
    tokens: finalTokens,
    wordCount,
    uniqueTerms: new Set(finalTokens).size,
    sentenceCount: doc.sentences().length(),
  };
  
  // Optionally extract named entities
  if (options.extractEntities) {
    const entities = doc.entities().out(its.detail);
    result.entities = (entities as unknown[]).map((e: unknown) => {
      const entity = e as { value?: string; type?: string };
      return {
        text: entity.value || '',
        type: entity.type || 'UNKNOWN',
      };
    });
  }
  
  return result;
}

// ============================================================================
// QUICK TOKENIZE (Lighter weight)
// ============================================================================

/**
 * Quick tokenization for fast matching.
 * Less accurate but faster than full analysis.
 * 
 * @param text Raw text
 * @param limit Max tokens to return
 */
export function quickTokenize(text: string, limit = 500): string[] {
  const nlp = getNLP();
  const its = nlp.its;
  
  const doc = nlp.readDoc(text);
  
  const filteredTokens = doc.tokens()
    .filter(t => !t.out(its.stopWordFlag) && t.out(its.type) === 'word');
  
  return (filteredTokens.out() as string[])
    .map(t => t.toLowerCase())
    .slice(0, limit);
}

// ============================================================================
// TEXT CLEANING
// ============================================================================

/**
 * Pre-process text before NLP analysis.
 * Removes noise that could confuse tokenization.
 */
export function cleanText(text: string): string {
  return text
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove URLs
    .replace(/https?:\/\/[^\s]+/g, '')
    // Remove email addresses
    .replace(/[\w.-]+@[\w.-]+\.\w+/g, '')
    // Remove excessive punctuation
    .replace(/[!?]{2,}/g, '!')
    // Trim
    .trim();
}

// ============================================================================
// KEYWORD EXTRACTION
// ============================================================================

/**
 * Extract top keywords from text based on frequency.
 * Useful for quick content summarization.
 * 
 * @param text Raw text
 * @param topN Number of keywords to return
 */
export function extractKeywords(text: string, topN = 10): string[] {
  const { tokens } = analyzeContent(text);
  
  // Count frequencies
  const freq: Record<string, number> = {};
  for (const token of tokens) {
    freq[token] = (freq[token] || 0) + 1;
  }
  
  // Sort by frequency and return top N
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([term]) => term);
}
