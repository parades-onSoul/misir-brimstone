/**
 * URL Blocklist - Pages that should NEVER be captured
 * 
 * These are tool dashboards, settings pages, and non-learning content
 * that would pollute the knowledge graph.
 */

export const URL_BLOCKLIST_PATTERNS = [
  // Our own app
  'localhost:3000',
  'misir.app',

  // Browser internal pages
  'chrome://',
  'chrome-extension://',
  'about:',
  'edge://',
  'brave://',
  'moz-extension://',

  // Developer tool dashboards (not learning content)
  'supabase.com',  // Block entire domain (all pages are tool dashboards)
  'vercel.com/dashboard',
  'github.com/settings',
  'github.com/notifications',
  'github.com/pulls',
  'github.com/issues',
  'console.cloud.google.com',
  'console.aws.amazon.com',
  'portal.azure.com',
  'app.netlify.com',
  'railway.app/dashboard',
  'render.com/dashboard',
  'planetscale.com/dashboard',
  'neon.tech/dashboard',
  'fly.io/dashboard',
  'heroku.com/dashboard',

  // Email & Communication (not learning)
  'mail.google.com',
  'outlook.live.com',
  'outlook.office.com',
  'slack.com',
  'discord.com/channels',
  'teams.microsoft.com',
  'web.whatsapp.com',
  'web.telegram.org',

  // Social media feeds (noise)
  'twitter.com/home',
  'x.com/home',
  'facebook.com',
  'instagram.com',
  'linkedin.com/feed',
  'linkedin.com/notifications',
  'reddit.com/r/popular',
  'reddit.com/r/all',
  'tiktok.com',

  // Search results pages
  'google.com/search',
  'bing.com/search',
  'duckduckgo.com/?q',

  // Shopping & Banking
  'amazon.com/gp',
  'amazon.com/cart',
  'ebay.com/myb',
  '/banking',
  '/account/billing',
  'paypal.com',
  'stripe.com/dashboard',

  // Auth & Settings pages
  '/login',
  '/signin',
  '/signup',
  '/register',
  '/auth/',
  '/oauth/',
  '/sso/',
  '/settings',
  '/account',
  '/preferences',
  '/billing',
  '/checkout',
  '/cart',

  // Video streaming (rarely educational)
  'netflix.com',
  'hulu.com',
  'disneyplus.com',
  'primevideo.com',
  'twitch.tv',

  // Document editors (not the content itself)
  'docs.google.com/document',
  'docs.google.com/spreadsheets',
  'figma.com/file',
  'notion.so',
];

/**
 * Check if a URL should be blocked from capture
 */
export function isBlockedUrl(url: string): boolean {
  const urlLower = url.toLowerCase();
  return URL_BLOCKLIST_PATTERNS.some(pattern => urlLower.includes(pattern.toLowerCase()));
}

/**
 * Check if URL is likely a login/auth page based on common patterns
 */
export function isAuthPage(url: string): boolean {
  const authPatterns = [
    '/login', '/signin', '/signup', '/register',
    '/auth/', '/oauth/', '/sso/', '/forgot-password',
    '/reset-password', '/verify', '/confirm'
  ];
  const urlLower = url.toLowerCase();
  return authPatterns.some(p => urlLower.includes(p));
}

/**
 * Check if URL is likely transactional (skip capture)
 * Used for fast-path bypass in pipeline
 */
export function isTransactionalUrl(url: string): boolean {
  const transactionalPatterns = [
    '/cart', '/checkout', '/payment', '/billing',
    '/order', '/receipt', '/invoice', '/purchase',
    '/subscribe', '/pricing', '/plans', '/upgrade',
    'pay.', 'checkout.', 'secure.',
  ];
  const urlLower = url.toLowerCase();
  return transactionalPatterns.some(p => urlLower.includes(p));
}

/**
 * Check if URL is likely a learning resource (prioritize capture)
 * Returns true for documentation, tutorials, blogs, etc.
 */
export function isLearningUrl(url: string): boolean {
  const learningPatterns = [
    // Documentation sites
    '/docs/', '/documentation/', '/guide/', '/tutorial/',
    '/handbook/', '/manual/', '/reference/', '/api/',
    // Blog and article patterns
    '/blog/', '/articles/', '/posts/', '/learn/',
    '/lessons/', '/course/', '/training/', '/wiki/',
    // Known learning platforms
    'medium.com/', 'dev.to/', 'hashnode.dev/',
    'freecodecamp.org/', 'css-tricks.com/',
    'smashingmagazine.com/', 'alistapart.com/',
    'hackernoon.com/', 'dzone.com/',
    // Technical docs
    'developer.mozilla.org/', 'docs.github.com/',
    'reactjs.org/', 'vuejs.org/', 'angular.io/',
    'nodejs.org/docs', 'python.org/doc',
    'rust-lang.org/learn', 'go.dev/doc',
    // Stack Exchange sites
    'stackoverflow.com/questions/',
    'stackexchange.com/',
    'superuser.com/questions/',
    'serverfault.com/questions/',
    // Wikipedia
    'wikipedia.org/wiki/',
  ];
  const urlLower = url.toLowerCase();
  return learningPatterns.some(p => urlLower.includes(p));
}

/**
 * Fast classification for pipeline optimization
 * Returns: 'block' | 'prioritize' | 'normal'
 */
export function classifyUrl(url: string): 'block' | 'prioritize' | 'normal' {
  if (isBlockedUrl(url)) return 'block';
  if (isAuthPage(url)) return 'block';
  if (isTransactionalUrl(url)) return 'block';
  if (isLearningUrl(url)) return 'prioritize';
  return 'normal';
}
