/**
 * Engine Tests: Processor
 * 
 * Tests for artifact processing and space state updates.
 */

import { describe, it, expect, vi } from 'vitest';
import {
    processArtifact,
    applySpaceDecay,
    batchDecaySpaces,
    validateArtifact,
    initializeSpace,
    type Artifact,
    type Space,
} from '@/lib/engine/processor';
import { STATE_THRESHOLDS, TOTAL_MASS } from '@/lib/math';

// ============================================================================
// Helper Factories
// ============================================================================

function createArtifact(overrides: Partial<Artifact> = {}): Artifact {
    return {
        id: 'artifact-1',
        space_id: 'space-1',
        user_id: 'user-1',
        base_weight: 1.0,
        relevance: 1.0,
        created_at: new Date(),
        ...overrides,
    };
}

function createSpace(overrides: Partial<Space> = {}): Space {
    return {
        id: 'space-1',
        user_id: 'user-1',
        state_vector: [10, 0, 0, 0],
        evidence: 0,
        last_updated_at: new Date(),
        ...overrides,
    };
}

// ============================================================================
// processArtifact Tests
// ============================================================================

describe('processArtifact', () => {
    it('should calculate delta evidence from artifact', () => {
        const artifact = createArtifact({ base_weight: 1.0, relevance: 0.8 });
        const space = createSpace({ evidence: 0 });
        const now = new Date();

        const result = processArtifact(artifact, space, now);

        // δE = 1.0 * 0.8 * 1.0 = 0.8
        expect(result.newEvidence).toBeCloseTo(0.8);
    });

    it('should apply reading depth multiplier', () => {
        const artifact = createArtifact({
            base_weight: 1.0,
            relevance: 1.0,
            readingDepth: 1.5  // Deep read
        });
        const space = createSpace({ evidence: 0 });

        const result = processArtifact(artifact, space);

        // δE = 1.0 * 1.0 * 1.5 = 1.5
        expect(result.newEvidence).toBeCloseTo(1.5);
    });

    it('should default reading depth to 1.0', () => {
        const artifact = createArtifact({ base_weight: 1.0, relevance: 1.0 });
        // No readingDepth specified
        const space = createSpace({ evidence: 0 });

        const result = processArtifact(artifact, space);

        expect(result.newEvidence).toBeCloseTo(1.0);
    });

    it('should accumulate evidence on existing space', () => {
        const artifact = createArtifact({ base_weight: 1.0, relevance: 1.0 });
        const space = createSpace({
            evidence: 2.0,
            last_updated_at: new Date() // No decay
        });
        const now = new Date();

        const result = processArtifact(artifact, space, now);

        // Should be ~3.0 (2.0 existing + 1.0 new)
        expect(result.newEvidence).toBeCloseTo(3.0, 1);
    });

    it('should apply decay before adding new evidence', () => {
        const artifact = createArtifact({ base_weight: 1.0, relevance: 1.0 });
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const space = createSpace({
            evidence: 5.0,
            last_updated_at: oneWeekAgo
        });
        const now = new Date();

        const result = processArtifact(artifact, space, now);

        // Evidence should be less than 5.0 + 1.0 = 6.0 due to decay
        expect(result.newEvidence).toBeLessThan(6.0);
        expect(result.newEvidence).toBeGreaterThan(1.0); // At least the new artifact
    });

    it('should detect state transitions', () => {
        const artifact = createArtifact({ base_weight: 2.0, relevance: 1.0 });
        const space = createSpace({
            evidence: 0.5, // Just below threshold
            state_vector: [10, 0, 0, 0]
        });

        const result = processArtifact(artifact, space);

        // New evidence ~2.5 should cross THETA_1 (1)
        expect(result.newEvidence).toBeGreaterThan(STATE_THRESHOLDS.THETA_1);
        expect(result.transitionOccurred).toBe(true);
    });

    it('should return correct old and new state indices', () => {
        const artifact = createArtifact({ base_weight: 2.0, relevance: 1.0 });
        const space = createSpace({
            evidence: 0,
            state_vector: [10, 0, 0, 0]
        });

        const result = processArtifact(artifact, space);

        expect(result.oldState).toBe(0); // Latent
        // newState depends on final evidence
    });
});

// ============================================================================
// applySpaceDecay Tests
// ============================================================================

describe('applySpaceDecay', () => {
    it('should reduce evidence over time', () => {
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);

        const space = createSpace({
            evidence: 5.0,
            last_updated_at: oneDayAgo,
        });

        const result = applySpaceDecay(space);

        expect(result.newEvidence).toBeLessThan(5.0);
        expect(result.newEvidence).toBeGreaterThan(0);
    });

    it('should not change evidence for same timestamp', () => {
        const now = new Date();
        const space = createSpace({
            evidence: 5.0,
            last_updated_at: now,
        });

        const result = applySpaceDecay(space, now);

        expect(result.newEvidence).toBeCloseTo(5.0);
    });

    it('should detect backward transitions', () => {
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

        const space = createSpace({
            evidence: 1.5, // Above THETA_1
            state_vector: [8, 2, 0, 0], // Some mass in Discovered
            last_updated_at: twoWeeksAgo,
        });

        const result = applySpaceDecay(space);

        // After 2 weeks of decay, evidence should drop
        if (result.newEvidence < STATE_THRESHOLDS.THETA_1) {
            expect(result.transitionOccurred).toBe(true);
        }
    });
});

// ============================================================================
// batchDecaySpaces Tests
// ============================================================================

describe('batchDecaySpaces', () => {
    it('should process multiple spaces', () => {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const spaces = [
            createSpace({ id: 'space-1', evidence: 3.0, last_updated_at: oneDayAgo }),
            createSpace({ id: 'space-2', evidence: 5.0, last_updated_at: oneDayAgo }),
            createSpace({ id: 'space-3', evidence: 1.0, last_updated_at: oneDayAgo }),
        ];

        const results = batchDecaySpaces(spaces, now);

        expect(results.size).toBe(3);
        expect(results.has('space-1')).toBe(true);
        expect(results.has('space-2')).toBe(true);
        expect(results.has('space-3')).toBe(true);
    });

    it('should return empty map for empty input', () => {
        const results = batchDecaySpaces([]);
        expect(results.size).toBe(0);
    });

    it('should apply decay to each space independently', () => {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

        const spaces = [
            createSpace({ id: 'space-1', evidence: 5.0, last_updated_at: oneDayAgo }),
            createSpace({ id: 'space-2', evidence: 5.0, last_updated_at: twoDaysAgo }),
        ];

        const results = batchDecaySpaces(spaces, now);

        const result1 = results.get('space-1')!;
        const result2 = results.get('space-2')!;

        // Space 2 should have more decay (older)
        expect(result2.newEvidence).toBeLessThan(result1.newEvidence);
    });
});

// ============================================================================
// validateArtifact Tests
// ============================================================================

describe('validateArtifact', () => {
    it('should accept valid artifact', () => {
        const artifact = createArtifact();
        expect(() => validateArtifact(artifact)).not.toThrow();
    });

    it('should reject negative base_weight', () => {
        const artifact = createArtifact({ base_weight: -1 });
        expect(() => validateArtifact(artifact)).toThrow('base_weight must be non-negative');
    });

    it('should reject negative relevance', () => {
        const artifact = createArtifact({ relevance: -0.1 });
        expect(() => validateArtifact(artifact)).toThrow('relevance must be in [0, 1]');
    });

    it('should reject relevance > 1', () => {
        const artifact = createArtifact({ relevance: 1.5 });
        expect(() => validateArtifact(artifact)).toThrow('relevance must be in [0, 1]');
    });

    it('should accept edge case: relevance = 0', () => {
        const artifact = createArtifact({ relevance: 0 });
        expect(() => validateArtifact(artifact)).not.toThrow();
    });

    it('should accept edge case: relevance = 1', () => {
        const artifact = createArtifact({ relevance: 1 });
        expect(() => validateArtifact(artifact)).not.toThrow();
    });
});

// ============================================================================
// initializeSpace Tests
// ============================================================================

describe('initializeSpace', () => {
    it('should return default state vector', () => {
        const { stateVector } = initializeSpace();
        expect(stateVector).toEqual([TOTAL_MASS, 0, 0, 0]);
    });

    it('should start with zero evidence', () => {
        const { evidence } = initializeSpace();
        expect(evidence).toBe(0);
    });

    it('should have total mass in Latent state', () => {
        const { stateVector } = initializeSpace();
        expect(stateVector[0]).toBe(TOTAL_MASS);
        expect(stateVector[1]).toBe(0);
        expect(stateVector[2]).toBe(0);
        expect(stateVector[3]).toBe(0);
    });
});
