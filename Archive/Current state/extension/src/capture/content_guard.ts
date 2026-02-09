/**
 * Content Guard
 * 
 * Determines which URLs should be captured or blocked.
 */

// ============================================================================
// BLOCKLIST
// ============================================================================

const BLOCKED_PATTERNS = [
  // Browser internals
  'chrome://',
  'chrome-extension://',
  'about:',
  'edge://',
  'brave://',
  'moz-extension://',
  
  // Auth & account pages
  '/login',
  '/signin',
  '/signup',
  '/register',
  '/auth/',
  '/oauth/',
  '/sso/',
  '/forgot-password',
  '/reset-password',
  
  // Settings & admin
  '/settings',
  '/account',
  '/preferences',
  '/admin',
  '/dashboard',
  
  // Commerce
  '/cart',
  '/checkout',
  '/billing',
  '/payment',
  
  // Email & messaging
  'mail.google.com',
  'outlook.live.com',
  'outlook.office.com',
  'slack.com',
  'discord.com/channels',
  'teams.microsoft.com',
  'web.whatsapp.com',
  
  // Social media feeds (noisy)
  'twitter.com/home',
  'x.com/home',
  'facebook.com',
  'instagram.com',
  'linkedin.com/feed',
  'tiktok.com',
  
  // Search results
  'google.com/search',
  'bing.com/search',
  'duckduckgo.com/?q',
  
  // Streaming (not educational)
  'netflix.com',
  'hulu.com',
  'disneyplus.com',
  'primevideo.com',
  
  // Our own app
  'localhost:3000',
  'misir.app',
];

// ============================================================================
// ALLOWLIST (override blocklist)
// ============================================================================

const ALLOWED_PATTERNS = [
  // Learning platforms
  'coursera.org',
  'udemy.com',
  'edx.org',
  'khanacademy.org',
  
  // Documentation
  'docs.',
  'documentation.',
  '/docs/',
  
  // Developer content
  'github.com',
  'stackoverflow.com',
  'dev.to',
  'medium.com',
  'hashnode.com',
];

// ============================================================================
// GUARDS
// ============================================================================

/**
 * Check if URL should be captured
 */
export function isAllowed(url: string): boolean {
  const lower = url.toLowerCase();
  
  // First check allowlist (overrides blocklist)
  for (const pattern of ALLOWED_PATTERNS) {
    if (lower.includes(pattern)) {
      return true;
    }
  }
  
  // Then check blocklist
  for (const pattern of BLOCKED_PATTERNS) {
    if (lower.includes(pattern.toLowerCase())) {
      return false;
    }
  }
  
  // Default: allow
  return true;
}

/**
 * Check if URL is a special browser page
 */
export function isBrowserPage(url: string): boolean {
  return url.startsWith('chrome://') || 
         url.startsWith('about:') || 
         url.startsWith('edge://') ||
         url.startsWith('chrome-extension://');
}

/**
 * Check if URL is likely login/auth
 */
export function isAuthPage(url: string): boolean {
  const authPatterns = ['/login', '/signin', '/signup', '/auth/', '/oauth/'];
  const lower = url.toLowerCase();
  return authPatterns.some(p => lower.includes(p));
}

/**
 * Get reason why URL was blocked (for UI)
 */
export function getBlockReason(url: string): string | null {
  const lower = url.toLowerCase();
  
  if (isBrowserPage(url)) return 'Browser page';
  if (isAuthPage(url)) return 'Auth page';
  if (lower.includes('mail.google.com')) return 'Email';
  if (lower.includes('slack.com') || lower.includes('discord.com')) return 'Messaging';
  if (lower.includes('/cart') || lower.includes('/checkout')) return 'Shopping';
  if (lower.includes('facebook.com') || lower.includes('twitter.com')) return 'Social media';
  
  if (!isAllowed(url)) return 'Blocked';
  
  return null;
}
