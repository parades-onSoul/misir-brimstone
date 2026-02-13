/**
 * Baseline Computation & Persistence
 * 
 * Computes statistical baselines from snapshot history to enable delta detection.
 * Implements both simple averaging and weighted moving average algorithms.
 * 
 * JTD-P1: Baseline Computation
 */

import {
  StateVector,
  PersistedSnapshot,
  SnapshotData,
  SnapshotType
} from '@/lib/types';
import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

// Database row types for Supabase queries
interface SnapshotRow {
  id: string;
  user_id: string;
  snapshot_type: SnapshotType;
  timestamp: string;
  data: SnapshotData;
}

interface BaselineRow {
  id: string;
  user_id: string;
  computed_at: string;
  window_days: number;
  baseline_type: BaselineType;
  alpha?: number;
  data: BaselineData;
  snapshots_used: number;
}

export type BaselineType = 'simple' | 'weighted';

export interface BaselineSpaceData {
  spaceId: string;
  name: string;
  avgMassVector: StateVector;
  avgEvidence: number;
  avgSubspaceCount: number;
  trend?: 'up' | 'down' | 'stable';
}

export interface BaselineData {
  globalAvgMassVector: StateVector;
  totalSpaces: number;
  totalSubspaces: number;
  spaces: BaselineSpaceData[];
}

export interface PersistedBaseline {
  id: string;
  userId: string;
  computedAt: Date;
  windowDays: number;
  baselineType: BaselineType;
  alpha?: number;
  data: BaselineData;
  snapshotsUsed: number;
}

export interface ComputeBaselineParams {
  userId: string;
  windowDays?: number; // Default 30
  type?: BaselineType; // Default 'weighted'
  alpha?: number;      // Default 0.1 for weighted
}

// ============================================================================
// Baseline Computation
// ============================================================================

/**
 * Compute simple baseline (equal weights for all snapshots)
 */
export function computeSimpleBaseline(
  snapshots: PersistedSnapshot[]
): BaselineData {
  if (snapshots.length === 0) {
    throw new Error('Cannot compute baseline from zero snapshots');
  }

  // Accumulate data by space ID
  const spaceAccumulators = new Map<string, {
    name: string;
    massVectorSum: StateVector;
    evidenceSum: number;
    subspaceCountSum: number;
    count: number;
  }>();

  for (const snapshot of snapshots) {
    for (const space of snapshot.data.spaces) {
      if (!spaceAccumulators.has(space.spaceId)) {
        spaceAccumulators.set(space.spaceId, {
          name: space.name,
          massVectorSum: [0, 0, 0, 0],
          evidenceSum: 0,
          subspaceCountSum: 0,
          count: 0,
        });
      }

      const acc = spaceAccumulators.get(space.spaceId)!;
      acc.massVectorSum = acc.massVectorSum.map(
        (v, i) => v + space.massVector[i]
      ) as StateVector;
      acc.evidenceSum += space.totalEvidence;
      acc.subspaceCountSum += space.subspaces.length;
      acc.count += 1;
    }
  }

  // Compute averages
  const spaces: BaselineSpaceData[] = Array.from(spaceAccumulators.entries()).map(
    ([spaceId, acc]) => ({
      spaceId,
      name: acc.name,
      avgMassVector: acc.massVectorSum.map(v => v / acc.count) as StateVector,
      avgEvidence: acc.evidenceSum / acc.count,
      avgSubspaceCount: acc.subspaceCountSum / acc.count,
    })
  );

  // Compute global mass vector (sum of all space averages)
  const globalAvgMassVector = spaces.reduce(
    (sum, space) => sum.map((v, i) => v + space.avgMassVector[i]) as StateVector,
    [0, 0, 0, 0] as StateVector
  );

  const totalSubspaces = spaces.reduce((sum, s) => sum + s.avgSubspaceCount, 0);

  return {
    globalAvgMassVector,
    totalSpaces: spaces.length,
    totalSubspaces,
    spaces,
  };
}

/**
 * Compute weighted baseline (exponential decay, recent snapshots weighted more)
 * 
 * Formula: weight_i = exp(-α * (n - 1 - i))
 * Where α = decay factor (0.1 recommended), i = snapshot index (0 = oldest)
 */
export function computeWeightedBaseline(
  snapshots: PersistedSnapshot[],
  alpha: number = 0.1
): BaselineData {
  if (snapshots.length === 0) {
    throw new Error('Cannot compute baseline from zero snapshots');
  }

  if (alpha <= 0 || alpha > 1) {
    throw new Error('Alpha must be in range (0, 1]');
  }

  const n = snapshots.length;

  // Compute weights (exponential decay)
  // Most recent snapshot (index n-1) has weight = 1.0
  // Oldest snapshot (index 0) has weight = exp(-α * (n-1))
  const weights = snapshots.map((_, i) => Math.exp(-alpha * (n - 1 - i)));
  const weightSum = weights.reduce((sum, w) => sum + w, 0);

  // Normalize weights to sum to 1
  const normalizedWeights = weights.map(w => w / weightSum);

  // Accumulate weighted data by space ID
  const spaceAccumulators = new Map<string, {
    name: string;
    massVectorSum: StateVector;
    evidenceSum: number;
    subspaceCountSum: number;
    weightSum: number;
  }>();

  for (let i = 0; i < snapshots.length; i++) {
    const snapshot = snapshots[i];
    const weight = normalizedWeights[i];

    for (const space of snapshot.data.spaces) {
      if (!spaceAccumulators.has(space.spaceId)) {
        spaceAccumulators.set(space.spaceId, {
          name: space.name,
          massVectorSum: [0, 0, 0, 0],
          evidenceSum: 0,
          subspaceCountSum: 0,
          weightSum: 0,
        });
      }

      const acc = spaceAccumulators.get(space.spaceId)!;
      acc.massVectorSum = acc.massVectorSum.map(
        (v, idx) => v + space.massVector[idx] * weight
      ) as StateVector;
      acc.evidenceSum += space.totalEvidence * weight;
      acc.subspaceCountSum += space.subspaces.length * weight;
      acc.weightSum += weight;
    }
  }

  // Compute weighted averages
  const spaces: BaselineSpaceData[] = Array.from(spaceAccumulators.entries()).map(
    ([spaceId, acc]) => ({
      spaceId,
      name: acc.name,
      avgMassVector: acc.massVectorSum.map(v => v / acc.weightSum) as StateVector,
      avgEvidence: acc.evidenceSum / acc.weightSum,
      avgSubspaceCount: acc.subspaceCountSum / acc.weightSum,
    })
  );

  // Compute global mass vector
  const globalAvgMassVector = spaces.reduce(
    (sum, space) => sum.map((v, i) => v + space.avgMassVector[i]) as StateVector,
    [0, 0, 0, 0] as StateVector
  );

  const totalSubspaces = spaces.reduce((sum, s) => sum + s.avgSubspaceCount, 0);

  return {
    globalAvgMassVector,
    totalSpaces: spaces.length,
    totalSubspaces,
    spaces,
  };
}

/**
 * Compute baseline from snapshots
 */
export async function computeBaseline(
  supabase: SupabaseClient<Record<string, unknown>>,
  params: ComputeBaselineParams
): Promise<{ success: boolean; baseline?: PersistedBaseline; error?: string }> {
  try {
    const windowDays = params.windowDays ?? 30;
    const type = params.type ?? 'weighted';
    const alpha = params.alpha ?? 0.1;

    // 1. Fetch snapshots for window
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const { data: snapshotRows, error: fetchError } = await supabase
      .from('snapshots')
      .select('*')
      .eq('user_id', params.userId)
      .gte('timestamp', since.toISOString())
      .order('timestamp', { ascending: true }); // Oldest first for weight calculation

    if (fetchError) throw fetchError;

    if (!snapshotRows || snapshotRows.length === 0) {
      return {
        success: false,
        error: `No snapshots found in last ${windowDays} days`,
      };
    }

    // Parse snapshots
    const snapshots: PersistedSnapshot[] = (snapshotRows as SnapshotRow[]).map((row) => ({
      id: row.id,
      userId: row.user_id,
      snapshotType: row.snapshot_type,
      timestamp: new Date(row.timestamp),
      data: row.data,
    }));

    // 2. Compute baseline based on type
    const baselineData =
      type === 'weighted'
        ? computeWeightedBaseline(snapshots, alpha)
        : computeSimpleBaseline(snapshots);

    // 3. Store baseline in database
    const insertData = {
      user_id: params.userId,
      window_days: windowDays,
      baseline_type: type,
      alpha: type === 'weighted' ? alpha : null,
      data: baselineData,
      snapshots_used: snapshots.length,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: baselineRow, error: insertError } = await (supabase as any)
      .from('baselines')
      .insert(insertData)
      .select()
      .single();

    if (insertError) throw insertError;

    const row = baselineRow as unknown as BaselineRow;
    const baseline: PersistedBaseline = {
      id: row.id,
      userId: row.user_id,
      computedAt: new Date(row.computed_at),
      windowDays: row.window_days,
      baselineType: row.baseline_type,
      alpha: row.alpha,
      data: row.data,
      snapshotsUsed: row.snapshots_used,
    };

    return { success: true, baseline };
  } catch (error) {
    console.error('[Baseline] Error computing baseline:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get the most recent baseline for a user
 */
export async function getLatestBaseline(
  supabase: SupabaseClient<Record<string, unknown>>,
  userId: string
): Promise<PersistedBaseline | null> {
  const { data, error } = await supabase
    .from('baselines')
    .select('*')
    .eq('user_id', userId)
    .order('computed_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No baselines found
      return null;
    }
    console.error('[Baseline] Error fetching latest baseline:', error);
    throw error;
  }

  const row = data as unknown as BaselineRow;
  return {
    id: row.id,
    userId: row.user_id,
    computedAt: new Date(row.computed_at),
    windowDays: row.window_days,
    baselineType: row.baseline_type,
    alpha: row.alpha,
    data: row.data,
    snapshotsUsed: row.snapshots_used,
  };
}

// ============================================================================
// Legacy Compatibility Layer
// ============================================================================

import { Baseline } from '@/lib/types';
import { BASELINE_CONFIG } from '@/lib/math';
import { getSnapshots as getSnapshotsFn } from './snapshots';

/**
 * Legacy baseline computation for backward compatibility
 * 
 * This maintains the old API: computeLegacyBaseline(supabase, userId, windowDays)
 * Used by insights.ts when no persisted baseline exists.
 * 
 * @deprecated Use computeBaseline with ComputeBaselineParams instead
 */
export async function computeLegacyBaseline(
  supabase: SupabaseClient<Record<string, unknown>>,
  userId: string,
  windowDays: number = BASELINE_CONFIG.windowDays
): Promise<Baseline | null> {
  const snapshots = await getSnapshotsFn(supabase, userId, windowDays, 'daily');

  if (snapshots.length < 3) {
    // Need at least 3 days of data for meaningful baseline
    return null;
  }

  // Calculate weights: most recent = 1.0, decaying exponentially
  const weights = snapshots.map((_, i) => Math.exp(-BASELINE_CONFIG.alpha * i));

  // Aggregate by space
  const spaceMap = new Map<string, {
    massVectors: StateVector[];
    evidences: number[];
    weights: number[];
  }>();

  snapshots.forEach((snap, i) => {
    for (const space of snap.data.spaces) {
      if (!spaceMap.has(space.spaceId)) {
        spaceMap.set(space.spaceId, {
          massVectors: [],
          evidences: [],
          weights: [],
        });
      }
      const entry = spaceMap.get(space.spaceId)!;
      entry.massVectors.push(space.massVector);
      entry.evidences.push(space.totalEvidence);
      entry.weights.push(weights[i]);
    }
  });

  // Compute weighted averages
  const spaces = Array.from(spaceMap.entries()).map(([spaceId, data]) => {
    const wSum = data.weights.reduce((a, b) => a + b, 0);

    // Weighted average mass vector
    const avgMassVector = [0, 0, 0, 0].map((_, slot) =>
      data.massVectors.reduce(
        (sum, mv, i) => sum + mv[slot] * data.weights[i],
        0
      ) / wSum
    ) as StateVector;

    // Weighted average evidence
    const avgEvidence =
      data.evidences.reduce((sum, e, i) => sum + e * data.weights[i], 0) / wSum;

    return {
      spaceId,
      avgMassVector,
      avgEvidence,
      avgArtifactsPerDay: 0,
    };
  });

  return {
    userId,
    computedAt: new Date(),
    windowDays,
    spaces,
  };
}

/**
 * Get baseline space data by spaceId (legacy helper)
 */
export function getBaselineSpace(
  baseline: Baseline,
  spaceId: string
): Baseline['spaces'][0] | undefined {
  return baseline.spaces.find(s => s.spaceId === spaceId);
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get baselines for a user within a time range
 */
export async function getBaselines(
  supabase: SupabaseClient<Record<string, unknown>>,
  userId: string,
  days: number = 90
): Promise<PersistedBaseline[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('baselines')
    .select('*')
    .eq('user_id', userId)
    .gte('computed_at', since.toISOString())
    .order('computed_at', { ascending: false });

  if (error) {
    console.error('[Baseline] Error fetching baselines:', error);
    return [];
  }

  return ((data || []) as BaselineRow[]).map((row) => ({
    id: row.id,
    userId: row.user_id,
    computedAt: new Date(row.computed_at),
    windowDays: row.window_days,
    baselineType: row.baseline_type,
    alpha: row.alpha,
    data: row.data,
    snapshotsUsed: row.snapshots_used,
  }));
}
