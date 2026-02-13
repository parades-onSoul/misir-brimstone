/**
 * Delta Detection
 * 
 * Compares current state to baseline, identifies meaningful changes.
 * Implements JTD-P2: Delta Detection & False Stability Detection
 */

import {
  Delta,
  SnapshotData,
  SpaceSnapshotData,
  Baseline,
} from '@/lib/types';
import { FALSE_STABILITY_CONFIG } from '@/lib/math';
import { getSnapshots, findSubspaceEvidence } from './snapshots';
import { PersistedBaseline } from './baseline-orchestrator';

// Type adapter for working with both legacy Baseline and new PersistedBaseline
type BaselineSpaceInfo = {
  spaceId: string;
  avgMassVector: [number, number, number, number];
  avgEvidence: number;
  name?: string;
};

/**
 * Extract space info from either legacy Baseline or new PersistedBaseline
 */
function getSpaceFromBaseline(
  baseline: Baseline | PersistedBaseline,
  spaceId: string
): BaselineSpaceInfo | undefined {
  // Check if it's a PersistedBaseline (has 'data' property)
  if ('data' in baseline && baseline.data?.spaces) {
    const space = baseline.data.spaces.find(s => s.spaceId === spaceId);
    if (space) {
      return {
        spaceId: space.spaceId,
        avgMassVector: space.avgMassVector,
        avgEvidence: space.avgEvidence,
        name: space.name,
      };
    }
    return undefined;
  }
  // Legacy Baseline format
  const space = (baseline as Baseline).spaces?.find(s => s.spaceId === spaceId);
  if (space) {
    return {
      spaceId: space.spaceId,
      avgMassVector: space.avgMassVector,
      avgEvidence: space.avgEvidence,
    };
  }
  return undefined;
}

/**
 * Detect all deltas between current state and baseline
 * 
 * Supports both legacy Baseline and new PersistedBaseline formats.
 */
export function detectDeltas(
  current: SnapshotData,
  baseline: Baseline | PersistedBaseline
): Delta[] {
  const deltas: Delta[] = [];

  for (const space of current.spaces) {
    const baselineSpace = getSpaceFromBaseline(baseline, space.spaceId);
    if (!baselineSpace) continue;

    // 1. Mass Vector Drift
    const driftDelta = detectDrift(space, baselineSpace);
    if (driftDelta) deltas.push(driftDelta);

    // 2. Per-subspace analysis
    for (const sub of space.subspaces) {
      // Imbalance detection
      const imbalanceDelta = detectImbalance(space, sub);
      if (imbalanceDelta) deltas.push(imbalanceDelta);

      // False stability candidates (will be enriched later)
      if (sub.state === 3) {
        deltas.push({
          type: 'false_stability',
          spaceId: space.spaceId,
          spaceName: space.name,
          subspaceId: sub.subspaceId,
          subspaceName: sub.name,
          severity: 'low', // Will be upgraded if confirmed stale
          currentValue: sub.evidence,
          baselineValue: sub.evidence,
          changePercent: 0,
        });
      }
    }

    // 3. Gap detection (more subspaces became latent)
    const gapDelta = detectGap(space, baselineSpace);
    if (gapDelta) deltas.push(gapDelta);
  }

  return deltas;
}

/**
 * Detect drift in mass vector
 */
function detectDrift(
  space: SpaceSnapshotData,
  baselineSpace: BaselineSpaceInfo
): Delta | null {
  const massDelta = space.massVector.map(
    (m, i) => m - baselineSpace.avgMassVector[i]
  );
  const totalShift = massDelta.reduce((sum, d) => sum + Math.abs(d), 0);

  if (totalShift <= 2) return null;

  // Interpret the drift direction
  let direction = 'changing';
  if (massDelta[3] > 0 && massDelta[0] > 0) {
    direction = 'deepening but narrowing';
  } else if (massDelta[3] > 0) {
    direction = 'deepening';
  } else if (massDelta[0] > 0) {
    direction = 'becoming dormant';
  } else if (massDelta[1] > 0 || massDelta[2] > 0) {
    direction = 'actively exploring';
  }

  return {
    type: 'drift',
    spaceId: space.spaceId,
    spaceName: space.name,
    severity: totalShift > 4 ? 'high' : 'medium',
    currentValue: totalShift,
    baselineValue: 0,
    changePercent: totalShift * 100,
    metadata: { massDelta, direction },
  };
}

/**
 * Detect attention imbalance (>40% in one subspace)
 */
function detectImbalance(
  space: SpaceSnapshotData,
  subspace: SpaceSnapshotData['subspaces'][0]
): Delta | null {
  if (space.totalEvidence === 0) return null;

  const share = subspace.evidence / space.totalEvidence;

  // Only flag if significant concentration AND engaged/saturated
  if (share <= 0.4 || subspace.state < 2) return null;

  return {
    type: 'imbalance',
    spaceId: space.spaceId,
    spaceName: space.name,
    subspaceId: subspace.subspaceId,
    subspaceName: subspace.name,
    severity: share > 0.6 ? 'high' : 'medium',
    currentValue: Math.round(share * 100),
    baselineValue: 25, // Expected even distribution
    changePercent: Math.round((share - 0.25) * 100),
  };
}

/**
 * Detect gap (subspaces reverting to latent)
 */
function detectGap(
  space: SpaceSnapshotData,
  baselineSpace: BaselineSpaceInfo
): Delta | null {
  const latentCount = space.massVector[0];
  const baselineLatent = baselineSpace.avgMassVector[0];

  if (latentCount <= baselineLatent + 1) return null;
  if (baselineLatent === 0) return null; // Avoid division by zero

  const increase = latentCount - baselineLatent;

  return {
    type: 'gap',
    spaceId: space.spaceId,
    spaceName: space.name,
    severity: increase > 2 ? 'high' : 'medium',
    currentValue: latentCount,
    baselineValue: Math.round(baselineLatent),
    changePercent: Math.round((increase / baselineLatent) * 100),
  };
}

/**
 * Detect false stability for a specific subspace
 * Returns true if saturated but stale
 */
export async function detectFalseStability(
  supabase: ReturnType<typeof import('@/lib/db/supabase-server').createClient> extends Promise<infer T> ? T : never,
  userId: string,
  subspaceId: string
): Promise<boolean> {
  // Get recent snapshots
  const snapshots = await getSnapshots(
    supabase,
    userId,
    FALSE_STABILITY_CONFIG.windowDays,
    'daily'
  );

  if (snapshots.length < 2) return false;

  // Check evidence delta over window
  const recentEvidence = findSubspaceEvidence(snapshots[0], subspaceId);
  const olderEvidence = findSubspaceEvidence(
    snapshots[snapshots.length - 1],
    subspaceId
  );

  if (recentEvidence === null || olderEvidence === null) return false;

  const evidenceDelta = Math.abs(recentEvidence - olderEvidence);
  if (evidenceDelta >= FALSE_STABILITY_CONFIG.epsilon) return false;

  // Check artifact count
  const since = new Date(
    Date.now() - FALSE_STABILITY_CONFIG.windowDays * 24 * 60 * 60 * 1000
  );

  const { data: artifacts, error } = await supabase
    .from('artifacts')
    .select('id')
    .eq('subspace_id', subspaceId)
    .gte('created_at', since.toISOString());

  if (error) {
    console.error('[Delta] Error checking artifacts:', error);
    return false;
  }

  return (artifacts?.length ?? 0) < FALSE_STABILITY_CONFIG.minArtifacts;
}

/**
 * Detect silent growth (reached engaged state via ambient only)
 */
export async function detectSilentGrowth(
  supabase: ReturnType<typeof import('@/lib/db/supabase-server').createClient> extends Promise<infer T> ? T : never,
  subspaceId: string,
  state: number
): Promise<boolean> {
  if (state < 2) return false; // Only check engaged or saturated

  // Check if any non-ambient artifacts exist
  const { data: intentionalArtifacts, error } = await supabase
    .from('artifacts')
    .select('id')
    .eq('subspace_id', subspaceId)
    .in('artifact_type', ['engaged', 'committed'])
    .limit(1);

  if (error) {
    console.error('[Delta] Error checking silent growth:', error);
    return false;
  }

  return (intentionalArtifacts?.length ?? 0) === 0;
}

/**
 * Enrich deltas with additional checks (false stability, silent growth)
 */
export async function enrichDeltas(
  supabase: ReturnType<typeof import('@/lib/db/supabase-server').createClient> extends Promise<infer T> ? T : never,
  userId: string,
  deltas: Delta[]
): Promise<Delta[]> {
  const enriched: Delta[] = [];

  for (const delta of deltas) {
    if (delta.type === 'false_stability' && delta.subspaceId) {
      const isStale = await detectFalseStability(supabase, userId, delta.subspaceId);

      if (isStale) {
        // Confirmed stale - upgrade severity
        enriched.push({ ...delta, severity: 'medium' });
      } else {
        // Check for silent growth instead
        // Get current state from the delta (it was 3/saturated to be flagged)
        const isSilent = await detectSilentGrowth(supabase, delta.subspaceId, 3);

        if (isSilent) {
          enriched.push({
            ...delta,
            type: 'silent_growth',
            severity: 'low',
          });
        }
        // Otherwise, drop this delta (neither stale nor silent)
      }
    } else {
      enriched.push(delta);
    }
  }

  return enriched;
}

// ============================================================================
// Velocity-Based Detection (Rabbit Hole / Flow State)
// ============================================================================

/**
 * Detect "rabbit hole" - high-velocity exploration within a subspace
 * 
 * Trigger: >5 unique URLs within a single subspace in <1 hour
 * This captures flow states - high-value moments users want to recognize.
 */
export async function detectRabbitHole(
  supabase: ReturnType<typeof import('@/lib/db/supabase-server').createClient> extends Promise<infer T> ? T : never,
  userId: string
): Promise<Delta[]> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // Fetch recent artifacts grouped by subspace
  const { data: artifacts, error } = await supabase
    .from('artifacts')
    .select(`
      id,
      url,
      subspace_id,
      space_id,
      created_at,
      subspaces!inner(name),
      spaces!inner(name)
    `)
    .eq('user_id', userId)
    .gte('created_at', oneHourAgo.toISOString())
    .order('created_at', { ascending: false });

  if (error || !artifacts) {
    console.error('[Delta] Error detecting rabbit hole:', error);
    return [];
  }

  // Group by subspace
  const bySubspace = new Map<string, {
    subspaceId: string;
    subspaceName: string;
    spaceId: string;
    spaceName: string;
    urls: Set<string>;
    firstArtifact: Date;
    lastArtifact: Date;
  }>();

  for (const artifact of artifacts) {
    if (!artifact.subspace_id) continue;

    if (!bySubspace.has(artifact.subspace_id)) {
      // Handle both array and object formats from Supabase joins
      const subspaceData = Array.isArray(artifact.subspaces)
        ? artifact.subspaces[0]
        : artifact.subspaces;
      const spaceData = Array.isArray(artifact.spaces)
        ? artifact.spaces[0]
        : artifact.spaces;

      bySubspace.set(artifact.subspace_id, {
        subspaceId: artifact.subspace_id,
        subspaceName: (subspaceData as { name: string } | null)?.name || 'Unknown',
        spaceId: artifact.space_id,
        spaceName: (spaceData as { name: string } | null)?.name || 'Unknown',
        urls: new Set(),
        firstArtifact: new Date(artifact.created_at),
        lastArtifact: new Date(artifact.created_at),
      });
    }

    const entry = bySubspace.get(artifact.subspace_id)!;
    entry.urls.add(artifact.url);
    const artifactTime = new Date(artifact.created_at);
    if (artifactTime < entry.firstArtifact) entry.firstArtifact = artifactTime;
    if (artifactTime > entry.lastArtifact) entry.lastArtifact = artifactTime;
  }

  // Find rabbit holes (>= 5 unique URLs)
  const rabbitHoles: Delta[] = [];

  for (const entry of bySubspace.values()) {
    if (entry.urls.size >= 5) {
      const durationMinutes = Math.round(
        (entry.lastArtifact.getTime() - entry.firstArtifact.getTime()) / 60000
      );

      rabbitHoles.push({
        type: 'rabbit_hole',
        spaceId: entry.spaceId,
        spaceName: entry.spaceName,
        subspaceId: entry.subspaceId,
        subspaceName: entry.subspaceName,
        severity: 'low', // Positive signal, not a warning
        currentValue: entry.urls.size,
        baselineValue: 0,
        changePercent: 0,
        metadata: {
          durationMinutes,
          urlCount: entry.urls.size,
          context: `Flow state: ${entry.urls.size} artifacts in ${durationMinutes} minutes`,
        },
      });
    }
  }

  return rabbitHoles;
}

/**
 * Detect "consumption trap" - High Input / Low Output
 * 
 * Trigger: >10k words read in a subspace over 7 days with 0 committed artifacts.
 * Insight: "You've consumed a lot but produced nothing."
 */
export async function detectConsumptionTrap(
  supabase: ReturnType<typeof import('@/lib/db/supabase-server').createClient> extends Promise<infer T> ? T : never,
  userId: string
): Promise<Delta[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // 1. Get recent artifacts with word counts
  const { data: artifacts, error } = await supabase
    .from('artifacts')
    .select('subspace_id, space_id, word_count, artifact_type, subspaces!inner(name), spaces!inner(name)')
    .eq('user_id', userId)
    .gte('created_at', sevenDaysAgo.toISOString());

  if (error || !artifacts) return [];

  // 2. Aggregate per subspace
  const stats = new Map<string, {
    wordCount: number;
    committedCount: number;
    subspaceName: string;
    spaceId: string;
    spaceName: string;
  }>();

  for (const art of artifacts) {
    if (!art.subspace_id) continue;

    if (!stats.has(art.subspace_id)) {
      stats.set(art.subspace_id, {
        wordCount: 0,
        committedCount: 0,
        subspaceName: (art.subspaces as any)?.name || 'Unknown',
        spaceId: art.space_id,
        spaceName: (art.spaces as any)?.name || 'Unknown',
      });
    }

    const entry = stats.get(art.subspace_id)!;
    entry.wordCount += art.word_count || 0;
    if (art.artifact_type === 'committed') {
      entry.committedCount++;
    }
  }

  // 3. Check thresholds
  const traps: Delta[] = [];
  const WORD_COUNT_THRESHOLD = 10000;

  for (const [subspaceId, entry] of stats.entries()) {
    if (entry.wordCount > WORD_COUNT_THRESHOLD && entry.committedCount === 0) {
      traps.push({
        type: 'consumption_trap',
        spaceId: entry.spaceId,
        spaceName: entry.spaceName,
        subspaceId,
        subspaceName: entry.subspaceName,
        severity: 'medium',
        currentValue: entry.wordCount,
        baselineValue: 0,
        changePercent: 0,
        metadata: {
          wordCount: entry.wordCount,
          committedCount: 0,
          context: `High input: ${Math.round(entry.wordCount / 1000)}k words read, 0 notes taken`,
        },
      });
    }
  }

  return traps;
}

// ============================================================================
// Evidence Velocity Detection (Acceleration / Deceleration)
// ============================================================================

/**
 * Detect acceleration/deceleration by comparing evidence change rates
 */
export function detectVelocityChange(
  current: SnapshotData,
  baseline: Baseline | PersistedBaseline
): Delta[] {
  const deltas: Delta[] = [];

  for (const space of current.spaces) {
    const baselineSpace = getSpaceFromBaseline(baseline, space.spaceId);
    if (!baselineSpace) continue;

    const evidenceDelta = space.totalEvidence - baselineSpace.avgEvidence;
    const changePercent = baselineSpace.avgEvidence > 0
      ? (evidenceDelta / baselineSpace.avgEvidence) * 100
      : 0;

    // Acceleration: >50% evidence increase
    if (changePercent > 50) {
      deltas.push({
        type: 'acceleration',
        spaceId: space.spaceId,
        spaceName: space.name,
        severity: changePercent > 100 ? 'high' : 'medium',
        currentValue: Math.round(space.totalEvidence),
        baselineValue: Math.round(baselineSpace.avgEvidence),
        changePercent: Math.round(changePercent),
        metadata: { direction: 'accelerating' },
      });
    }

    // Deceleration: >30% evidence decrease
    if (changePercent < -30) {
      deltas.push({
        type: 'deceleration',
        spaceId: space.spaceId,
        spaceName: space.name,
        severity: changePercent < -50 ? 'high' : 'medium',
        currentValue: Math.round(space.totalEvidence),
        baselineValue: Math.round(baselineSpace.avgEvidence),
        changePercent: Math.round(changePercent),
        metadata: { direction: 'decelerating' },
      });
    }
  }

  return deltas;
}

// ============================================================================
// Comprehensive Delta Detection
// ============================================================================

/**
 * Detect all deltas including velocity-based detection
 */
export async function detectAllDeltas(
  supabase: ReturnType<typeof import('@/lib/db/supabase-server').createClient> extends Promise<infer T> ? T : never,
  userId: string,
  current: SnapshotData,
  baseline: Baseline | PersistedBaseline
): Promise<Delta[]> {
  // Basic deltas
  const basicDeltas = detectDeltas(current, baseline);

  // Velocity-based deltas
  const velocityDeltas = detectVelocityChange(current, baseline);

  // Rabbit hole detection
  const rabbitHoles = await detectRabbitHole(supabase, userId);

  // Combine all deltas
  const allDeltas = [...basicDeltas, ...velocityDeltas, ...rabbitHoles];

  // Enrich with false stability and silent growth checks
  const enrichedDeltas = await enrichDeltas(supabase, userId, allDeltas);

  return enrichedDeltas;
}