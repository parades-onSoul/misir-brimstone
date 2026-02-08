/**
 * Content Type Detection — Pattern-based classification
 *
 * Detects what kind of content a page contains:
 *   article, video, chat, code, documentation, social, forum, unknown
 *
 * Also maps to backend content_source enum: web, ai, video, document, note
 */
import type { ContentType, ContentSource } from '@/types';

// ── Detection patterns ───────────────────────────────

interface ContentPattern {
  type: ContentType;
  source: ContentSource;
  domains: RegExp[];
  urlPatterns?: RegExp[];
  titlePatterns?: RegExp[];
  platform?: string;
}

const PATTERNS: ContentPattern[] = [
  // Video platforms
  {
    type: 'video',
    source: 'video',
    domains: [/youtube\.com/, /youtu\.be/, /vimeo\.com/, /twitch\.tv/, /dailymotion\.com/],
    urlPatterns: [/\/watch\?/, /\/video\//, /\/embed\//],
    platform: 'video',
  },
  // AI chat platforms
  {
    type: 'chat',
    source: 'ai',
    domains: [/chat\.openai\.com/, /chatgpt\.com/, /claude\.ai/, /bard\.google\.com/, /gemini\.google\.com/, /perplexity\.ai/, /poe\.com/],
    platform: 'ai-chat',
  },
  // Code platforms
  {
    type: 'code',
    source: 'web',
    domains: [/github\.com/, /gitlab\.com/, /bitbucket\.org/, /codepen\.io/, /replit\.com/, /stackblitz\.com/],
    urlPatterns: [/\/blob\//, /\/tree\//, /\/pull\//, /\/issues\//],
    platform: 'code',
  },
  // Documentation
  {
    type: 'documentation',
    source: 'document',
    domains: [/docs\./, /readthedocs\.io/, /gitbook\.io/, /notion\.so/, /confluence\./],
    urlPatterns: [/\/docs\//, /\/documentation\//, /\/api\//, /\/reference\//],
    titlePatterns: [/documentation/i, /api reference/i, /user guide/i],
    platform: 'docs',
  },
  // Forum / Q&A
  {
    type: 'forum',
    source: 'web',
    domains: [/stackoverflow\.com/, /stackexchange\.com/, /discourse\./, /reddit\.com\/r\/.+\/comments/],
    urlPatterns: [/\/questions\//, /\/answer\//],
    platform: 'forum',
  },
  // Social media
  {
    type: 'social',
    source: 'web',
    domains: [/twitter\.com/, /x\.com/, /linkedin\.com/, /facebook\.com/, /mastodon\./],
    platform: 'social',
  },
];

// ── Public API ───────────────────────────────────────

export interface ContentDetection {
  contentType: ContentType;
  contentSource: ContentSource;
  platform: string | null;
  confidence: number;
}

/**
 * Detect content type and source from URL, title, and page metadata.
 */
export function detectContent(
  url: string,
  title: string,
  hasVideoElement = false,
  hasCodeElement = false
): ContentDetection {
  const domain = getDomain(url);
  const lowerUrl = url.toLowerCase();
  const lowerTitle = title.toLowerCase();

  // Check patterns
  for (const pattern of PATTERNS) {
    const domainMatch = pattern.domains.some((re) => re.test(domain));
    const urlMatch = pattern.urlPatterns?.some((re) => re.test(lowerUrl)) ?? false;
    const titleMatch = pattern.titlePatterns?.some((re) => re.test(lowerTitle)) ?? false;

    if (domainMatch || urlMatch || titleMatch) {
      const confidence = domainMatch ? 0.9 : urlMatch ? 0.7 : 0.5;
      return {
        contentType: pattern.type,
        contentSource: pattern.source,
        platform: pattern.platform || null,
        confidence,
      };
    }
  }

  // DOM-based fallbacks
  if (hasVideoElement) {
    return { contentType: 'video', contentSource: 'video', platform: null, confidence: 0.6 };
  }
  if (hasCodeElement) {
    return { contentType: 'code', contentSource: 'web', platform: null, confidence: 0.5 };
  }

  // URL heuristic fallbacks
  if (/\/(blog|post|article|news|story)\//i.test(url)) {
    return { contentType: 'article', contentSource: 'web', platform: null, confidence: 0.5 };
  }

  // Default: article / web
  return { contentType: 'article', contentSource: 'web', platform: null, confidence: 0.3 };
}

// ── URL Blocklist ────────────────────────────────────

const BLOCKED_PATTERNS: RegExp[] = [
  /^chrome:\/\//,
  /^chrome-extension:\/\//,
  /^about:/,
  /^moz-extension:\/\//,
  /^edge:\/\//,
  /^file:\/\//,
  /localhost:\d+\/(api|health|metrics)/,
  /\/(login|signin|signup|register|auth|oauth|callback)\b/i,
  /\/(cart|checkout|payment|billing)\b/i,
  /\/(account|settings|profile|preferences)\b/i,
  /\/(unsubscribe|optout)\b/i,
];

/**
 * Check if a URL should be captured.
 */
export function isAllowedUrl(url: string): boolean {
  return !BLOCKED_PATTERNS.some((re) => re.test(url));
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}
