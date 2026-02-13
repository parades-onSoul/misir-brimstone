/**
 * Space Service
 * 
 * Business logic for space management.
 * Uses its own simplified types that map to DB rows.
 */

import { SpaceRepository, type SpaceRow, type CreateSpaceInput, type SubspaceData } from '@/lib/repositories';

/**
 * Simplified space type for service layer.
 */
export interface ServiceSpace {
    id: string;
    userId: string;
    name: string;
    description?: string;
    embedding?: number[];
    subspaces: SubspaceData[];
    createdAt: string;
    updatedAt: string;
}

function rowToServiceSpace(row: SpaceRow): ServiceSpace {
    return {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        description: row.description || undefined,
        embedding: row.embedding || undefined,
        subspaces: row.subspaces || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export const SpaceService = {
    /**
     * Get all spaces for a user.
     */
    async getByUserId(userId: string): Promise<ServiceSpace[]> {
        const rows = await SpaceRepository.findByUserId(userId);
        return rows.map(rowToServiceSpace);
    },

    /**
     * Get a single space by ID.
     */
    async getById(id: string): Promise<ServiceSpace | null> {
        const row = await SpaceRepository.findById(id);
        return row ? rowToServiceSpace(row) : null;
    },

    /**
     * Create a new space.
     */
    async create(input: {
        userId: string;
        name: string;
        description?: string;
        embedding?: number[];
        subspaces?: SubspaceData[];
    }): Promise<ServiceSpace> {
        const dbInput: CreateSpaceInput = {
            user_id: input.userId,
            name: input.name,
            description: input.description,
            embedding: input.embedding,
            subspaces: input.subspaces,
        };

        const row = await SpaceRepository.create(dbInput);
        return rowToServiceSpace(row);
    },

    /**
     * Update a space.
     */
    async update(id: string, updates: Partial<{
        name: string;
        description: string;
        subspaces: SubspaceData[];
    }>): Promise<ServiceSpace> {
        const row = await SpaceRepository.update(id, updates);
        return rowToServiceSpace(row);
    },

    /**
     * Delete a space.
     */
    async delete(id: string): Promise<void> {
        await SpaceRepository.delete(id);
    },

    /**
     * Update subspaces for a space.
     */
    async updateSubspaces(id: string, subspaces: SubspaceData[]): Promise<ServiceSpace> {
        const row = await SpaceRepository.updateSubspaces(id, subspaces);
        return rowToServiceSpace(row);
    },

    /**
     * Get total evidence across all subspaces.
     */
    getTotalEvidence(space: ServiceSpace): number {
        return (space.subspaces || []).reduce((sum, sub) => sum + (sub.evidence || 0), 0);
    },

    /**
     * Count spaces for a user.
     */
    async countByUserId(userId: string): Promise<number> {
        return SpaceRepository.countByUserId(userId);
    },
};

// Re-export SubspaceData for convenience
export type { SubspaceData };
