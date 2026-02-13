/**
 * Insight Service
 * 
 * Business logic for insight generation, retrieval, and actions.
 * 
 * Note: This service uses its own simplified types that map to DB rows,
 * avoiding coupling to the complex engine types.
 */

import { InsightRepository, type InsightRow, type CreateInsightInput } from '@/lib/repositories';
import type { InsightAction } from '@/lib/types';

/**
 * Simplified insight type for service layer.
 */
export interface ServiceInsight {
    id: string;
    userId: string;
    spaceId?: string;
    type: string;
    title: string;
    description: string;
    evidence: Record<string, unknown>;
    priority: number;
    status: 'active' | 'dismissed' | 'kept' | 'crystallized';
    createdAt: string;
    expiresAt?: string;
    actedAt?: string;
}

function rowToServiceInsight(row: InsightRow): ServiceInsight {
    return {
        id: row.id,
        userId: row.user_id,
        spaceId: row.space_id || undefined,
        type: row.type,
        title: row.title,
        description: row.description,
        evidence: row.evidence,
        priority: row.priority,
        status: row.status,
        createdAt: row.created_at,
        expiresAt: row.expires_at || undefined,
        actedAt: row.acted_at || undefined,
    };
}

export const InsightService = {
    /**
     * Get all active insights for a user.
     */
    async getActiveInsights(userId: string): Promise<ServiceInsight[]> {
        const rows = await InsightRepository.findActive(userId);
        return rows.map(rowToServiceInsight);
    },

    /**
     * Create and persist a new insight.
     */
    async createInsight(input: {
        userId: string;
        spaceId?: string;
        type: string;
        title: string;
        description: string;
        evidence?: Record<string, unknown>;
        priority?: number;
        expiresAt?: string;
    }): Promise<ServiceInsight> {
        const dbInput: CreateInsightInput = {
            user_id: input.userId,
            space_id: input.spaceId,
            type: input.type,
            title: input.title,
            description: input.description,
            evidence: input.evidence,
            priority: input.priority,
            expires_at: input.expiresAt,
        };

        const row = await InsightRepository.upsert(dbInput);
        return rowToServiceInsight(row);
    },

    /**
     * Perform an action on an insight (dismiss, keep, crystallize).
     */
    async performAction(insightId: string, action: InsightAction): Promise<void> {
        await InsightRepository.updateStatus(insightId, action);
    },

    /**
     * Get count of active insights for a user.
     */
    async getActiveCount(userId: string): Promise<number> {
        return InsightRepository.countActive(userId);
    },
};
