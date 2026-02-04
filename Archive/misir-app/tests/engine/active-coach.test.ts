
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateInsights, frameInsight } from '@/lib/engine/insights';
import { detectConsumptionTrap } from '@/lib/engine/deltas';

// Mock Supabase
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockEq = vi.fn();
const mockIs = vi.fn();
const mockGte = vi.fn();
const mockFrom = vi.fn();

const mockSupabase = {
    from: mockFrom,
};

describe('Insight Engine (Active Coach)', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Setup chain
        mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert });
        mockSelect.mockReturnValue({ eq: mockEq, is: mockIs });
        mockEq.mockReturnValue({ eq: mockEq, gte: mockGte, is: mockIs });
        mockIs.mockReturnValue({ data: [] }); // Default return
        mockGte.mockReturnValue({ data: [] });
    });

    describe('detectConsumptionTrap', () => {
        it('should detect high input (>10k words) with zero output', async () => {
            // Mock artifacts response
            const mockArtifacts = [
                { subspace_id: 'sub1', word_count: 5000, artifact_type: 'ambient', subspaces: { name: 'Gardening' }, spaces: { name: 'Hobbies' }, space_id: 'space1' },
                { subspace_id: 'sub1', word_count: 6000, artifact_type: 'engaged', subspaces: { name: 'Gardening' }, spaces: { name: 'Hobbies' }, space_id: 'space1' }
            ];

            // Setup specific mock for artifacts query
            mockSelect.mockReturnValueOnce({ eq: mockEq });
            mockEq.mockReturnValueOnce({ gte: mockGte });
            mockGte.mockReturnValueOnce({ data: mockArtifacts });

            const traps = await detectConsumptionTrap(mockSupabase as any, 'user1');

            expect(traps).toHaveLength(1);
            expect(traps[0].type).toBe('consumption_trap');
            expect(traps[0].metadata?.wordCount).toBe(11000); // 5000 + 6000
        });

        it('should NOT ignore consumption if committed artifacts exist', async () => {
            const mockArtifacts = [
                { subspace_id: 'sub1', word_count: 15000, artifact_type: 'ambient', subspaces: { name: 'Gardening' }, spaces: { name: 'Hobbies' }, space_id: 'space1' },
                { subspace_id: 'sub1', word_count: 100, artifact_type: 'committed', subspaces: { name: 'Gardening' }, spaces: { name: 'Hobbies' }, space_id: 'space1' }
            ];

            mockSelect.mockReturnValueOnce({ eq: mockEq });
            mockEq.mockReturnValueOnce({ gte: mockGte });
            mockGte.mockReturnValueOnce({ data: mockArtifacts });

            const traps = await detectConsumptionTrap(mockSupabase as any, 'user1');
            expect(traps).toHaveLength(0);
        });
    });
});
