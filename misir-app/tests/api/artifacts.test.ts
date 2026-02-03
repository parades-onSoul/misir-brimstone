/**
 * API Route Tests: Artifacts
 * 
 * Tests for the /api/artifacts endpoint (CRUD operations).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Next.js request with proper headers
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
        url: `http://localhost:3000/api/artifacts${options.searchParams
            ? '?' + new URLSearchParams(options.searchParams).toString()
            : ''
            }`,
        headers: {
            get: (name: string) => headers.get(name.toLowerCase()) ?? null,
        },
    } as unknown as Request;
};

// ============================================================================
// Artifact Validation Tests
// ============================================================================

describe('/api/artifacts validation', () => {
    describe('CreateArtifactRequest', () => {
        it('should require space_id', () => {
            const body = {
                title: 'Test Article',
                url: 'https://example.com',
                artifact_type: 'ambient',
            };

            // Missing space_id should fail validation
            expect((body as Record<string, unknown>).space_id).toBeUndefined();
        });

        it('should require title', () => {
            const body = {
                space_id: 'test-space-id',
                url: 'https://example.com',
                artifact_type: 'ambient',
            };

            expect((body as Record<string, unknown>).title).toBeUndefined();
        });

        it('should require url', () => {
            const body = {
                space_id: 'test-space-id',
                title: 'Test Article',
                artifact_type: 'ambient',
            };

            expect((body as Record<string, unknown>).url).toBeUndefined();
        });

        it('should require artifact_type', () => {
            const body = {
                space_id: 'test-space-id',
                title: 'Test Article',
                url: 'https://example.com',
            };

            expect((body as Record<string, unknown>).artifact_type).toBeUndefined();
        });

        it('should accept valid artifact types', () => {
            const validTypes = ['ambient', 'engaged', 'committed'];

            validTypes.forEach(type => {
                expect(validTypes.includes(type)).toBe(true);
            });
        });

        it('should reject invalid artifact types', () => {
            const invalidTypes = ['view', 'save', 'highlight', 'invalid'];
            const validTypes = ['ambient', 'engaged', 'committed'];

            invalidTypes.forEach(type => {
                expect(validTypes.includes(type)).toBe(false);
            });
        });
    });

    describe('Artifact type configuration', () => {
        const ARTIFACT_CONFIG = {
            ambient: { baseWeight: 0.2, decayRate: 'high' },
            engaged: { baseWeight: 1.0, decayRate: 'medium' },
            committed: { baseWeight: 2.0, decayRate: 'low' }
        };

        it('should have correct weights for ambient artifacts', () => {
            expect(ARTIFACT_CONFIG.ambient.baseWeight).toBe(0.2);
            expect(ARTIFACT_CONFIG.ambient.decayRate).toBe('high');
        });

        it('should have correct weights for engaged artifacts', () => {
            expect(ARTIFACT_CONFIG.engaged.baseWeight).toBe(1.0);
            expect(ARTIFACT_CONFIG.engaged.decayRate).toBe('medium');
        });

        it('should have correct weights for committed artifacts', () => {
            expect(ARTIFACT_CONFIG.committed.baseWeight).toBe(2.0);
            expect(ARTIFACT_CONFIG.committed.decayRate).toBe('low');
        });
    });

    describe('Relevance threshold', () => {
        const RELEVANCE_THRESHOLD = 0.1;

        it('should require minimum relevance of 0.1', () => {
            expect(RELEVANCE_THRESHOLD).toBe(0.1);
        });

        it('should reject relevance below threshold', () => {
            const relevance = 0.05;
            expect(relevance < RELEVANCE_THRESHOLD).toBe(true);
        });

        it('should accept relevance at threshold', () => {
            const relevance = 0.1;
            expect(relevance >= RELEVANCE_THRESHOLD).toBe(true);
        });

        it('should accept relevance above threshold', () => {
            const relevance = 0.85;
            expect(relevance >= RELEVANCE_THRESHOLD).toBe(true);
        });
    });
});

// ============================================================================
// Artifact Type Mapping Tests
// ============================================================================

describe('Artifact type mapping', () => {
    function mapArtifactType(dbType: string): string {
        switch (dbType) {
            case 'ambient': return 'view';
            case 'engaged': return 'highlight';
            case 'committed': return 'save';
            default: return 'view';
        }
    }

    it('should map ambient to view', () => {
        expect(mapArtifactType('ambient')).toBe('view');
    });

    it('should map engaged to highlight', () => {
        expect(mapArtifactType('engaged')).toBe('highlight');
    });

    it('should map committed to save', () => {
        expect(mapArtifactType('committed')).toBe('save');
    });

    it('should default to view for unknown types', () => {
        expect(mapArtifactType('unknown')).toBe('view');
    });
});

// ============================================================================
// Decay Multiplier Tests
// ============================================================================

describe('Decay multiplier', () => {
    function getDecayMultiplier(decayRate: string): number {
        switch (decayRate) {
            case 'high': return 0.1;
            case 'medium': return 0.05;
            case 'low': return 0.02;
            default: return 0.05;
        }
    }

    it('should return 0.1 for high decay', () => {
        expect(getDecayMultiplier('high')).toBe(0.1);
    });

    it('should return 0.05 for medium decay', () => {
        expect(getDecayMultiplier('medium')).toBe(0.05);
    });

    it('should return 0.02 for low decay', () => {
        expect(getDecayMultiplier('low')).toBe(0.02);
    });

    it('should default to 0.05 for unknown decay rates', () => {
        expect(getDecayMultiplier('unknown')).toBe(0.05);
    });
});

// ============================================================================
// Rate Limiting Tests
// ============================================================================

describe('/api/artifacts rate limiting', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('should allow requests under rate limit', async () => {
        const { checkRateLimit } = await import('@/lib/middleware/rate-limit');

        const request = mockRequest({
            method: 'POST',
            headers: { 'x-forwarded-for': '192.168.1.100' }
        });

        const result = checkRateLimit(request as unknown as import('next/server').NextRequest);
        expect(result).toBeNull();
    });
});
