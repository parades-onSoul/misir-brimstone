/**
 * Insight Generation & Framing
 * 
 * Converts deltas to human-readable insights.
 * Implements JTD-P3: Insight Framing
 * 
 * Philosophy: Observe, don't prescribe. Present facts, let user interpret.
 * Power comes from mirrors, not advice.
 */

import { Insight, Delta, DeltaType, Severity } from '@/lib/types';
import { getSnapshots } from './snapshots';
import { getLatestBaseline, computeLegacyBaseline } from './baseline-orchestrator';
import { detectAllDeltas, detectDeltas, enrichDeltas } from './deltas';

// ============================================================================
// Insight Templates
// ============================================================================

/**
 * Insight language philosophy:
 * - Observational, not prescriptive
 * - Non-judgmental, almost boringly calm
 * - Present facts, let user interpret
 * - Power comes from mirrors, not advice
 */

interface InsightTemplate {
  headline: (d: Delta) => string;
  explanation: (d: Delta) => string;
  // No suggestions — we observe, we don't prescribe
}

const INSIGHT_TEMPLATES: Record<DeltaType, InsightTemplate> = {
  imbalance: {
    headline: (d) => {
      const windowDays = (d.metadata as { windowDays?: number })?.windowDays || 14;
      return `${Math.round(d.currentValue)}% of activity in one area over ${windowDays} days`;
    },
    explanation: (d) =>
      `In ${d.spaceName || 'this space'}, most recent activity centered on ${d.subspaceName || 'a single subspace'}.`,
  },

  gap: {
    headline: (d) => {
      const dormantCount = Math.round(d.currentValue - d.baselineValue);
      const days = (d.metadata as { dormantDays?: number })?.dormantDays || 14;
      return `${dormantCount} topic${dormantCount !== 1 ? 's' : ''} with no activity for ${days}+ days`;
    },
    explanation: (d) =>
      `In ${d.spaceName || 'this space'}, some previously active subspaces have gone quiet.`,
  },

  drift: {
    headline: (d) => {
      const meta = d.metadata as { direction?: string } | undefined;
      const direction = meta?.direction;
      if (direction === 'deepening') return 'Attention deepening in focused areas';
      if (direction === 'becoming dormant') return 'Activity slowing across topics';
      if (direction === 'actively exploring') return 'Exploration mode active';
      return 'Attention distribution shifted from baseline';
    },
    explanation: (d) => {
      const meta = d.metadata as { massDelta?: number[] } | undefined;
      const massDelta = meta?.massDelta;

      if (!massDelta) return `The pattern of where time goes has changed.`;

      const changes: string[] = [];
      if (massDelta[3] > 0) changes.push(`+${Math.round(massDelta[3])} saturated`);
      if (massDelta[3] < 0) changes.push(`${Math.round(massDelta[3])} saturated`);
      if (massDelta[0] > 0) changes.push(`+${Math.round(massDelta[0])} latent`);
      if (massDelta[0] < 0) changes.push(`${Math.round(massDelta[0])} latent`);

      if (changes.length > 0) {
        return `In ${d.spaceName || 'this space'}: ${changes.join(', ')} subspaces compared to 30-day baseline.`;
      }
      return `The distribution across states in ${d.spaceName || 'this space'} looks different than usual.`;
    },
  },

  false_stability: {
    headline: (d) => {
      const days = (d.metadata as { inactiveDays?: number })?.inactiveDays || 10;
      return `${d.subspaceName || 'One topic'} marked saturated, inactive ${days} days`;
    },
    explanation: () =>
      `This subspace reached the highest state but has had no new artifacts recently.`,
  },

  silent_growth: {
    headline: (d) =>
      `${d.subspaceName || 'One topic'} reached Engaged via ambient activity`,
    explanation: () =>
      `State advanced through page visits alone. No saves or highlights recorded.`,
  },

  acceleration: {
    headline: (d) =>
      `${d.spaceName || 'One space'} activity accelerating`,
    explanation: (d) =>
      `Evidence increased ${Math.abs(Math.round(d.changePercent))}% compared to baseline. Rapid learning happening here.`,
  },

  deceleration: {
    headline: (d) =>
      `${d.spaceName || 'One space'} activity slowing down`,
    explanation: (d) =>
      `Evidence decreased ${Math.abs(Math.round(d.changePercent))}% compared to baseline. Focus has shifted elsewhere.`,
  },

  return: {
    headline: (d) =>
      `Returning to ${d.subspaceName || d.spaceName || 'a dormant topic'}`,
    explanation: () =>
      `Activity resumed after extended period of inactivity. Old interests rekindled.`,
  },

  milestone: {
    headline: (d) => {
      const meta = d.metadata as { milestoneType?: string } | undefined;
      const milestoneType = meta?.milestoneType;
      if (milestoneType === 'first_saturation') return `First topic reached Saturated state`;
      if (milestoneType === 'new_space') return `New space created`;
      return `Milestone reached in ${d.spaceName || 'your learning'}`;
    },
    explanation: (d) => {
      const meta = d.metadata as { milestoneType?: string } | undefined;
      if (meta?.milestoneType === 'first_saturation') {
        return `${d.subspaceName || 'A topic'} reached the highest attention state. Deep familiarity achieved.`;
      }
      return `A significant learning milestone was reached.`;
    },
  },

  rabbit_hole: {
    headline: (d) => {
      const meta = d.metadata as { urlCount?: number; durationMinutes?: number } | undefined;
      const urlCount = meta?.urlCount || Math.round(d.currentValue);
      const duration = meta?.durationMinutes || 60;
      return `Flow state detected: ${urlCount} artifacts in ${duration} minutes`;
    },
    explanation: (d) =>
      `High-velocity exploration in ${d.subspaceName || d.spaceName || 'one area'}. Deep focus achieved.`,
  },
  consumption_trap: {
    headline: (d) =>
      `Consumption trap detected in ${d.subspaceName || 'a topic'}`,
    explanation: (d) => {
      const meta = d.metadata as { wordCount?: number } | undefined;
      const count = Math.round((meta?.wordCount || 0) / 1000);
      return `You've read ~${count}k words here recently but haven't saved any notes. High input, low output.`;
    },
  },
};

// ============================================================================
// Insight Generation
// ============================================================================

/**
 * Frame a delta into a human-readable insight
 */
export function frameInsight(delta: Delta, userId: string): Insight {
  const template = INSIGHT_TEMPLATES[delta.type] || {
    headline: () => 'New pattern detected',
    explanation: () => 'Activity patterns have changed from baseline.',
  };

  return {
    id: crypto.randomUUID(),
    userId,
    createdAt: new Date(),
    type: delta.type,
    severity: delta.severity,
    headline: template.headline(delta),
    explanation: template.explanation(delta),
    delta,
    status: null, // Active by default
  };
}

/**
 * Filter deltas to only include actionable ones
 */
function filterActionableDeltas(deltas: Delta[]): Delta[] {
  return deltas.filter(d => {
    // Always include high severity
    if (d.severity === 'high') return true;

    // Include medium severity for most types
    if (d.severity === 'medium') return true;

    // Be selective about low severity
    if (d.severity === 'low') {
      // Include positive signals like rabbit holes and silent growth
      return d.type === 'silent_growth' || d.type === 'rabbit_hole' || d.type === 'milestone';
    }

    return false;
  });
}

/**
 * Deduplicate insights (e.g., don't show both imbalance and drift for same space)
 */
function deduplicateInsights(insights: Insight[]): Insight[] {
  const seen = new Map<string, Insight>();

  for (const insight of insights) {
    // Key by space + type (allow one of each type per space)
    const key = `${insight.delta.spaceId}:${insight.type}:${insight.delta.subspaceId || 'space'}`;

    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, insight);
    } else {
      // Keep the higher severity one
      const severityOrder: Record<Severity, number> = { high: 3, medium: 2, low: 1 };
      if (severityOrder[insight.severity] > severityOrder[existing.severity]) {
        seen.set(key, insight);
      }
    }
  }

  return Array.from(seen.values());
}

/**
 * Generate all insights for a user
 * 
 * Flow:
 * 1. Get active insights from DB (to preserve state)
 * 2. Generate fresh insights from snapshots
 * 3. Merge:
 *    - If fresh matches active DB insight -> Keep DB version (preserve ID/created_at)
 *    - If fresh matches recently dismissed DB insight -> Ignore
 *    - If fresh is new -> Create new ID
 * 4. Persist new insights to DB
 */
export async function generateInsights(
  supabase: ReturnType<typeof import('@/lib/db/supabase-server').createClient> extends Promise<infer T> ? T : never,
  userId: string,
  options?: {
    useNewBaseline?: boolean;
    limit?: number;
    persist?: boolean;
  }
): Promise<Insight[]> {
  const useNewBaseline = options?.useNewBaseline ?? true;
  const limit = options?.limit ?? 5;
  const persist = options?.persist ?? true;

  // 1. Fetch existing active insights from DB
  const { data: activeInsights } = await supabase
    .from('insights')
    .select('*')
    .eq('user_id', userId)
    .is('status', null);

  // 2. Fetch recently dismissed insights (last 7 days) to avoid nagging
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentlyDismissed } = await supabase
    .from('insights')
    .select('type, space_id, subspace_id')
    .eq('user_id', userId)
    .eq('status', 'dismissed')
    .gte('acted_at', sevenDaysAgo);

  // 3. Generate fresh heuristics
  const snapshots = await getSnapshots(supabase, userId, 1, 'daily');

  if (snapshots.length === 0) {
    return (activeInsights as unknown as Insight[]) || [];
  }

  const currentSnapshot = snapshots[0];
  let deltas: Delta[] = [];

  // ... (Baseline logic remains same) ...
  if (useNewBaseline) {
    const baseline = await getLatestBaseline(supabase, userId);
    if (!baseline) {
      const legacyBaseline = await computeLegacyBaseline(supabase, userId);
      if (legacyBaseline) {
        deltas = detectDeltas(currentSnapshot.data, legacyBaseline);
        deltas = await enrichDeltas(supabase, userId, deltas);
      }
    } else {
      deltas = await detectAllDeltas(supabase, userId, currentSnapshot.data, baseline);
    }
  } else {
    // ... Legacy path ...
    const baseline = await computeLegacyBaseline(supabase, userId);
    if (baseline) {
      deltas = detectDeltas(currentSnapshot.data, baseline);
      deltas = await enrichDeltas(supabase, userId, deltas);
    }
  }

  // Add Consumption Trap detection (separate from deltas pipeline as it needs raw artifact data)
  const { detectConsumptionTrap } = await import('./deltas');
  const consumptionTraps = await detectConsumptionTrap(supabase, userId);
  deltas = [...deltas, ...consumptionTraps];

  // Filter & Frame
  deltas = filterActionableDeltas(deltas);
  let freshInsights = deltas.map(d => frameInsight(d, userId));
  freshInsights = deduplicateInsights(freshInsights);

  // 4. Merge Logic
  const finalInsights: Insight[] = [];
  const insightsToPersist: Insight[] = [];

  // Map for quick lookup
  const activeMap = new Map(
    (activeInsights || []).map(i => [`${i.space_id}:${i.type}:${i.subspace_id || 'null'}`, i])
  );

  const dismissedSet = new Set(
    (recentlyDismissed || []).map(i => `${i.space_id}:${i.type}:${i.subspace_id || 'null'}`)
  );

  for (const fresh of freshInsights) {
    const key = `${fresh.delta.spaceId}:${fresh.type}:${fresh.delta.subspaceId || 'null'}`;

    if (dismissedSet.has(key)) {
      // Ignore recently dismissed
      continue;
    }

    if (activeMap.has(key)) {
      // Already exists and active - keep existing (stable ID)
      const existing = activeMap.get(key)!;
      // TODO: Maybe update severity if it changed?
      finalInsights.push({
        ...fresh,
        id: existing.id,
        createdAt: new Date(existing.created_at),
        // Keep other DB fields
      });
      // Remove from map so we know what remains
      activeMap.delete(key);
    } else {
      // New insight!
      finalInsights.push(fresh);
      insightsToPersist.push(fresh);
    }
  }

  // Add remaining active insights (that didn't trigger this run but are still capable of being active)
  // Logic decision: Do we auto-resolve insights that no longer trigger?
  // implementation_plan says: "Persist new insights". It implies we keep old ones until acted upon.
  // For now, let's keep them.
  for (const existing of activeMap.values()) {
    finalInsights.push({
      ...existing, // Need to map DB fields to Insight type properly
      id: existing.id,
      userId: existing.user_id,
      createdAt: new Date(existing.created_at),
      type: existing.type,
      severity: existing.severity,
      headline: existing.headline,
      explanation: existing.explanation,
      delta: existing.delta_data,
      status: existing.status,
      actedAt: existing.acted_at ? new Date(existing.acted_at) : null,
    });
  }

  // 5. Persist new insights
  if (persist && insightsToPersist.length > 0) {
    const dbPayloads = insightsToPersist.map(i => ({
      id: i.id,
      user_id: i.userId,
      type: i.type,
      space_id: i.delta.spaceId,
      subspace_id: i.delta.subspaceId,
      headline: i.headline,
      explanation: i.explanation,
      severity: i.severity,
      delta_data: i.delta,
      status: null,
    }));

    const { error } = await supabase.from('insights').insert(dbPayloads);
    if (error) {
      console.error('[Insights] Failed to persist:', error);
    } else {
      console.log(`[Insights] Persisted ${insightsToPersist.length} new insights`);
    }
  }

  // Sort by severity
  const severityOrder: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  finalInsights.sort((a, b) => {
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return a.type.localeCompare(b.type);
  });

  return finalInsights.slice(0, limit);
}

/**
 * Get insight summary for dashboard
 */
export function summarizeInsights(insights: Insight[]): {
  total: number;
  high: number;
  medium: number;
  low: number;
  topHeadline: string | null;
} {
  return {
    total: insights.length,
    high: insights.filter(i => i.severity === 'high').length,
    medium: insights.filter(i => i.severity === 'medium').length,
    low: insights.filter(i => i.severity === 'low').length,
    topHeadline: insights[0]?.headline ?? null,
  };
}
