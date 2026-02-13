/**
 * Misir Core Types
 * 
 * Shared type definitions used across frontend, backend, and extension.
 */

// ============================================================================
// State Vector & Space
// ============================================================================

export type StateVector = [number, number, number, number]; // [s0, s1, s2, s3]

// Subspace from database (structural component of Space)
export interface Subspace {
  id: string;
  spaceId: string;
  userId: string;
  name: string;
  markers: string[]; // JSONB array of marker strings (temporary, will be separate table)
  displayOrder: number;
  evidence?: number; // Calculated from artifacts assigned to this subspace
  embedding?: number[]; // Bootstrap embedding (name+markers) for new subspaces (P3.3)
  centroidEmbedding?: number[]; // Centroid from artifact embeddings for mature subspaces (P1)
  centroidArtifactCount?: number; // Number of artifacts used to compute centroid
  createdAt: Date;
  updatedAt: Date;
}

// AI-generated subspace with markers (used during space creation)
export interface SubspaceWithMarkers {
  name: string;
  markers: string[];
}

// Space from database (dumb container)
export interface Space {
  id: string;
  userId: string;
  name: string;
  intention?: string; // Why you're exploring this topic (constrains valid subspaces)
  embedding?: number[]; // Nomic Embed v1.5 (768-dim) of name + intention
  // State vector and evidence are NOT stored here
  // State vectors come from snapshots
  // Evidence comes from space_states
  lastUpdatedAt: Date;
  createdAt: Date;
  // For display purposes, we may join with subspaces and current state
  subspaces?: Subspace[];
  stateVector?: StateVector; // Derived from snapshots for display
  evidence?: number; // Derived from space_states for display

  // Velocity tracking (for Live Pulse momentum detection)
  // Updated incrementally on each artifact save
  rolling7DayEvidence?: number;      // Sum of evidence from last 7 days
  rolling7DayPrevious?: number;      // Previous 7-day sum (for comparison)
  lastActivityAt?: string;           // ISO timestamp of last artifact
}

// ============================================================================
// Artifact
// ============================================================================

export type ArtifactType = 'view' | 'save' | 'highlight' | 'annotate';

export interface Artifact {
  id: string;
  spaceId: string;
  subspaceId?: string; // 🔴 SACRED: nullable for ambiguous/pre-classification states
  userId: string;

  // Content
  url: string;
  title: string;
  extractedText?: string;

  // Evidence calculation
  type: ArtifactType;
  base_weight: number;   // w_j - event strength (0.2, 1.0, or 2.0)
  relevance: number;     // r_j - [0,1] confidence

  // Decay metadata
  decayMultiplier: number; // Type-specific decay rate

  // Reading depth metrics (P3.1)
  dwellTimeMs?: number;     // Time spent on page in milliseconds
  scrollDepth?: number;     // [0-1] max scroll depth
  readingDepth?: number;    // [0-1.5] computed depth multiplier

  // Session tracking (P3.2)
  sessionId?: string;       // Browsing session this artifact belongs to

  timestamp: Date;
}

// ============================================================================
// Evidence & State
// ============================================================================

export interface SpaceState {
  spaceId: string;
  evidence: number;
  lastDecayAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Snapshot (Frontend Contract)
// ============================================================================

export interface SpaceSnapshot {
  spaceId: string;
  name: string;
  stateVector: StateVector;
  dominantState: 0 | 1 | 2 | 3;
  driftScore: number;
  evidence: number;
}

export interface Snapshot {
  id: string;
  userId: string;
  timestamp: Date;
  spaces: SpaceSnapshot[];
}

// ============================================================================
// Note: Mathematical constants moved to @/lib/math
// Import directly: import { STATE_THRESHOLDS, DECAY_RATES } from '@/lib/math';
// ============================================================================

// ============================================================================
// Utility Types
// ============================================================================

export type StateIndex = 0 | 1 | 2 | 3;

export interface StateTransition {
  from: StateIndex;
  to: StateIndex;
  mass: number;
  reason: 'threshold_up' | 'threshold_down' | 'decay';
  timestamp: Date;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface CreateSpaceRequest {
  name: string;
  intention?: string; // Purpose/goal for exploring this topic
}

export interface CreateArtifactRequest {
  spaceId: string;
  url: string;
  title: string;
  extractedText?: string;
  type: ArtifactType;
  relevance?: number; // defaults to 1.0
}

export interface SnapshotResponse {
  snapshot: Snapshot;
}
// ============================================================================
// Read Path Types (Insight Generation)
// ============================================================================

export type SnapshotType = 'daily' | 'weekly' | 'monthly';

export interface SubspaceSnapshot {
  subspaceId: string;
  name: string;
  evidence: number;
  state: StateIndex;
}

export interface SpaceSnapshotData {
  spaceId: string;
  name: string;
  massVector: StateVector;
  totalEvidence: number;
  subspaces: SubspaceSnapshot[];
}

export interface SnapshotData {
  spaces: SpaceSnapshotData[];
}

export interface PersistedSnapshot {
  id: string;
  userId: string;
  snapshotType: SnapshotType;
  timestamp: Date;
  data: SnapshotData;
}

export interface Baseline {
  userId: string;
  computedAt: Date;
  windowDays: number;
  spaces: {
    spaceId: string;
    avgMassVector: StateVector;
    avgEvidence: number;
    avgArtifactsPerDay: number;
  }[];
}

export type DeltaType =
  | 'imbalance'       // Attention too concentrated
  | 'gap'             // Neglected subspaces
  | 'drift'           // Direction changing
  | 'false_stability' // Saturated but stale
  | 'silent_growth'   // Grew via ambient only
  | 'acceleration'    // Rapid evidence gain
  | 'deceleration'    // Slowing down
  | 'return'          // Came back to dormant topic
  | 'milestone'       // First saturation, new space, etc.
  | 'rabbit_hole'     // High-velocity exploration (flow state)
  | 'consumption_trap'; // High input / Low output (passive consumption)

export type Severity = 'low' | 'medium' | 'high';

export interface Delta {
  type: DeltaType;
  spaceId: string;
  spaceName?: string;
  subspaceId?: string;
  subspaceName?: string;
  severity: Severity;
  currentValue: number;
  baselineValue: number;
  changePercent: number;
  metadata?: Record<string, unknown>;
}

export interface Insight {
  id: string;
  userId: string;
  createdAt: Date;
  type: DeltaType;
  severity: Severity;
  headline: string;
  explanation: string;
  suggestion?: string;
  delta: Delta;

  // Persistence fields (P4 Active Coach)
  status?: 'dismissed' | 'kept' | 'crystallized' | null;
  actedAt?: Date | null;
}

export type InsightAction = 'dismiss' | 'keep' | 'crystallize';

// ============================================================================
// Engine Constants (re-exported from lib/math above)
// ============================================================================
// NOTE: FALSE_STABILITY_CONFIG and BASELINE_CONFIG are now exported from lib/math