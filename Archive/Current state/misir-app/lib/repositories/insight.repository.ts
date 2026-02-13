/**
 * Insight Repository
 * 
 * Data access layer for insights table.
 */

import { supabase } from '@/lib/db/supabase';
import type { InsightAction } from '@/lib/types';

export interface InsightRow {
    id: string;
    user_id: string;
    space_id: string | null;
    type: string;
    title: string;
    description: string;
    evidence: Record<string, unknown>;
    priority: number;
    status: 'active' | 'dismissed' | 'kept' | 'crystallized';
    created_at: string;
    expires_at: string | null;
    acted_at: string | null;
}

export interface CreateInsightInput {
    user_id: string;
    space_id?: string | null;
    type: string;
    title: string;
    description: string;
    evidence?: Record<string, unknown>;
    priority?: number;
    expires_at?: string | null;
}

export const InsightRepository = {
    /**
     * Find all active insights for a user.
     */
    async findActive(userId: string): Promise<InsightRow[]> {
        const { data, error } = await supabase
            .from('insights')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .order('priority', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    /**
     * Find all insights for a user (any status).
     */
    async findByUserId(userId: string, limit = 100): Promise<InsightRow[]> {
        const { data, error } = await supabase
            .from('insights')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    },

    /**
     * Find a single insight by ID.
     */
    async findById(id: string): Promise<InsightRow | null> {
        const { data, error } = await supabase
            .from('insights')
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
     * Create a new insight.
     */
    async create(input: CreateInsightInput): Promise<InsightRow> {
        const { data, error } = await supabase
            .from('insights')
            .insert({
                ...input,
                status: 'active',
                evidence: input.evidence || {},
                priority: input.priority ?? 1,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Update insight status (dismiss, keep, crystallize).
     */
    async updateStatus(id: string, action: InsightAction): Promise<InsightRow> {
        const statusMap: Record<InsightAction, InsightRow['status']> = {
            dismiss: 'dismissed',
            keep: 'kept',
            crystallize: 'crystallized',
        };

        const { data, error } = await supabase
            .from('insights')
            .update({
                status: statusMap[action],
                acted_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Check if an insight with the same type/space already exists.
     */
    async findExisting(
        userId: string,
        type: string,
        spaceId?: string | null
    ): Promise<InsightRow | null> {
        let query = supabase
            .from('insights')
            .select('*')
            .eq('user_id', userId)
            .eq('type', type)
            .eq('status', 'active');

        if (spaceId) {
            query = query.eq('space_id', spaceId);
        }

        const { data, error } = await query.maybeSingle();

        if (error) throw error;
        return data;
    },

    /**
     * Upsert an insight (create or update if exists).
     */
    async upsert(input: CreateInsightInput): Promise<InsightRow> {
        const existing = await this.findExisting(
            input.user_id,
            input.type,
            input.space_id
        );

        if (existing) {
            // Update existing insight
            const { data, error } = await supabase
                .from('insights')
                .update({
                    title: input.title,
                    description: input.description,
                    evidence: input.evidence || existing.evidence,
                    priority: input.priority ?? existing.priority,
                })
                .eq('id', existing.id)
                .select()
                .single();

            if (error) throw error;
            return data;
        }

        return this.create(input);
    },

    /**
     * Delete an insight.
     */
    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('insights')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    /**
     * Count active insights for a user.
     */
    async countActive(userId: string): Promise<number> {
        const { count, error } = await supabase
            .from('insights')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'active');

        if (error) throw error;
        return count || 0;
    },
};
