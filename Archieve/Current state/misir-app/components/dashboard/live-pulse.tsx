'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Sparkles, Eye, Zap, Activity, ChevronRight, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Space } from '@/lib/types';

// ============================================================================
// Types
// ============================================================================

export interface LivePulse {
  sentence: string;
  type: 'neutral' | 'observation' | 'milestone' | 'warning';
  urgency: 'low' | 'medium' | 'high';
  
  // What triggered this insight (for "Deep Dive")
  triggerData?: {
    type: 'concentration' | 'dormancy' | 'milestone' | 'balance' | 'distribution' | 'velocity';
    massVector?: [number, number, number, number];
    spaceName?: string;
    lastActivityDays?: number;
    saturatedCount?: number;
    velocityType?: 'accelerating' | 'stalling';
    velocityChangePercent?: number;
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Aggregate mass vectors across all spaces into global distribution
 */
function aggregateGlobalMass(spaces: Space[]): [number, number, number, number] {
  const global: [number, number, number, number] = [0, 0, 0, 0];
  
  for (const space of spaces) {
    if (space.stateVector) {
      for (let i = 0; i < 4; i++) {
        global[i] += space.stateVector[i];
      }
    }
  }
  
  return global;
}

/**
 * Get days since last artifact activity for a space
 * Uses lastActivityAt if available, otherwise estimates from state
 */
function getDaysSinceLastArtifact(space: Space): number {
  // If we have lastActivityAt metadata, use it
  const spaceWithMeta = space as Space & { lastActivityAt?: string };
  if (spaceWithMeta.lastActivityAt) {
    const lastActivity = new Date(spaceWithMeta.lastActivityAt);
    const now = new Date();
    const diffMs = now.getTime() - lastActivity.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }
  
  // Fallback: estimate from state vector
  // If all in latent, likely dormant
  const total = space.stateVector?.reduce((a, b) => a + b, 0) || 0;
  if (total === 0) return 999; // No activity ever
  
  const latentRatio = (space.stateVector?.[0] || 0) / total;
  if (latentRatio > 0.9) return 14; // Mostly latent = likely dormant
  
  return 0; // Has recent activity
}

/**
 * Calculate velocity (momentum) for a space
 * Returns: 'accelerating' | 'stalling' | 'stable' | null
 * 
 * Uses rolling 7-day evidence sums stored on space object
 * No history fetch needed — instant computation
 */
function getSpaceVelocity(space: Space): {
  type: 'accelerating' | 'stalling' | 'stable';
  changePercent: number;
} | null {
  const current = space.rolling7DayEvidence;
  const previous = space.rolling7DayPrevious;
  
  // Need both values for comparison
  if (current === undefined || previous === undefined) return null;
  if (previous === 0) return null; // Can't calculate percentage change from 0
  
  const changePercent = ((current - previous) / previous) * 100;
  
  // Thresholds: >30% change is significant
  if (changePercent > 30) {
    return { type: 'accelerating', changePercent };
  }
  if (changePercent < -30) {
    return { type: 'stalling', changePercent };
  }
  
  return { type: 'stable', changePercent };
}

/**
 * Find the space with most significant velocity change
 */
function findMostSignificantVelocity(spaces: Space[]): {
  space: Space;
  velocity: { type: 'accelerating' | 'stalling'; changePercent: number };
} | null {
  let maxChange = 0;
  let result: { space: Space; velocity: { type: 'accelerating' | 'stalling'; changePercent: number } } | null = null;
  
  for (const space of spaces) {
    const velocity = getSpaceVelocity(space);
    if (velocity && velocity.type !== 'stable') {
      const absChange = Math.abs(velocity.changePercent);
      if (absChange > maxChange) {
        maxChange = absChange;
        result = { 
          space, 
          velocity: velocity as { type: 'accelerating' | 'stalling'; changePercent: number }
        };
      }
    }
  }
  
  return result;
}

// ============================================================================
// Core Pulse Computation
// ============================================================================

/**
 * Compute the live pulse from current state
 * 
 * CRITICAL: This is 100% synchronous, no async, no AI, no snapshots
 * Must render in <50ms from store data
 */
export function computeLivePulse(spaces: Space[]): LivePulse {
  // Empty state
  if (spaces.length === 0) {
    return {
      sentence: "No spaces yet. Create your first learning space to begin.",
      type: 'neutral',
      urgency: 'low',
    };
  }

  const totalSubspaces = spaces.reduce(
    (sum, s) => sum + (s.subspaces?.length || 0), 
    0
  );
  const globalMass = aggregateGlobalMass(spaces);
  const total = globalMass.reduce((a, b) => a + b, 0);

  // No activity yet
  if (total === 0) {
    return {
      sentence: "No activity recorded yet. Browse something to begin.",
      type: 'neutral',
      urgency: 'low',
    };
  }

  // === PRIORITY 1: Milestones (rare, celebrate) ===
  
  // First saturation ever
  const saturatedCount = globalMass[3];
  if (saturatedCount === 1) {
    const saturatedSpace = spaces.find(s => (s.stateVector?.[3] || 0) > 0);
    if (saturatedSpace) {
      return {
        sentence: `First saturation reached in "${saturatedSpace.name}".`,
        type: 'milestone',
        urgency: 'low',
        triggerData: {
          type: 'milestone',
          spaceName: saturatedSpace.name,
          saturatedCount: 1,
        },
      };
    }
  }

  // === PRIORITY 2: Warnings (attention needed) ===

  // Severe imbalance (>85% in one slot)
  const maxSlot = Math.max(...globalMass);
  const concentration = maxSlot / total;
  if (concentration > 0.85) {
    const slotNames = ['Latent', 'Discovered', 'Engaged', 'Saturated'];
    const slotIndex = globalMass.indexOf(maxSlot);
    return {
      sentence: `${Math.round(concentration * 100)}% of attention concentrated in ${slotNames[slotIndex]} areas.`,
      type: 'warning',
      urgency: 'high',
      triggerData: {
        type: 'concentration',
        massVector: globalMass,
      },
    };
  }

  // Long dormancy (>14 days)
  const longDormant = spaces.filter(s => getDaysSinceLastArtifact(s) > 14);
  if (longDormant.length > 0) {
    const longest = longDormant.reduce((max, s) => 
      getDaysSinceLastArtifact(s) > getDaysSinceLastArtifact(max) ? s : max
    );
    const days = getDaysSinceLastArtifact(longest);
    return {
      sentence: `"${longest.name}" hasn't seen activity in ${days} days.`,
      type: 'warning',
      urgency: 'high',
      triggerData: {
        type: 'dormancy',
        spaceName: longest.name,
        lastActivityDays: days,
      },
    };
  }

  // === PRIORITY 2.5: Velocity (momentum creates urgency) ===
  
  const significantVelocity = findMostSignificantVelocity(spaces);
  if (significantVelocity) {
    const { space, velocity } = significantVelocity;
    const absChange = Math.abs(velocity.changePercent);
    
    if (velocity.type === 'accelerating') {
      return {
        sentence: `Gathering speed in "${space.name}" — +${Math.round(absChange)}% this week.`,
        type: 'observation',
        urgency: absChange > 50 ? 'medium' : 'low',
        triggerData: {
          type: 'velocity',
          spaceName: space.name,
          velocityType: 'accelerating',
          velocityChangePercent: velocity.changePercent,
        },
      };
    } else {
      return {
        sentence: `Momentum slowing in "${space.name}" — ${Math.round(absChange)}% less activity.`,
        type: 'observation',
        urgency: absChange > 50 ? 'medium' : 'low',
        triggerData: {
          type: 'velocity',
          spaceName: space.name,
          velocityType: 'stalling',
          velocityChangePercent: velocity.changePercent,
        },
      };
    }
  }

  // === PRIORITY 3: Observations (interesting) ===

  // Moderate imbalance (>70% in one slot)
  if (concentration > 0.7) {
    const slotNames = ['Latent', 'Discovered', 'Engaged', 'Saturated'];
    const slotIndex = globalMass.indexOf(maxSlot);
    return {
      sentence: `${Math.round(concentration * 100)}% of attention in ${slotNames[slotIndex]} areas.`,
      type: 'observation',
      urgency: 'medium',
      triggerData: {
        type: 'concentration',
        massVector: globalMass,
      },
    };
  }

  // Short dormancy (>7 days)
  const shortDormant = spaces.filter(s => {
    const days = getDaysSinceLastArtifact(s);
    return days > 7 && days <= 14;
  });
  if (shortDormant.length > 0) {
    const longest = shortDormant.reduce((max, s) => 
      getDaysSinceLastArtifact(s) > getDaysSinceLastArtifact(max) ? s : max
    );
    const days = getDaysSinceLastArtifact(longest);
    return {
      sentence: `"${longest.name}" quiet for ${days} days.`,
      type: 'observation',
      urgency: 'medium',
      triggerData: {
        type: 'dormancy',
        spaceName: longest.name,
        lastActivityDays: days,
      },
    };
  }

  // Multiple saturations (good milestone)
  if (saturatedCount > 1) {
    return {
      sentence: `${saturatedCount} topics reached saturation.`,
      type: 'milestone',
      urgency: 'low',
      triggerData: {
        type: 'milestone',
        saturatedCount,
      },
    };
  }

  // === PRIORITY 4: Neutral (default states) ===

  // Good balance
  const minSlot = Math.min(...globalMass.filter(v => v > 0));
  const balance = minSlot / maxSlot;
  if (balance > 0.4 && spaces.length > 1) {
    return {
      sentence: `Attention balanced across ${spaces.length} spaces.`,
      type: 'neutral',
      urgency: 'low',
      triggerData: {
        type: 'balance',
        massVector: globalMass,
      },
    };
  }

  // Describe distribution
  const exploring = globalMass[0] + globalMass[1];
  const total2 = exploring + globalMass[2] + globalMass[3];
  const exploringPct = Math.round((exploring / total2) * 100);
  const deepeningPct = 100 - exploringPct;

  if (exploringPct > 60) {
    return {
      sentence: `${exploringPct}% in exploration mode, ${deepeningPct}% deepening.`,
      type: 'neutral',
      urgency: 'low',
      triggerData: {
        type: 'distribution',
        massVector: globalMass,
      },
    };
  }

  if (deepeningPct > 60) {
    return {
      sentence: `${deepeningPct}% in deepening mode, ${exploringPct}% exploring.`,
      type: 'neutral',
      urgency: 'low',
      triggerData: {
        type: 'distribution',
        massVector: globalMass,
      },
    };
  }

  // Default
  return {
    sentence: `${totalSubspaces} topics across ${spaces.length} spaces.`,
    type: 'neutral',
    urgency: 'low',
  };
}

// ============================================================================
// Component
// ============================================================================

/**
 * Visual cue for pulse type — instant recognition
 */
function PulseIcon({ type }: { type: LivePulse['type'] }) {
  switch (type) {
    case 'milestone':
      return <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />;
    case 'observation':
      return <Eye className="h-4 w-4 text-blue-500 shrink-0" />;
    case 'warning':
      return <Zap className="h-4 w-4 text-orange-500 shrink-0" />;
    default:
      return <Activity className="h-4 w-4 text-zinc-400 shrink-0" />;
  }
}

interface LivePulseDisplayProps {
  spaces: Space[];
  className?: string;
  showDetails?: boolean;
}

/**
 * Live Pulse Display Component
 * 
 * Shows the single most important insight about current attention state.
 * Renders instantly from Zustand store data — no async, no AI.
 * 
 * Place at TOP of dashboard for maximum visibility.
 */
export function LivePulseDisplay({ spaces, className, showDetails = true }: LivePulseDisplayProps) {
  const pulse = useMemo(() => computeLivePulse(spaces), [spaces]);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={className}>
      <div 
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-lg border-l-4 transition-colors",
          pulse.urgency === 'high' && "border-l-orange-500 bg-orange-50/50 dark:bg-orange-950/20",
          pulse.urgency === 'medium' && "border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20",
          pulse.urgency === 'low' && "border-l-zinc-300 bg-zinc-50/50 dark:bg-zinc-800/20",
        )}
      >
        {/* Icon — instant visual recognition */}
        <PulseIcon type={pulse.type} />
        
        {/* Sentence — the insight */}
        <span className={cn(
          "flex-1 text-sm font-medium",
          pulse.urgency === 'high' && "text-orange-900 dark:text-orange-100",
          pulse.urgency === 'medium' && "text-blue-900 dark:text-blue-100",
          pulse.urgency === 'low' && "text-zinc-700 dark:text-zinc-300",
        )}>
          {pulse.sentence}
        </span>
        
        {/* Deep Dive — expand to see triggering data */}
        {showDetails && pulse.triggerData && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-muted-foreground hover:text-foreground h-6 px-2"
          >
            Details
            {expanded 
              ? <ChevronDown className="h-3 w-3 ml-1" />
              : <ChevronRight className="h-3 w-3 ml-1" />
            }
          </Button>
        )}
      </div>
      
      {/* Expandable detail panel */}
      {expanded && pulse.triggerData && (
        <PulseDetail triggerData={pulse.triggerData} />
      )}
    </div>
  );
}

/**
 * Shows the specific data point that triggered this insight
 */
function PulseDetail({ triggerData }: { triggerData: NonNullable<LivePulse['triggerData']> }) {
  return (
    <div className="mt-1 px-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-b-lg text-xs text-muted-foreground">
      <span className="font-medium">Triggered by: </span>
      {triggerData.type === 'concentration' && triggerData.massVector && (
        <span>Mass vector [{triggerData.massVector.join(', ')}]</span>
      )}
      {triggerData.type === 'dormancy' && (
        <span>&ldquo;{triggerData.spaceName}&rdquo; — {triggerData.lastActivityDays} days since last activity</span>
      )}
      {triggerData.type === 'milestone' && (
        <span>
          {triggerData.spaceName 
            ? `First saturation in "${triggerData.spaceName}"` 
            : `${triggerData.saturatedCount} topics saturated`}
        </span>
      )}
      {triggerData.type === 'balance' && triggerData.massVector && (
        <span>Balanced distribution [{triggerData.massVector.join(', ')}]</span>
      )}
      {triggerData.type === 'distribution' && triggerData.massVector && (
        <span>Distribution [{triggerData.massVector.join(', ')}]</span>
      )}
      {triggerData.type === 'velocity' && (
        <span>
          &ldquo;{triggerData.spaceName}&rdquo; — 7-day evidence {triggerData.velocityType === 'accelerating' ? 'increased' : 'decreased'} by {Math.abs(triggerData.velocityChangePercent || 0).toFixed(0)}%
        </span>
      )}
    </div>
  );
}

/**
 * Hook version for custom rendering
 */
export function useLivePulse(spaces: Space[]): LivePulse {
  return useMemo(() => computeLivePulse(spaces), [spaces]);
}
