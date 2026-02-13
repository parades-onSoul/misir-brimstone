/**
 * Report System Types
 * 
 * Reports exist on two dimensions:
 * - Scope: 'global' (all spaces) | 'space' (single space)
 * - Period: 'daily' | 'weekly' | 'monthly' | 'yearly'
 */

export type ReportScope = 'global' | 'space';
export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

// ─────────────────────────────────────────────────────────────────
// Base Types
// ─────────────────────────────────────────────────────────────────

export type MassVector = [number, number, number, number];
export type State = 0 | 1 | 2 | 3;
export type Movement = 'up' | 'down' | 'stable' | 'returned';

export interface ActivityTrend {
  data: number[];  // 7 values for sparkline
  direction: Movement;
}

// ─────────────────────────────────────────────────────────────────
// Insight Types (shared across all reports)
// ─────────────────────────────────────────────────────────────────

export type InsightType = 
  | 'imbalance'       // Attention too concentrated
  | 'gap'             // Neglected subspaces
  | 'drift'           // Direction changing
  | 'false_stability' // Saturated but stale
  | 'silent_growth'   // Grew via ambient only
  | 'acceleration'    // Rapid evidence gain
  | 'deceleration'    // Slowing down
  | 'return'          // Came back to dormant topic
  | 'milestone'       // First saturation, new space, etc.
  | 'rabbit_hole';    // High-velocity exploration (flow state)

export type InsightSeverity = 'low' | 'medium' | 'high';

export interface Insight {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  headline: string;
  explanation: string;
  relatedSpaceId?: string;
  relatedSubspaceId?: string;
}

// ─────────────────────────────────────────────────────────────────
// Delta Types
// ─────────────────────────────────────────────────────────────────

export interface GlobalDelta {
  massVectorChange: MassVector;  // current - baseline
  activeSpacesChange: number;
  dominantStateShift: State | null;
}

export interface SpaceDelta {
  massVectorChange: MassVector;
  evidenceChange: number;
  subspaceMovements: {
    subspaceId: string;
    from: State;
    to: State;
  }[];
}

// ─────────────────────────────────────────────────────────────────
// Summary Types (for lists within reports)
// ─────────────────────────────────────────────────────────────────

export interface SpaceSummary {
  id: string;
  name: string;
  massVector: MassVector;
  dominantState: State;
  activityTrend: ActivityTrend;
  movement: Movement;
  subspaceCount: number;
}

export interface SubspaceSummary {
  id: string;
  name: string;
  state: State;
  evidence: number;
  activityTrend: ActivityTrend;
  movement: Movement;
  dormantDays?: number;
}

// ─────────────────────────────────────────────────────────────────
// Global Report (All Spaces)
// ─────────────────────────────────────────────────────────────────

export interface GlobalReport {
  scope: 'global';
  period: ReportPeriod;
  generatedAt: Date;
  
  // Aggregated metrics
  totalMassVector: MassVector;
  totalSubspaces: number;
  totalSpaces: number;
  
  // Allocation percentages
  allocation: {
    latent: number;
    discovered: number;
    engaged: number;
    saturated: number;
  };
  
  // Derived metrics
  deepeningPercent: number;  // engaged + saturated
  explorationPercent: number;  // latent + discovered
  dominantState: State;
  imbalanceDetected: boolean;
  
  // Per-space breakdown
  spaces: SpaceSummary[];
  
  // Insights
  insights: Insight[];
  
  // Comparison to baseline
  delta: GlobalDelta | null;
  
  // Learning posture (for monthly/yearly)
  learningPosture?: {
    mode: string;
    risk: string;
    opportunity: string;
  };
}

// ─────────────────────────────────────────────────────────────────
// Space Report (Single Space)
// ─────────────────────────────────────────────────────────────────

export interface SpaceReport {
  scope: 'space';
  spaceId: string;
  spaceName: string;
  period: ReportPeriod;
  generatedAt: Date;
  
  // Space-level metrics
  massVector: MassVector;
  totalEvidence: number;
  subspaceCount: number;
  
  // Allocation percentages
  allocation: {
    latent: number;
    discovered: number;
    engaged: number;
    saturated: number;
  };
  
  // Derived metrics
  deepeningPercent: number;
  explorationPercent: number;
  dominantState: State;
  imbalanceDetected: boolean;
  
  // Per-subspace breakdown
  subspaces: SubspaceSummary[];
  
  // Categorized subspaces
  highActivity: SubspaceSummary[];
  lowActivity: SubspaceSummary[];
  dormant: SubspaceSummary[];
  stabilized: SubspaceSummary[];
  knowledgeGaps: SubspaceSummary[];
  
  // Insights
  insights: Insight[];
  
  // Comparison to baseline
  delta: SpaceDelta | null;
  
  // Learning posture (for monthly/yearly)
  learningPosture?: {
    mode: string;
    risk: string;
    opportunity: string;
  };
}

// ─────────────────────────────────────────────────────────────────
// Union type for any report
// ─────────────────────────────────────────────────────────────────

export type Report = GlobalReport | SpaceReport;

// ─────────────────────────────────────────────────────────────────
// Report Generation Request
// ─────────────────────────────────────────────────────────────────

export interface ReportRequest {
  scope: ReportScope;
  period: ReportPeriod;
  spaceId?: string;  // Required when scope is 'space'
  date?: Date;  // Defaults to now
}

// ─────────────────────────────────────────────────────────────────
// Period Configuration
// ─────────────────────────────────────────────────────────────────

export const PERIOD_CONFIG: Record<ReportPeriod, {
  label: string;
  snapshotsNeeded: number;
  baselineWindow: number;
  description: string;
}> = {
  daily: {
    label: 'Daily',
    snapshotsNeeded: 1,
    baselineWindow: 7,
    description: 'Quick pulse on today\'s activity',
  },
  weekly: {
    label: 'Weekly',
    snapshotsNeeded: 7,
    baselineWindow: 30,
    description: 'Patterns emerging over the week',
  },
  monthly: {
    label: 'Monthly',
    snapshotsNeeded: 30,
    baselineWindow: 90,
    description: 'Full analysis of the month',
  },
  yearly: {
    label: 'Yearly',
    snapshotsNeeded: 365,
    baselineWindow: 365,
    description: 'Comprehensive year reflection',
  },
};

// ─────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────

export function isGlobalReport(report: Report): report is GlobalReport {
  return report.scope === 'global';
}

export function isSpaceReport(report: Report): report is SpaceReport {
  return report.scope === 'space';
}

export function getStateLabel(state: State): string {
  return ['Latent', 'Discovered', 'Engaged', 'Saturated'][state];
}

export function getMovementLabel(movement: Movement): string {
  return {
    up: 'moved up',
    down: 'decayed',
    stable: 'stable',
    returned: 'returned',
  }[movement];
}
