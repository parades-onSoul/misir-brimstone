/**
 * Layer 3: Semantics (The Validator)
 * 
 * Lightweight content quality check.
 * Ensures the page isn't just an SEO farm or navigation wrapper.
 * 
 * This runs in the content script context where DOM is available.
 */

import type { SemanticResult } from './types';

// ============================================================================
// CONFIGURATION
// ============================================================================

export const SEMANTIC_THRESHOLDS = {
  MIN_PARAGRAPHS: 2,
  MIN_AVG_WORDS_PER_PARA: 20,
  MAX_LINK_DENSITY: 0.4,      // > 40% link text = nav page
  MIN_SENTENCES: 3,
  CONFIDENCE_THRESHOLD: 0.6,  // Need 60% to pass
};

// ============================================================================
// SEMANTIC VALIDATION
// ============================================================================

/**
 * Validate content quality from raw HTML/DOM.
 * Call this from content script where document is available.
 */
export function validateSemantics(doc: Document = document): SemanticResult {
  // Get the main content container
  const container = doc.querySelector('main, article, [role="main"], .content, #content') || doc.body;
  const bodyText = container.textContent || '';
  
  // =========================================
  // GATHER METRICS
  // =========================================
  
  // Paragraph analysis
  const paragraphs = container.querySelectorAll('p');
  const paragraphTexts = Array.from(paragraphs)
    .map(p => (p.textContent || '').trim())
    .filter(t => t.length > 20);
  
  const paragraphCount = paragraphTexts.length;
  const totalWords = bodyText.split(/\s+/).filter(w => w.length > 0).length;
  const avgWordsPerParagraph = paragraphCount > 0 
    ? totalWords / paragraphCount 
    : 0;
  
  // Sentence count
  const sentences = bodyText.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const sentenceCount = sentences.length;
  
  // Link density (detect link farms / nav pages)
  const allLinks = container.querySelectorAll('a');
  const linkText = Array.from(allLinks)
    .map(a => (a.textContent || '').trim())
    .join(' ');
  const linkDensity = bodyText.length > 0 
    ? linkText.length / bodyText.length 
    : 0;
  
  // Structure detection
  const hasHeaders = container.querySelectorAll('h1, h2, h3, h4').length > 0;
  const hasLists = container.querySelectorAll('ul, ol').length > 0;
  const hasBlockquotes = container.querySelectorAll('blockquote').length > 0;
  const hasStructuredContent = hasHeaders || hasLists || hasBlockquotes;
  
  // =========================================
  // SCORING
  // =========================================
  
  let score = 0;
  const reasons: string[] = [];
  
  // Check 1: Structure (30%)
  if (paragraphCount >= SEMANTIC_THRESHOLDS.MIN_PARAGRAPHS) {
    score += 0.3;
  } else {
    reasons.push(`only ${paragraphCount} paragraphs`);
  }
  
  // Check 2: Density (20%)
  if (avgWordsPerParagraph >= SEMANTIC_THRESHOLDS.MIN_AVG_WORDS_PER_PARA) {
    score += 0.2;
  } else {
    reasons.push(`avg ${Math.round(avgWordsPerParagraph)} words/para`);
  }
  
  // Check 3: Link Density (20%) - Detect Link Farms
  if (linkDensity <= SEMANTIC_THRESHOLDS.MAX_LINK_DENSITY) {
    score += 0.2;
  } else {
    reasons.push(`${Math.round(linkDensity * 100)}% link density`);
  }
  
  // Check 4: Substance (30%)
  if (sentenceCount >= SEMANTIC_THRESHOLDS.MIN_SENTENCES) {
    score += 0.3;
  } else {
    reasons.push(`only ${sentenceCount} sentences`);
  }
  
  // =========================================
  // VERDICT
  // =========================================
  
  const isValid = score >= SEMANTIC_THRESHOLDS.CONFIDENCE_THRESHOLD;
  
  return {
    isValid,
    confidence: score,
    reason: isValid 
      ? undefined 
      : `Low confidence (${Math.round(score * 100)}%): ${reasons.join(', ')}`,
    metrics: {
      paragraphCount,
      sentenceCount,
      avgWordsPerParagraph,
      linkDensity,
      hasStructuredContent,
    },
  };
}

/**
 * Quick validation for pre-filtering (faster, less accurate)
 */
export function quickValidate(doc: Document = document): { valid: boolean; reason: string } {
  // Fast checks without full analysis
  
  // 1. Check for article/main content structure
  const hasMainContent = !!doc.querySelector('main, article, [role="main"]');
  if (!hasMainContent) {
    const hasContentDiv = !!doc.querySelector('.content, #content, .post, .article');
    if (!hasContentDiv) {
      return { valid: false, reason: 'No identifiable content container' };
    }
  }
  
  // 2. Check for minimum paragraph elements
  const paragraphs = doc.querySelectorAll('p');
  if (paragraphs.length < 2) {
    return { valid: false, reason: `Only ${paragraphs.length} paragraphs` };
  }
  
  // 3. Check for excessive navigation
  const links = doc.querySelectorAll('a');
  const navLinks = doc.querySelectorAll('nav a, header a, footer a');
  const contentLinks = links.length - navLinks.length;
  
  if (navLinks.length > 0 && navLinks.length > contentLinks * 3) {
    return { valid: false, reason: 'Mostly navigation links' };
  }
  
  // 4. Check for actual text content
  const bodyText = doc.body.textContent || '';
  const wordCount = bodyText.split(/\s+/).filter(w => w.length > 2).length;
  if (wordCount < 100) {
    return { valid: false, reason: `Only ~${wordCount} words` };
  }
  
  return { valid: true, reason: 'Basic structure checks passed' };
}
