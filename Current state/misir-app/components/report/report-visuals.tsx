'use client';

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

// Color palette matching the system architecture
export const VISUAL_COLORS = {
  latent: '#211951',     // Deep purple (untouched)
  discovered: '#836FFF', // Violet (exploring)
  engaged: '#15F5BA',    // Teal (active)
  saturated: '#F0F3FF',  // Near-white (mastered)
};

// State dot symbols
export const STATE_DOTS: Record<number, string> = {
  0: '◌', // Latent
  1: '○', // Discovered
  2: '◐', // Engaged
  3: '●', // Saturated
};

// Movement arrow symbols
export const MOVEMENT_ARROWS = {
  up: '↑',
  down: '↓',
  stable: '→',
  returned: '⟳',
};

// ────────────────────────────────────────────────────────────────
// 1. State Distribution Bar
// ────────────────────────────────────────────────────────────────
interface StateDistributionBarProps {
  massVector: [number, number, number, number]; // [latent, discovered, engaged, saturated]
  showLabels?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function StateDistributionBar({
  massVector,
  showLabels = false,
  size = 'md',
  className
}: StateDistributionBarProps) {
  const [latent, discovered, engaged, saturated] = massVector;
  const total = latent + discovered + engaged + saturated || 1;

  const heights = { sm: 'h-1.5', md: 'h-2', lg: 'h-3' };

  const percentages = {
    latent: Math.round((latent / total) * 100),
    discovered: Math.round((discovered / total) * 100),
    engaged: Math.round((engaged / total) * 100),
    saturated: Math.round((saturated / total) * 100),
  };

  return (
    <div className={className}>
      <div className={cn("flex rounded-full overflow-hidden bg-(--color-bg-tertiary)", heights[size])}>
        {saturated > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentages.saturated}%` }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
            style={{ backgroundColor: VISUAL_COLORS.saturated }}
          />
        )}
        {engaged > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentages.engaged}%` }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
            style={{ backgroundColor: VISUAL_COLORS.engaged }}
          />
        )}
        {discovered > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentages.discovered}%` }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
            style={{ backgroundColor: VISUAL_COLORS.discovered }}
          />
        )}
        {latent > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentages.latent}%` }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
            style={{ backgroundColor: VISUAL_COLORS.latent }}
          />
        )}
      </div>
      {showLabels && (
        <div className="flex justify-between mt-1.5 text-xs text-(--color-text-quaternary)">
          <span>● {percentages.saturated}%</span>
          <span>◐ {percentages.engaged}%</span>
          <span>○ {percentages.discovered}%</span>
          <span>◌ {percentages.latent}%</span>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 2. Concentration Indicator
// ────────────────────────────────────────────────────────────────
interface ConcentrationIndicatorProps {
  percentage: number;
  label?: string;
  color?: string;
  className?: string;
}

export function ConcentrationIndicator({
  percentage,
  label,
  color = VISUAL_COLORS.discovered,
  className
}: ConcentrationIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex h-1.5 w-24 rounded-full overflow-hidden bg-(--color-bg-tertiary)">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{ backgroundColor: color }}
        />
      </div>
      <span className="text-xs text-(--color-text-quaternary)">
        {percentage}%{label ? ` ${label}` : ''}
      </span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 3. Activity Sparkline
// ────────────────────────────────────────────────────────────────
interface ActivitySparklineProps {
  data: number[]; // Array of values (typically 7 days)
  color?: string;
  height?: number;
  className?: string;
}

export function ActivitySparkline({
  data,
  color = VISUAL_COLORS.discovered,
  height = 16,
  className
}: ActivitySparklineProps) {
  const max = Math.max(...data, 1);

  return (
    <div className={cn("flex items-end gap-px", className)} style={{ height }}>
      {data.map((value, i) => (
        <motion.div
          key={i}
          className="w-1 rounded-t"
          initial={{ height: 0 }}
          animate={{ height: `${Math.max((value / max) * 100, value > 0 ? 10 : 0)}%` }}
          transition={{ duration: 0.5, delay: i * 0.05 }}
          style={{
            backgroundColor: color,
          }}
        />
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// 4. State Dot
// ────────────────────────────────────────────────────────────────
interface StateDotProps {
  state: 0 | 1 | 2 | 3;
  withLabel?: boolean;
  className?: string;
}

export function StateDot({ state, withLabel = false, className }: StateDotProps) {
  const labels = ['Latent', 'Discovered', 'Engaged', 'Saturated'];
  const colors = [
    VISUAL_COLORS.latent,
    VISUAL_COLORS.discovered,
    VISUAL_COLORS.engaged,
    VISUAL_COLORS.saturated,
  ];

  return (
    <motion.span
      className={cn("inline-flex items-center gap-1", className)}
      style={{ color: colors[state] }}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <span>{STATE_DOTS[state]}</span>
      {withLabel && <span className="text-xs text-muted-foreground">{labels[state]}</span>}
    </motion.span>
  );
}

// ────────────────────────────────────────────────────────────────
// 5. Movement Arrow
// ────────────────────────────────────────────────────────────────
interface MovementArrowProps {
  direction: 'up' | 'down' | 'stable' | 'returned';
  withLabel?: boolean;
  className?: string;
}

export function MovementArrow({ direction, withLabel = false, className }: MovementArrowProps) {
  const labels = {
    up: 'moved up',
    down: 'decayed',
    stable: 'stable',
    returned: 'returned',
  };

  const colors = {
    up: VISUAL_COLORS.engaged,
    down: VISUAL_COLORS.latent,
    stable: 'var(--color-text-tertiary)',
    returned: VISUAL_COLORS.discovered,
  };

  return (
    <span className={cn("inline-flex items-center gap-1", className)} style={{ color: colors[direction] }}>
      <span>{MOVEMENT_ARROWS[direction]}</span>
      {withLabel && <span className="text-xs">{labels[direction]}</span>}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────
// 6. Dormancy Indicator
// ────────────────────────────────────────────────────────────────
interface DormancyIndicatorProps {
  days?: number;
  className?: string;
}

export function DormancyIndicator({ days, className }: DormancyIndicatorProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-(--color-text-quaternary)", className)}>
      <span>◌◌◌</span>
      {days && <span className="text-xs">No activity for {days}+ days</span>}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────
// 7. Period Badge
// ────────────────────────────────────────────────────────────────
type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface PeriodBadgeProps {
  period: Period;
  className?: string;
}

export function PeriodBadge({ period, className }: PeriodBadgeProps) {
  return (
    <span className={cn(
      "text-xs px-2 py-0.5 rounded bg-(--color-bg-tertiary) text-muted-foreground capitalize",
      className
    )}>
      {period}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────
// Composite: Subspace Item with State
// ────────────────────────────────────────────────────────────────
interface SubspaceItemProps {
  name: string;
  state: 0 | 1 | 2 | 3;
  evidence?: number;
  sparkline?: number[];
  movement?: 'up' | 'down' | 'stable' | 'returned';
  className?: string;
}

export function SubspaceItem({ name, state, evidence, sparkline, movement, className }: SubspaceItemProps) {
  return (
    <motion.div
      className={cn("flex items-center gap-2", className)}
      initial={{ opacity: 0, x: -5 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <StateDot state={state} />
      <span className="text-sm text-foreground flex-1 truncate">{name}</span>
      {movement && <MovementArrow direction={movement} />}
      {sparkline && <ActivitySparkline data={sparkline} height={12} className="w-16 hidden sm:block" />}
      {evidence !== undefined && (
        <span className="text-xs text-muted-foreground w-12 text-right">E={evidence.toFixed(0)}</span>
      )}
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────
// Composite: Space Summary Card
// ────────────────────────────────────────────────────────────────
interface SpaceSummaryProps {
  name: string;
  dominantState: number;
  subspaceCount: number;
  massVector: [number, number, number, number];
  sparkline?: number[];
  className?: string;
  onClick?: () => void;
}

export function SpaceSummary({ name, dominantState, subspaceCount, massVector, sparkline, className, onClick }: SpaceSummaryProps) {
  return (
    <motion.div
      className={cn(
        "p-4 rounded-lg border border-border/40 bg-card hover:bg-muted/40 transition-colors cursor-pointer",
        className
      )}
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <StateDot state={dominantState as any} />
          <span className="font-medium text-base text-foreground">{name}</span>
        </div>
        <span className="text-xs text-muted-foreground">{subspaceCount} topics</span>
      </div>

      <div className="flex items-end gap-4">
        <div className="flex-1">
          <StateDistributionBar massVector={massVector} size="sm" />
        </div>
        {sparkline && (
          <div className="w-16 h-8">
            <ActivitySparkline data={sparkline} height={32} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
