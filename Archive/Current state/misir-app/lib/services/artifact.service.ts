/**
 * Artifact Service
 * 
 * Business logic for artifact management.
 * Uses its own simplified types that map to DB rows.
 */

import { ArtifactRepository, type ArtifactRow, type CreateArtifactInput } from '@/lib/repositories';

/**
 * Simplified artifact type for service layer.
 */
export interface ServiceArtifact {
    id: string;
    userId: string;
    spaceId: string;
    url: string;
    title?: string;
    textContent?: string;
    wordCount?: number;
    artifactType: 'ambient' | 'engaged' | 'committed';
    baseWeight: number;
    decayMultiplier: number;
    relevance?: number;
    embedding?: number[];
    createdAt: string;
    updatedAt: string;
}

function rowToServiceArtifact(row: ArtifactRow): ServiceArtifact {
    return {
        id: row.id,
        userId: row.user_id,
        spaceId: row.space_id,
        url: row.url,
        title: row.title || undefined,
        textContent: row.text_content || undefined,
        wordCount: row.word_count || undefined,
        artifactType: row.artifact_type,
        baseWeight: row.base_weight,
        decayMultiplier: row.decay_multiplier,
        relevance: row.relevance || undefined,
        embedding: row.embedding || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export const ArtifactService = {
    /**
     * Get all artifacts for a space.
     */
    async getBySpaceId(spaceId: string, limit?: number): Promise<ServiceArtifact[]> {
        const rows = await ArtifactRepository.findBySpaceId(spaceId, limit);
        return rows.map(rowToServiceArtifact);
    },

    /**
     * Get all artifacts for a user.
     */
    async getByUserId(userId: string, limit?: number): Promise<ServiceArtifact[]> {
        const rows = await ArtifactRepository.findByUserId(userId, limit);
        return rows.map(rowToServiceArtifact);
    },

    /**
     * Get a single artifact by ID.
     */
    async getById(id: string): Promise<ServiceArtifact | null> {
        const row = await ArtifactRepository.findById(id);
        return row ? rowToServiceArtifact(row) : null;
    },

    /**
     * Create a new artifact.
     */
    async create(input: {
        userId: string;
        spaceId: string;
        url: string;
        title?: string;
        textContent?: string;
        wordCount?: number;
        artifactType: 'ambient' | 'engaged' | 'committed';
        baseWeight: number;
        decayMultiplier?: number;
        relevance?: number;
        embedding?: number[];
    }): Promise<ServiceArtifact> {
        const dbInput: CreateArtifactInput = {
            user_id: input.userId,
            space_id: input.spaceId,
            url: input.url,
            title: input.title,
            text_content: input.textContent,
            word_count: input.wordCount,
            artifact_type: input.artifactType,
            base_weight: input.baseWeight,
            decay_multiplier: input.decayMultiplier,
            relevance: input.relevance,
            embedding: input.embedding,
        };

        const row = await ArtifactRepository.create(dbInput);
        return rowToServiceArtifact(row);
    },

    /**
     * Update an artifact.
     */
    async update(id: string, updates: Partial<{
        title: string;
        relevance: number;
        spaceId: string;
    }>): Promise<ServiceArtifact> {
        const dbUpdates: Partial<ArtifactRow> = {};
        if (updates.title !== undefined) dbUpdates.title = updates.title;
        if (updates.relevance !== undefined) dbUpdates.relevance = updates.relevance;
        if (updates.spaceId !== undefined) dbUpdates.space_id = updates.spaceId;

        const row = await ArtifactRepository.update(id, dbUpdates);
        return rowToServiceArtifact(row);
    },

    /**
     * Delete an artifact.
     */
    async delete(id: string): Promise<void> {
        await ArtifactRepository.delete(id);
    },

    /**
     * Count artifacts for a space.
     */
    async countBySpaceId(spaceId: string): Promise<number> {
        return ArtifactRepository.countBySpaceId(spaceId);
    },

    /**
     * Get artifacts in a date range.
     */
    async getByDateRange(
        userId: string,
        startDate: Date,
        endDate: Date
    ): Promise<ServiceArtifact[]> {
        const rows = await ArtifactRepository.findByDateRange(userId, startDate, endDate);
        return rows.map(rowToServiceArtifact);
    },
};
