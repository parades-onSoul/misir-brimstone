/**
 * Report Generator
 * 
 * Generates GlobalReport or SpaceReport based on request parameters.
 * Currently uses live data from stores; will integrate snapshots when available.
 */

import type {
  Report,
  GlobalReport,
  SpaceReport,
  ReportRequest,
  ReportPeriod,
  MassVector,
  State,
  Movement,
  SpaceSummary,
  SubspaceSummary,
  Insight,
  ActivityTrend,
} from '@/lib/types/reports';

// ─────────────────────────────────────────────────────────────────
// Types for input data (from store)
// ─────────────────────────────────────────────────────────────────

interface StoreSpace {
  id: string;
  name: string;
  subspaces?: StoreSubspace[];
}

interface StoreSubspace {
  id: string;
  name: string;
  evidence?: number;
}

// ─────────────────────────────────────────────────────────────────
// State Calculation
// ─────────────────────────────────────────────────────────────────

const THETA_1 = 1;  // Latent → Discovered
const THETA_2 = 3;  // Discovered → Engaged
const THETA_3 = 6;  // Engaged → Saturated

function calculateState(evidence: number): State {
  if (evidence >= THETA_3) return 3;
  if (evidence >= THETA_2) return 2;
  if (evidence >= THETA_1) return 1;
  return 0;
}

function calculateMassVector(subspaces: { evidence: number }[]): MassVector {
  const mass: MassVector = [0, 0, 0, 0];
  for (const sub of subspaces) {
    const state = calculateState(sub.evidence || 0);
    mass[state]++;
  }
  return mass;
}

function calculateAllocation(massVector: MassVector): {
  latent: number;
  discovered: number;
  engaged: number;
  saturated: number;
} {
  const total = massVector.reduce((a, b) => a + b, 0) || 1;
  return {
    latent: Math.round((massVector[0] / total) * 100),
    discovered: Math.round((massVector[1] / total) * 100),
    engaged: Math.round((massVector[2] / total) * 100),
    saturated: Math.round((massVector[3] / total) * 100),
  };
}

function getDominantState(massVector: MassVector): State {
  let maxIndex = 0;
  let maxValue = massVector[0];
  for (let i = 1; i < 4; i++) {
    if (massVector[i] > maxValue) {
      maxValue = massVector[i];
      maxIndex = i;
    }
  }
  return maxIndex as State;
}

// ─────────────────────────────────────────────────────────────────
// Mock Activity Trend (until snapshots are wired)
// ─────────────────────────────────────────────────────────────────

function generateMockTrend(state: State): ActivityTrend {
  // Generate a plausible trend based on current state
  const baseLevel = state * 2;
  const data = Array.from({ length: 7 }, () => 
    Math.max(0, baseLevel + Math.floor(Math.random() * 3) - 1)
  );
  
  const first = data.slice(0, 3).reduce((a, b) => a + b, 0);
  const last = data.slice(-3).reduce((a, b) => a + b, 0);
  
  let direction: Movement = 'stable';
  if (last > first * 1.2) direction = 'up';
  else if (last < first * 0.8) direction = 'down';
  
  return { data, direction };
}

// ─────────────────────────────────────────────────────────────────
// Insight Generation
// ─────────────────────────────────────────────────────────────────

function generateInsights(
  allocation: { latent: number; discovered: number; engaged: number; saturated: number },
  subspaces: SubspaceSummary[],
  period: ReportPeriod
): Insight[] {
  const insights: Insight[] = [];
  const deepening = allocation.engaged + allocation.saturated;
  const exploration = allocation.latent + allocation.discovered;
  
  // Imbalance detection
  if (deepening > 70) {
    insights.push({
      id: `imbalance-${Date.now()}`,
      type: 'imbalance',
      severity: deepening > 80 ? 'high' : 'medium',
      headline: `${deepening}% of attention in deepening areas`,
      explanation: `Most activity concentrated in Engaged and Saturated subspaces. Latent areas remain largely unexplored.`,
    });
  } else if (exploration > 80) {
    insights.push({
      id: `imbalance-exp-${Date.now()}`,
      type: 'imbalance',
      severity: 'medium',
      headline: `${exploration}% of attention in exploration`,
      explanation: `Broad exploration without deep engagement. Many areas touched at surface level.`,
    });
  }
  
  // Gap detection (dormant subspaces)
  const dormant = subspaces.filter(s => s.dormantDays && s.dormantDays >= 14);
  if (dormant.length > 0) {
    insights.push({
      id: `gap-${Date.now()}`,
      type: 'gap',
      severity: dormant.length > 3 ? 'high' : 'low',
      headline: `${dormant.length} topic${dormant.length > 1 ? 's' : ''} with no activity for 14+ days`,
      explanation: `Some previously active subspaces have gone quiet.`,
    });
  }
  
  // False stability (saturated but no recent activity)
  const falseStable = subspaces.filter(s => s.state === 3 && s.dormantDays && s.dormantDays >= 10);
  if (falseStable.length > 0) {
    insights.push({
      id: `false-stability-${Date.now()}`,
      type: 'false_stability',
      severity: 'medium',
      headline: `${falseStable.length} saturated topic${falseStable.length > 1 ? 's' : ''} inactive 10+ days`,
      explanation: `These subspaces reached the highest state but have had no new artifacts recently.`,
    });
  }
  
  // Silent growth (reached higher state via ambient only)
  const silentGrowth = subspaces.filter(s => s.state >= 2 && s.movement === 'up');
  if (silentGrowth.length > 0 && period !== 'daily') {
    insights.push({
      id: `silent-growth-${Date.now()}`,
      type: 'silent_growth',
      severity: 'low',
      headline: `${silentGrowth.length} topic${silentGrowth.length > 1 ? 's' : ''} grew via ambient activity`,
      explanation: `State advanced through page visits alone. No saves or highlights recorded.`,
    });
  }
  
  return insights;
}

// ─────────────────────────────────────────────────────────────────
// Learning Posture (for monthly/yearly)
// ─────────────────────────────────────────────────────────────────

function calculateLearningPosture(allocation: {
  latent: number;
  discovered: number;
  engaged: number;
  saturated: number;
}): { mode: string; risk: string; opportunity: string } {
  const deepening = allocation.engaged + allocation.saturated;
  const exploration = allocation.latent + allocation.discovered;
  
  if (deepening > 60) {
    return {
      mode: 'Deepening & Consolidation',
      risk: 'Narrowing perspective',
      opportunity: 'Strategic re-expansion',
    };
  }
  
  if (exploration > 80) {
    return {
      mode: 'Broad Exploration',
      risk: 'Shallow understanding',
      opportunity: 'Select areas for deeper engagement',
    };
  }
  
  if (allocation.saturated > 30) {
    return {
      mode: 'Mastery Phase',
      risk: 'Stagnation without new challenges',
      opportunity: 'Use stable knowledge to support adjacent learning',
    };
  }
  
  return {
    mode: 'Balanced Learning',
    risk: 'None identified',
    opportunity: 'Maintain current rhythm',
  };
}

// ─────────────────────────────────────────────────────────────────
// Global Report Generator
// ─────────────────────────────────────────────────────────────────

export function generateGlobalReport(
  spaces: StoreSpace[],
  period: ReportPeriod
): GlobalReport {
  // Aggregate all subspaces
  const allSubspaces: SubspaceSummary[] = [];
  const spaceSummaries: SpaceSummary[] = [];
  
  for (const space of spaces) {
    const subs = (space.subspaces || []).map(sub => {
      const evidence = sub.evidence || 0;
      const state = calculateState(evidence);
      const trend = generateMockTrend(state);
      
      return {
        id: sub.id,
        name: sub.name,
        state,
        evidence,
        activityTrend: trend,
        movement: trend.direction,
        dormantDays: state === 0 ? 14 : undefined, // Mock dormancy
      } as SubspaceSummary;
    });
    
    allSubspaces.push(...subs);
    
    // Space summary
    const spaceMass = calculateMassVector(subs.map(s => ({ evidence: s.evidence })));
    const spaceTrend = generateMockTrend(getDominantState(spaceMass));
    
    spaceSummaries.push({
      id: space.id,
      name: space.name,
      massVector: spaceMass,
      dominantState: getDominantState(spaceMass),
      activityTrend: spaceTrend,
      movement: spaceTrend.direction,
      subspaceCount: subs.length,
    });
  }
  
  // Global aggregation
  const totalMassVector = calculateMassVector(allSubspaces.map(s => ({ evidence: s.evidence })));
  const allocation = calculateAllocation(totalMassVector);
  const deepeningPercent = allocation.engaged + allocation.saturated;
  const explorationPercent = allocation.latent + allocation.discovered;
  
  const insights = generateInsights(allocation, allSubspaces, period);
  
  const report: GlobalReport = {
    scope: 'global',
    period,
    generatedAt: new Date(),
    
    totalMassVector,
    totalSubspaces: allSubspaces.length,
    totalSpaces: spaces.length,
    
    allocation,
    deepeningPercent,
    explorationPercent,
    dominantState: getDominantState(totalMassVector),
    imbalanceDetected: deepeningPercent > 60 || explorationPercent > 80,
    
    spaces: spaceSummaries.sort((a, b) => {
      // Sort by activity (engaged + saturated count)
      const aActivity = a.massVector[2] + a.massVector[3];
      const bActivity = b.massVector[2] + b.massVector[3];
      return bActivity - aActivity;
    }),
    
    insights,
    delta: null, // Will be populated when snapshots are wired
  };
  
  // Add learning posture for monthly/yearly
  if (period === 'monthly' || period === 'yearly') {
    report.learningPosture = calculateLearningPosture(allocation);
  }
  
  return report;
}

// ─────────────────────────────────────────────────────────────────
// Space Report Generator
// ─────────────────────────────────────────────────────────────────

export function generateSpaceReport(
  space: StoreSpace,
  period: ReportPeriod
): SpaceReport {
  const subs = (space.subspaces || []).map(sub => {
    const evidence = sub.evidence || 0;
    const state = calculateState(evidence);
    const trend = generateMockTrend(state);
    
    return {
      id: sub.id,
      name: sub.name,
      state,
      evidence,
      activityTrend: trend,
      movement: trend.direction,
      dormantDays: state === 0 ? 14 : (state === 1 ? 7 : undefined), // Mock dormancy
    } as SubspaceSummary;
  });
  
  const massVector = calculateMassVector(subs.map(s => ({ evidence: s.evidence })));
  const allocation = calculateAllocation(massVector);
  const deepeningPercent = allocation.engaged + allocation.saturated;
  const explorationPercent = allocation.latent + allocation.discovered;
  
  // Categorize subspaces
  const highActivity = subs.filter(s => s.state === 2 || s.state === 3).slice(0, 5);
  const lowActivity = subs.filter(s => s.state === 0).slice(0, 5);
  const dormant = subs.filter(s => s.dormantDays && s.dormantDays >= 14).slice(0, 5);
  const stabilized = subs.filter(s => s.state === 3 && s.movement === 'stable').slice(0, 5);
  const knowledgeGaps = subs.filter(s => s.state === 1 || (s.state === 2 && s.evidence < 4)).slice(0, 5);
  
  const insights = generateInsights(allocation, subs, period);
  
  const report: SpaceReport = {
    scope: 'space',
    spaceId: space.id,
    spaceName: space.name,
    period,
    generatedAt: new Date(),
    
    massVector,
    totalEvidence: subs.reduce((sum, s) => sum + s.evidence, 0),
    subspaceCount: subs.length,
    
    allocation,
    deepeningPercent,
    explorationPercent,
    dominantState: getDominantState(massVector),
    imbalanceDetected: deepeningPercent > 60 || explorationPercent > 80,
    
    subspaces: subs.sort((a, b) => b.evidence - a.evidence),
    
    highActivity,
    lowActivity,
    dormant,
    stabilized,
    knowledgeGaps,
    
    insights,
    delta: null, // Will be populated when snapshots are wired
  };
  
  // Add learning posture for monthly/yearly
  if (period === 'monthly' || period === 'yearly') {
    report.learningPosture = calculateLearningPosture(allocation);
  }
  
  return report;
}

// ─────────────────────────────────────────────────────────────────
// Main Generator Function
// ─────────────────────────────────────────────────────────────────

export function generateReport(
  request: ReportRequest,
  spaces: StoreSpace[]
): Report {
  if (request.scope === 'space') {
    const space = spaces.find(s => s.id === request.spaceId);
    if (!space) {
      throw new Error(`Space not found: ${request.spaceId}`);
    }
    return generateSpaceReport(space, request.period);
  }
  
  return generateGlobalReport(spaces, request.period);
}
