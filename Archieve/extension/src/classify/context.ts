/**
 * Context Layer
 * 
 * Instant metadata scraping - cheap and fast.
 * Runs in content script, no full extraction needed.
 */

// ============================================================================
// CONTENT TYPES
// ============================================================================

export type ContentType = 
  | 'article'      // Blog, news, essay
  | 'video'        // YouTube, Vimeo, etc.
  | 'documentation'// Docs, API refs
  | 'chat'         // AI chat interfaces
  | 'social'       // Social media posts
  | 'code'         // GitHub, code repos
  | 'forum'        // Reddit, StackOverflow, HN
  | 'unknown';

export interface PageContext {
  url: string;
  domain: string;
  path: string;
  title: string;
  description?: string;
  contentType: ContentType;
  language?: string;
  publishedAt?: string;
  author?: string;
  ogImage?: string;
  wordCountEstimate: number;
  hasVideo: boolean;
  hasCode: boolean;
}

// ============================================================================
// CONTENT TYPE DETECTION
// ============================================================================

const CONTENT_TYPE_PATTERNS: Record<ContentType, RegExp[]> = {
  video: [
    /youtube\.com\/watch/,
    /youtu\.be\//,
    /vimeo\.com\//,
    /twitch\.tv\//,
    /dailymotion\.com/,
    /wistia\.com/,
    /loom\.com\/share/,
  ],
  documentation: [
    /\/docs\//,
    /\/documentation\//,
    /\.readthedocs\./,
    /docs\.[a-z]+\.com/,
    /developer\.[a-z]+\.com/,
    /devdocs\.io/,
    /\/api\//,
    /\/reference\//,
  ],
  chat: [
    /chat\.openai\.com/,
    /chatgpt\.com/,
    /claude\.ai/,
    /gemini\.google\.com/,
    /poe\.com/,
    /perplexity\.ai/,
    /you\.com\/chat/,
  ],
  social: [
    /twitter\.com/,
    /x\.com/,
    /facebook\.com/,
    /instagram\.com/,
    /linkedin\.com\/posts/,
    /threads\.net/,
  ],
  code: [
    /github\.com.*\/(blob|tree)\//,
    /gitlab\.com.*\/-\/(blob|tree)/,
    /bitbucket\.org.*\/src\//,
    /gist\.github\.com/,
    /codepen\.io/,
    /codesandbox\.io/,
    /replit\.com/,
  ],
  forum: [
    /reddit\.com\/r\/.*\/comments/,
    /news\.ycombinator\.com\/item/,
    /stackoverflow\.com\/questions/,
    /stackexchange\.com\/questions/,
    /discourse\./,
  ],
  article: [], // Default fallback
  unknown: [],
};

/**
 * Detect content type from URL
 */
export function detectContentType(url: string): ContentType {
  for (const [type, patterns] of Object.entries(CONTENT_TYPE_PATTERNS)) {
    if (type === 'article' || type === 'unknown') continue;
    for (const pattern of patterns) {
      if (pattern.test(url)) {
        return type as ContentType;
      }
    }
  }
  return 'article'; // Default assumption
}

// ============================================================================
// METADATA EXTRACTION (Content Script)
// ============================================================================

/**
 * Extract page context - runs in content script
 * Fast, lightweight, no full content extraction
 */
export function extractPageContext(): PageContext {
  const url = window.location.href;
  const parsedUrl = new URL(url);
  
  // Basic URL parsing
  const domain = parsedUrl.hostname.replace(/^www\./, '');
  const path = parsedUrl.pathname;
  
  // Detect content type
  let contentType = detectContentType(url);
  
  // Override based on page content hints
  if (contentType === 'article') {
    contentType = detectFromPage();
  }
  
  // Get meta tags
  const getMeta = (name: string): string | undefined => 
    document.querySelector(`meta[name="${name}"], meta[property="${name}"]`)
      ?.getAttribute('content') || undefined;
  
  // Estimate word count from visible text (fast approximation)
  const wordCountEstimate = estimateWordCount();
  
  return {
    url,
    domain,
    path,
    title: document.title,
    description: getMeta('description') || getMeta('og:description'),
    contentType,
    language: document.documentElement.lang || getMeta('language'),
    publishedAt: getMeta('article:published_time') || getMeta('datePublished'),
    author: getMeta('author') || getMeta('article:author'),
    ogImage: getMeta('og:image'),
    wordCountEstimate,
    hasVideo: hasVideoContent(),
    hasCode: hasCodeContent(),
  };
}

/**
 * Detect content type from page structure
 */
function detectFromPage(): ContentType {
  // Check for video embeds
  if (hasVideoContent()) {
    return 'video';
  }
  
  // Check for code blocks
  const codeBlocks = document.querySelectorAll('pre code, .highlight, .CodeMirror');
  if (codeBlocks.length >= 3) {
    return 'code';
  }
  
  // Check for article structure
  const hasArticle = !!document.querySelector('article, [itemtype*="Article"]');
  const hasBlogPost = !!document.querySelector('.post, .blog-post, .entry, .article-content');
  
  if (hasArticle || hasBlogPost) {
    return 'article';
  }
  
  // Check for documentation patterns
  const hasSidebar = !!document.querySelector('.sidebar, .toc, nav[aria-label*="doc"]');
  const hasApiRef = !!document.querySelector('.api-reference, .method-list, .endpoint');
  
  if (hasSidebar && hasApiRef) {
    return 'documentation';
  }
  
  return 'article'; // Default
}

/**
 * Check for video content
 */
function hasVideoContent(): boolean {
  return !!(
    document.querySelector('video, iframe[src*="youtube"], iframe[src*="vimeo"]') ||
    document.querySelector('[class*="video-player"], [class*="player-wrapper"]')
  );
}

/**
 * Check for code content
 */
function hasCodeContent(): boolean {
  const codeElements = document.querySelectorAll('pre, code, .highlight');
  return codeElements.length > 0;
}

/**
 * Fast word count estimation
 */
function estimateWordCount(): number {
  // Get main content area
  const main = document.querySelector('main, article, [role="main"], .content, #content');
  const text = (main?.textContent || '').trim();
  
  if (!text) {
    // Fallback to body, but penalize (likely has nav/footer noise)
    const bodyText = document.body.textContent || '';
    return Math.floor(bodyText.split(/\s+/).length * 0.5);
  }
  
  return text.split(/\s+/).filter(w => w.length > 0).length;
}
