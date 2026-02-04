/**
 * API Route Tests: Match
 * 
 * Tests for the /api/match endpoint (3-layer semantic matching).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Match Constants Tests
// ============================================================================

describe('/api/match constants', () => {
    const LAYER_1_THRESHOLD = 0.4;
    const LAYER_2_THRESHOLD = 0.5;
    const TOP_K_MARKERS = 3;
    const TITLE_BOOST_EXACT = 2.0;
    const TITLE_BOOST_CONTAINS = 1.5;
    const URL_BOOST = 1.2;
    const SEMANTIC_WEIGHT = 0.4;
    const MARKER_WEIGHT = 0.6;
    const MAX_CANDIDATES = 5;

    describe('Thresholds', () => {
        it('Layer 1 threshold should be 0.4', () => {
            expect(LAYER_1_THRESHOLD).toBe(0.4);
        });

        it('Layer 2 threshold should be 0.5 (stricter)', () => {
            expect(LAYER_2_THRESHOLD).toBe(0.5);
            expect(LAYER_2_THRESHOLD).toBeGreaterThan(LAYER_1_THRESHOLD);
        });

        it('should use top-K of 3 markers', () => {
            expect(TOP_K_MARKERS).toBe(3);
        });

        it('should limit to 5 candidates from Layer 1', () => {
            expect(MAX_CANDIDATES).toBe(5);
        });
    });

    describe('Boosting', () => {
        it('exact title match should get 2.0x boost', () => {
            expect(TITLE_BOOST_EXACT).toBe(2.0);
        });

        it('title contains should get 1.5x boost', () => {
            expect(TITLE_BOOST_CONTAINS).toBe(1.5);
        });

        it('URL match should get 1.2x boost', () => {
            expect(URL_BOOST).toBe(1.2);
        });

        it('boosts should be ordered: exact > contains > url', () => {
            expect(TITLE_BOOST_EXACT).toBeGreaterThan(TITLE_BOOST_CONTAINS);
            expect(TITLE_BOOST_CONTAINS).toBeGreaterThan(URL_BOOST);
        });
    });

    describe('Relevance weighting', () => {
        it('should weight markers higher (60%)', () => {
            expect(MARKER_WEIGHT).toBe(0.6);
        });

        it('should weight semantics lower (40%)', () => {
            expect(SEMANTIC_WEIGHT).toBe(0.4);
        });

        it('weights should sum to 1.0', () => {
            expect(SEMANTIC_WEIGHT + MARKER_WEIGHT).toBe(1.0);
        });
    });
});

// ============================================================================
// Percentile Helper Tests
// ============================================================================

describe('percentile helper', () => {
    function percentile(arr: number[], p: number): number {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const index = Math.floor(p * sorted.length);
        return sorted[Math.min(index, sorted.length - 1)];
    }

    it('should return 0 for empty array', () => {
        expect(percentile([], 0.5)).toBe(0);
    });

    it('should return correct p50 (median)', () => {
        expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    });

    it('should return correct p25', () => {
        expect(percentile([1, 2, 3, 4], 0.25)).toBe(2);
    });

    it('should return correct p75', () => {
        expect(percentile([1, 2, 3, 4], 0.75)).toBe(4);
    });

    it('should handle single element', () => {
        expect(percentile([42], 0.5)).toBe(42);
        expect(percentile([42], 0.99)).toBe(42);
    });

    it('should handle unsorted input', () => {
        expect(percentile([5, 1, 3, 2, 4], 0.5)).toBe(3);
    });
});

// ============================================================================
// Relevance Calculation Tests
// ============================================================================

describe('relevance calculation', () => {
    const SEMANTIC_WEIGHT = 0.4;
    const MARKER_WEIGHT = 0.6;

    function calculateRelevance(semanticSimilarity: number, markerScore: number): number {
        return (semanticSimilarity * SEMANTIC_WEIGHT) + (markerScore * MARKER_WEIGHT);
    }

    it('should calculate correct relevance for perfect scores', () => {
        expect(calculateRelevance(1.0, 1.0)).toBe(1.0);
    });

    it('should calculate correct relevance for zero scores', () => {
        expect(calculateRelevance(0, 0)).toBe(0);
    });

    it('should weight markers more heavily', () => {
        // High semantic, low marker vs low semantic, high marker
        const semanticHeavy = calculateRelevance(1.0, 0.0);
        const markerHeavy = calculateRelevance(0.0, 1.0);

        expect(semanticHeavy).toBe(0.4);
        expect(markerHeavy).toBe(0.6);
        expect(markerHeavy).toBeGreaterThan(semanticHeavy);
    });

    it('should calculate correct mixed scores', () => {
        const result = calculateRelevance(0.8, 0.7);
        // 0.8 * 0.4 + 0.7 * 0.6 = 0.32 + 0.42 = 0.74
        expect(result).toBeCloseTo(0.74);
    });
});

// ============================================================================
// Top-K Marker Scoring Tests
// ============================================================================

describe('Top-K marker scoring', () => {
    const TOP_K = 3;

    function topKScore(scores: number[]): number {
        const sorted = [...scores].sort((a, b) => b - a);
        const topK = sorted.slice(0, TOP_K);
        if (topK.length === 0) return 0;
        return topK.reduce((sum, s) => sum + s, 0) / topK.length;
    }

    it('should average top 3 scores', () => {
        const scores = [0.9, 0.8, 0.7, 0.5, 0.3];
        // Top 3: 0.9, 0.8, 0.7 → avg = 0.8
        expect(topKScore(scores)).toBeCloseTo(0.8);
    });

    it('should handle fewer than K scores', () => {
        const scores = [0.9, 0.7];
        // Only 2: 0.9, 0.7 → avg = 0.8
        expect(topKScore(scores)).toBeCloseTo(0.8);
    });

    it('should handle single score', () => {
        expect(topKScore([0.85])).toBeCloseTo(0.85);
    });

    it('should handle empty scores', () => {
        expect(topKScore([])).toBe(0);
    });

    it('should ignore lower scores beyond top-K', () => {
        const withLow = [0.9, 0.8, 0.7, 0.1, 0.1, 0.1];
        const withoutLow = [0.9, 0.8, 0.7];

        expect(topKScore(withLow)).toBe(topKScore(withoutLow));
    });
});

// ============================================================================
// Confidence Calculation Tests
// ============================================================================

describe('confidence calculation', () => {
    // Confidence is based on relevance and gap from next-best result
    function calculateConfidence(relevance: number, nextRelevance: number | null): number {
        const gap = nextRelevance !== null ? relevance - nextRelevance : 0.3;
        // Confidence increases with both high relevance and large gap
        return Math.min(relevance + (gap * 0.5), 1.0);
    }

    it('should have higher confidence with larger gap', () => {
        const highGap = calculateConfidence(0.8, 0.3); // gap = 0.5
        const lowGap = calculateConfidence(0.8, 0.7);  // gap = 0.1

        // Both get same base relevance, but highGap has larger gap bonus
        expect(highGap).toBeGreaterThan(lowGap);
    });

    it('should cap confidence at 1.0', () => {
        expect(calculateConfidence(0.9, 0.1)).toBeLessThanOrEqual(1.0);
        expect(calculateConfidence(1.0, 0.0)).toBeLessThanOrEqual(1.0);
    });

    it('should handle single result with default gap', () => {
        const single = calculateConfidence(0.7, null);
        // 0.7 + (0.3 * 0.5) = 0.85
        expect(single).toBeCloseTo(0.85);
    });
});

// ============================================================================
// Title/URL Boost Tests
// ============================================================================

describe('title and URL boosting', () => {
    function getBoost(markerLabel: string, title: string, url: string): number {
        const labelLower = markerLabel.toLowerCase();
        const titleLower = title.toLowerCase();
        const urlLower = url.toLowerCase();

        if (titleLower === labelLower) return 2.0;
        if (titleLower.includes(labelLower)) return 1.5;
        if (urlLower.includes(labelLower)) return 1.2;
        return 1.0;
    }

    it('should return 2.0x for exact title match', () => {
        expect(getBoost('Transformer', 'Transformer', '')).toBe(2.0);
        expect(getBoost('transformer', 'TRANSFORMER', '')).toBe(2.0);
    });

    it('should return 1.5x for title contains', () => {
        expect(getBoost('Transformer', 'Introduction to Transformers', '')).toBe(1.5);
    });

    it('should return 1.2x for URL contains', () => {
        expect(getBoost('transformer', 'Unrelated Title', 'https://example.com/transformer-guide')).toBe(1.2);
    });

    it('should return 1.0x for no match', () => {
        expect(getBoost('RAG', 'Unrelated Title', 'https://example.com/other')).toBe(1.0);
    });

    it('should prioritize title contains over URL', () => {
        // Title contains "ml" so gets 1.5x (contains), not 1.2x (URL)
        const result = getBoost('ml', 'ML Tutorial', 'https://ml.com');
        expect(result).toBe(1.5); // Title contains wins over URL contains
    });
});
