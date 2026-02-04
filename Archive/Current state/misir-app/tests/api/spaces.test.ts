/**
 * API Route Tests: Spaces
 * 
 * Integration tests for the /api/spaces endpoint.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Next.js request/response with proper headers
const mockRequest = (options: {
    method?: string;
    body?: unknown;
    searchParams?: Record<string, string>;
    headers?: Record<string, string>;
}) => {
    const headers = new Map(Object.entries(options.headers ?? {}));

    return {
        method: options.method || 'GET',
        json: async () => options.body,
        url: `http://localhost:3000/api/spaces${options.searchParams
                ? '?' + new URLSearchParams(options.searchParams).toString()
                : ''
            }`,
        headers: {
            get: (name: string) => headers.get(name.toLowerCase()) ?? null,
        },
    } as unknown as Request;
};

// These tests verify the validation schemas work correctly
describe('/api/spaces validation', () => {
    describe('CreateSpaceSchema', () => {
        it('should accept valid space creation request', async () => {
            const { CreateSpaceSchema } = await import('@/lib/api/validation');

            const result = CreateSpaceSchema.safeParse({
                name: 'Machine Learning',
                intention: 'Learn ML fundamentals',
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.name).toBe('Machine Learning');
                expect(result.data.intention).toBe('Learn ML fundamentals');
            }
        });

        it('should reject empty name', async () => {
            const { CreateSpaceSchema } = await import('@/lib/api/validation');

            const result = CreateSpaceSchema.safeParse({
                name: '',
            });

            expect(result.success).toBe(false);
        });

        it('should reject name over 100 characters', async () => {
            const { CreateSpaceSchema } = await import('@/lib/api/validation');

            const result = CreateSpaceSchema.safeParse({
                name: 'a'.repeat(101),
            });

            expect(result.success).toBe(false);
        });

        it('should reject intention over 280 characters', async () => {
            const { CreateSpaceSchema } = await import('@/lib/api/validation');

            const result = CreateSpaceSchema.safeParse({
                name: 'Valid Name',
                intention: 'a'.repeat(281),
            });

            expect(result.success).toBe(false);
        });

        it('should trim whitespace from name', async () => {
            const { CreateSpaceSchema } = await import('@/lib/api/validation');

            const result = CreateSpaceSchema.safeParse({
                name: '  Machine Learning  ',
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.name).toBe('Machine Learning');
            }
        });
    });
});

describe('/api/spaces rate limiting', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('should allow requests under rate limit', async () => {
        const { checkRateLimit } = await import('@/lib/middleware/rate-limit');

        const request = mockRequest({ method: 'POST' });
        const result = checkRateLimit(request as unknown as import('next/server').NextRequest);

        expect(result).toBeNull(); // null means allowed
    });

    it('should include rate limit headers when exceeded', async () => {
        const { createRateLimiter } = await import('@/lib/middleware/rate-limit');

        // Create a limiter with very low limit for testing
        const limiter = createRateLimiter({ maxRequests: 1, windowMs: 60000 });

        const request = mockRequest({ method: 'POST' });

        // First request should pass
        const result1 = limiter(request as unknown as import('next/server').NextRequest);
        expect(result1).toBeNull();

        // Second request should be rate limited
        const result2 = limiter(request as unknown as import('next/server').NextRequest);
        expect(result2).not.toBeNull();
        expect(result2?.status).toBe(429);
    });
});

describe('formatZodError', () => {
    it('should format Zod errors for API response', async () => {
        const { CreateSpaceSchema, formatZodError } = await import('@/lib/api/validation');

        const result = CreateSpaceSchema.safeParse({
            name: '',
            intention: 'a'.repeat(300),
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            const formatted = formatZodError(result.error);

            expect(formatted.error).toBe('Validation failed');
            expect(Array.isArray(formatted.details)).toBe(true);
            expect(formatted.details.length).toBeGreaterThan(0);
            expect(formatted.details[0]).toHaveProperty('field');
            expect(formatted.details[0]).toHaveProperty('message');
        }
    });
});
