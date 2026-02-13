/**
 * Space Repository
 * 
 * Data access layer for spaces table.
 */

import { supabase } from '@/lib/db/supabase';

export interface SpaceRow {
    id: string;
    user_id: string;
    name: string;
    description: string | null;
    embedding: number[] | null;
    subspaces: SubspaceData[] | null;
    created_at: string;
    updated_at: string;
}

export interface SubspaceData {
    name: string;
    evidence: number;
}

export interface CreateSpaceInput {
    user_id: string;
    name: string;
    description?: string | null;
    embedding?: number[] | null;
    subspaces?: SubspaceData[] | null;
}

export const SpaceRepository = {
    /**
     * Find all spaces for a user.
     */
    async findByUserId(userId: string): Promise<SpaceRow[]> {
        const { data, error } = await supabase
            .from('spaces')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    /**
     * Find a single space by ID.
     */
    async findById(id: string): Promise<SpaceRow | null> {
        const { data, error } = await supabase
            .from('spaces')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }
        return data;
    },

    /**
     * Create a new space.
     */
    async create(input: CreateSpaceInput): Promise<SpaceRow> {
        const { data, error } = await supabase
            .from('spaces')
            .insert(input)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Update an existing space.
     */
    async update(id: string, updates: Partial<SpaceRow>): Promise<SpaceRow> {
        const { data, error } = await supabase
            .from('spaces')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Delete a space by ID.
     */
    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('spaces')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    /**
     * Update subspaces for a space.
     */
    async updateSubspaces(id: string, subspaces: SubspaceData[]): Promise<SpaceRow> {
        return this.update(id, { subspaces });
    },

    /**
     * Count spaces for a user.
     */
    async countByUserId(userId: string): Promise<number> {
        const { count, error } = await supabase
            .from('spaces')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        if (error) throw error;
        return count || 0;
    },
};
