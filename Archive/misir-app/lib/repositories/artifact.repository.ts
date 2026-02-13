/**
 * Artifact Repository
 * 
 * Data access layer for artifacts table.
 */

import { supabase } from '@/lib/db/supabase';

export interface ArtifactRow {
    id: string;
    user_id: string;
    space_id: string;
    url: string;
    title: string | null;
    text_content: string | null;
    word_count: number | null;
    artifact_type: 'ambient' | 'engaged' | 'committed';
    base_weight: number;
    decay_multiplier: number;
    relevance: number | null;
    embedding: number[] | null;
    created_at: string;
    updated_at: string;
}

export interface CreateArtifactInput {
    user_id: string;
    space_id: string;
    url: string;
    title?: string | null;
    text_content?: string | null;
    word_count?: number | null;
    artifact_type: 'ambient' | 'engaged' | 'committed';
    base_weight: number;
    decay_multiplier?: number;
    relevance?: number | null;
    embedding?: number[] | null;
}

export const ArtifactRepository = {
    /**
     * Find all artifacts for a space, ordered by creation date (newest first).
     */
    async findBySpaceId(spaceId: string, limit = 100): Promise<ArtifactRow[]> {
        const { data, error } = await supabase
            .from('artifacts')
            .select('*')
            .eq('space_id', spaceId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    },

    /**
     * Find all artifacts for a user across all spaces.
     */
    async findByUserId(userId: string, limit = 500): Promise<ArtifactRow[]> {
        const { data, error } = await supabase
            .from('artifacts')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    },

    /**
     * Find a single artifact by ID.
     */
    async findById(id: string): Promise<ArtifactRow | null> {
        const { data, error } = await supabase
            .from('artifacts')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // Not found
            throw error;
        }
        return data;
    },

    /**
     * Create a new artifact.
     */
    async create(input: CreateArtifactInput): Promise<ArtifactRow> {
        const { data, error } = await supabase
            .from('artifacts')
            .insert({
                ...input,
                decay_multiplier: input.decay_multiplier ?? 1.0,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Update an existing artifact.
     */
    async update(id: string, updates: Partial<ArtifactRow>): Promise<ArtifactRow> {
        const { data, error } = await supabase
            .from('artifacts')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Delete an artifact by ID.
     */
    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('artifacts')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    /**
     * Count artifacts for a space.
     */
    async countBySpaceId(spaceId: string): Promise<number> {
        const { count, error } = await supabase
            .from('artifacts')
            .select('*', { count: 'exact', head: true })
            .eq('space_id', spaceId);

        if (error) throw error;
        return count || 0;
    },

    /**
     * Find artifacts created in a date range.
     */
    async findByDateRange(
        userId: string,
        startDate: Date,
        endDate: Date
    ): Promise<ArtifactRow[]> {
        const { data, error } = await supabase
            .from('artifacts')
            .select('*')
            .eq('user_id', userId)
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString())
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },
};
