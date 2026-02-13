/**
 * Snapshot Generation & Persistence
 * 
 * Creates immutable snapshots of space state for insight generation.
 * Implements JTD-P0.1: Snapshot Persistence
 */

import {
  SpaceSnapshot,
  Snapshot,
  StateVector,
  SnapshotData,
  SnapshotType,
  PersistedSnapshot,
  StateIndex,
} from '@/lib/types';
import { getStateFromEvidence } from '@/lib/math';
import { getDominantState, calculateDrift } from './state-transitions';
import { getCurrentEvidence } from './evidence';

export interface SpaceData {
  id: string;
  name: string;
  stateVector: StateVector | unknown;
  evidence: number;
  lastUpdatedAt: Date;
}

export interface SubspaceData {
  id: string;
  name: string;
  evidence: number;
  lastArtifactAt?: Date;
}

export interface SpaceWithSubspaces {
  id: string;
  name: string;
  subspaces: SubspaceData[];
}

/**
 * Compute state from evidence using thresholds
 */
export function computeState(evidence: number): StateIndex {
  return getStateFromEvidence(evidence);
}

/**
 * Convert state index to one-hot state vector
 */
export function stateToVector(state: StateIndex): StateVector {
  const vector: StateVector = [0, 0, 0, 0];
  vector[state] = 1;
  return vector;
}

/**
 * Compute mass vector from subspaces (sum of state vectors)
 */
export function computeMassVector(subspaces: { evidence: number }[]): StateVector {
  return subspaces.reduce<StateVector>(
    (mass, sub) => {
      const state = computeState(sub.evidence);
      mass[state] += 1;
      return mass;
    },
    [0, 0, 0, 0]
  );
}

/**
 * Convert database Space to SpaceSnapshot (legacy format)
 */
export function createSpaceSnapshot(
  space: SpaceData,
  previousStateVector?: StateVector
): SpaceSnapshot {
  const stateVector = (Array.isArray(space.stateVector)
    ? space.stateVector
    : space.stateVector) as StateVector;
  const dominantState = getDominantState(stateVector);

  const driftScore = previousStateVector
    ? calculateDrift(stateVector, previousStateVector)
    : 0;

  const currentEvidence = getCurrentEvidence(
    space.evidence,
    space.lastUpdatedAt
  );

  return {
    spaceId: space.id,
    name: space.name,
    stateVector,
    dominantState,
    driftScore,
    evidence: currentEvidence,
  };
}

/**
 * Generate a complete snapshot for a user (legacy format)
 */
export function generateSnapshot(
  userId: string,
  spaces: SpaceData[],
  previousSnapshots?: Map<string, StateVector>
): Omit<Snapshot, 'id'> {
  const spaceSnapshots = spaces.map(space => {
    const previousState = previousSnapshots?.get(space.id);
    return createSpaceSnapshot(space, previousState);
  });

  return {
    userId,
    timestamp: new Date(),
    spaces: spaceSnapshots,
  };
}

// ============================================================================
// New Snapshot System (Read Path)
// ============================================================================

/**
 * Create snapshot data from spaces with subspaces
 */
export function createSnapshotData(spaces: SpaceWithSubspaces[]): SnapshotData {
  return {
    spaces: spaces.map(space => ({
      spaceId: space.id,
      name: space.name,
      massVector: computeMassVector(space.subspaces),
      totalEvidence: space.subspaces.reduce((sum, s) => sum + s.evidence, 0),
      subspaces: space.subspaces.map(sub => ({
        subspaceId: sub.id,
        name: sub.name,
        evidence: sub.evidence,
        state: computeState(sub.evidence),
      })),
    })),
  };
}

/**
 * Capture and persist a daily snapshot for a user
 */
export async function captureSnapshot(
  supabase: ReturnType<typeof import('@/lib/db/supabase-server').createClient> extends Promise<infer T> ? T : never,
  userId: string,
  snapshotType: SnapshotType = 'daily'
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch spaces with subspaces
    const { data: spaces, error: spacesError } = await supabase
      .from('spaces')
      .select(`
        id,
        name,
        subspaces (
          id,
          name
        )
      `)
      .eq('user_id', userId);

    if (spacesError) throw spacesError;
    if (!spaces?.length) return { success: true }; // No spaces to snapshot

    // Fetch evidence for each subspace from artifacts
    const spacesWithEvidence: SpaceWithSubspaces[] = await Promise.all(
      spaces.map(async (space) => {
        const subspacesWithEvidence = await Promise.all(
          (space.subspaces || []).map(async (subspace) => {
            // Calculate evidence from artifacts
            const { data: artifacts } = await supabase
              .from('artifacts')
              .select('base_weight, relevance, created_at')
              .eq('subspace_id', subspace.id)
              .order('created_at', { ascending: false })
              .limit(100);

            let evidence = 0;
            const now = new Date();
            for (const artifact of artifacts || []) {
              const daysSince = (now.getTime() - new Date(artifact.created_at).getTime()) / (1000 * 60 * 60 * 24);
              const decayedEvidence = (artifact.base_weight * artifact.relevance) * Math.exp(-0.1 * daysSince);
              evidence += decayedEvidence;
            }

            return {
              id: subspace.id,
              name: subspace.name,
              evidence,
            };
          })
        );

        return {
          id: space.id,
          name: space.name,
          subspaces: subspacesWithEvidence,
        };
      })
    );

    // Create snapshot data
    const data = createSnapshotData(spacesWithEvidence);

    // Insert snapshot
    const { error: insertError } = await supabase
      .from('snapshots')
      .insert({
        user_id: userId,
        snapshot_type: snapshotType,
        data,
      });

    if (insertError) throw insertError;

    return { success: true };
  } catch (error) {
    console.error('[Snapshot] Error capturing snapshot:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get recent snapshots for a user
 */
export async function getSnapshots(
  supabase: ReturnType<typeof import('@/lib/db/supabase-server').createClient> extends Promise<infer T> ? T : never,
  userId: string,
  days: number = 30,
  snapshotType: SnapshotType = 'daily'
): Promise<PersistedSnapshot[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('snapshots')
    .select('*')
    .eq('user_id', userId)
    .eq('snapshot_type', snapshotType)
    .gte('timestamp', since.toISOString())
    .order('timestamp', { ascending: false });

  if (error) {
    console.error('[Snapshot] Error fetching snapshots:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    userId: row.user_id,
    snapshotType: row.snapshot_type as SnapshotType,
    timestamp: new Date(row.timestamp),
    data: row.data as SnapshotData,
  }));
}

/**
 * Find subspace evidence from snapshot data
 */
export function findSubspaceEvidence(
  snapshot: PersistedSnapshot,
  subspaceId: string
): number | null {
  for (const space of snapshot.data.spaces) {
    const sub = space.subspaces.find(s => s.subspaceId === subspaceId);
    if (sub) return sub.evidence;
  }
  return null;
}

// ============================================================================
// Retention Policy
// ============================================================================

export interface RetentionPolicyResult {
  deleted: number;
  kept: number;
}

/**
 * Apply retention policy to snapshots
 * 
 * Rules:
 * - Keep last 30 daily snapshots
 * - Keep 4 weekly snapshots (Sundays from days 31-60)
 * - Keep 12 monthly snapshots (1st of month for months 3-13)
 * - Delete everything older than 13 months
 */
export async function applyRetentionPolicy(
  supabase: ReturnType<typeof import('@/lib/db/supabase-server').createClient> extends Promise<infer T> ? T : never,
  userId: string
): Promise<RetentionPolicyResult> {
  const now = new Date();

  // Fetch all snapshots for user
  const { data: allSnapshots, error } = await supabase
    .from('snapshots')
    .select('id, timestamp, snapshot_type')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false });

  if (error) throw error;
  if (!allSnapshots || allSnapshots.length === 0) {
    return { deleted: 0, kept: 0 };
  }

  const toDelete: string[] = [];
  const toKeep = new Set<string>();

  // Rule 1: Keep last 30 daily snapshots
  const dailySnapshots = allSnapshots
    .filter(s => s.snapshot_type === 'daily')
    .slice(0, 30);
  dailySnapshots.forEach(s => toKeep.add(s.id));

  // Rule 2: Keep 4 weekly snapshots (days 31-60, Sundays only)
  const weeklyWindow = allSnapshots.filter(s => {
    const age = (now.getTime() - new Date(s.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    return age > 30 && age <= 60;
  });

  const sundays = weeklyWindow.filter(s => new Date(s.timestamp).getDay() === 0);
  sundays.slice(0, 4).forEach(s => toKeep.add(s.id));

  // Rule 3: Keep 12 monthly snapshots (1st of month, months 3-13)
  const monthlyWindow = allSnapshots.filter(s => {
    const age = (now.getTime() - new Date(s.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    return age > 60 && age <= 390; // ~13 months
  });

  const firstOfMonth = monthlyWindow.filter(s => new Date(s.timestamp).getDate() === 1);
  firstOfMonth.slice(0, 12).forEach(s => toKeep.add(s.id));

  // Rule 4: Delete everything older than 13 months
  const thirteenMonthsAgo = new Date(now);
  thirteenMonthsAgo.setMonth(now.getMonth() - 13);

  allSnapshots.forEach(s => {
    const snapshotDate = new Date(s.timestamp);
    if (snapshotDate < thirteenMonthsAgo || !toKeep.has(s.id)) {
      toDelete.push(s.id);
    }
  });

  // Execute deletions
  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('snapshots')
      .delete()
      .in('id', toDelete);

    if (deleteError) throw deleteError;
  }

  return {
    deleted: toDelete.length,
    kept: toKeep.size,
  };
}
