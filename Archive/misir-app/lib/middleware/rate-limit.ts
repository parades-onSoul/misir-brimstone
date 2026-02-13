/**
 * Rate Limiting Middleware
 * 
 * Simple in-memory rate limiter for API routes.
 * For production, consider using @upstash/ratelimit with Redis.
 */

import { NextRequest, NextResponse } from 'next/server';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (cleared on server restart)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Configuration
const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 1000, // 1 minute window
  maxRequests: 60,      // 60 requests per window
  message: 'Too many requests, please try again later.',
} as const;

/**
 * Get client identifier from request
 */
function getClientId(request: NextRequest): string {
  // Try to get real IP from headers (for proxied requests)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIp || 'unknown';
  
  // Combine with user agent for more granular limiting
  const userAgent = request.headers.get('user-agent') || 'unknown';
  return `${ip}:${userAgent.substring(0, 50)}`;
}

/**
 * Clean up expired entries periodically
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredEntries, 5 * 60 * 1000);
}

/**
 * Check rate limit for a request
 * @returns null if within limit, NextResponse if rate limited
 */
export function checkRateLimit(request: NextRequest): NextResponse | null {
  const clientId = getClientId(request);
  const now = Date.now();
  
  const entry = rateLimitStore.get(clientId);
  
  if (!entry || entry.resetAt < now) {
    // First request or window expired
    rateLimitStore.set(clientId, {
      count: 1,
      resetAt: now + RATE_LIMIT_CONFIG.windowMs,
    });
    return null;
  }
  
  if (entry.count >= RATE_LIMIT_CONFIG.maxRequests) {
    // Rate limited
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: RATE_LIMIT_CONFIG.message },
      { 
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(RATE_LIMIT_CONFIG.maxRequests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
        },
      }
    );
  }
  
  // Increment counter
  entry.count++;
  return null;
}

/**
 * Rate limit wrapper for API handlers
 */
export function withRateLimit<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>
): (...args: T) => Promise<NextResponse> {
  return async (...args: T) => {
    const request = args[0] as NextRequest;
    
    const rateLimitResponse = checkRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    
    return handler(...args);
  };
}

/**
 * Custom rate limit configuration
 */
export function createRateLimiter(options: {
  windowMs?: number;
  maxRequests?: number;
  message?: string;
}) {
  const config = {
    windowMs: options.windowMs ?? RATE_LIMIT_CONFIG.windowMs,
    maxRequests: options.maxRequests ?? RATE_LIMIT_CONFIG.maxRequests,
    message: options.message ?? RATE_LIMIT_CONFIG.message,
  };
  
  const store = new Map<string, RateLimitEntry>();
  
  return function checkLimit(request: NextRequest): NextResponse | null {
    const clientId = getClientId(request);
    const now = Date.now();
    
    const entry = store.get(clientId);
    
    if (!entry || entry.resetAt < now) {
      store.set(clientId, { count: 1, resetAt: now + config.windowMs });
      return null;
    }
    
    if (entry.count >= config.maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      return NextResponse.json(
        { error: config.message },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }
    
    entry.count++;
    return null;
  };
}
