/**
 * Report Sub-Components
 * 
 * Shared components for the Report page.
 */

import type { EngagementLevel } from "@/types/api";

const engagementColors: Record<EngagementLevel, string> = {
    latent: 'bg-neutral-500/20 text-neutral-400',
    discovered: 'bg-blue-500/20 text-blue-400',
    engaged: 'bg-green-500/20 text-green-400',
    saturated: 'bg-purple-500/20 text-purple-400',
};

function StateDot({ state }: { state: 0 | 1 | 2 | 3 }) {
    const levels: EngagementLevel[] = ['latent', 'discovered', 'engaged', 'saturated'];
    const level = levels[state];
    return <span className={`inline-block h-2 w-2 rounded-full ${engagementColors[level].split(' ')[0]}`} />;
}

// ─────────────────────────────────────────────────────────────────
// ReportSection
// ─────────────────────────────────────────────────────────────────

interface ReportSectionProps {
    number: number;
    title: string;
    children: React.ReactNode;
}

export function ReportSection({ number, title, children }: ReportSectionProps) {
    return (
        <section className="py-6 sm:py-8">
            <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-6">
                <span className="shrink-0 w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full bg-foreground/5 text-foreground text-xs sm:text-sm font-medium">
                    {number}
                </span>
                <h2 className="text-base sm:text-lg font-medium text-foreground">{title}</h2>
            </div>
            <div className="pl-9 sm:pl-11 text-sm sm:text-base text-muted-foreground space-y-4">
                {children}
            </div>
        </section>
    );
}

// ─────────────────────────────────────────────────────────────────
// SubSection
// ─────────────────────────────────────────────────────────────────

interface SubSectionProps {
    title: string;
    children: React.ReactNode;
}

export function SubSection({ title, children }: SubSectionProps) {
    return (
        <div className="mt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 font-medium">{title}</p>
            <div className="text-sm sm:text-base text-foreground">{children}</div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────
// SubspaceList
// ─────────────────────────────────────────────────────────────────

interface SubspaceItem {
    name: string;
    state: number;
}

interface SubspaceListProps {
    items: SubspaceItem[];
}

export function SubspaceList({ items }: SubspaceListProps) {
    if (!items || items.length === 0) {
        return <p className="text-sm text-muted-foreground italic">None</p>;
    }

    return (
        <ul className="space-y-1.5">
            {items.map((item, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm">
                    <StateDot state={item.state as 0 | 1 | 2 | 3} />
                    <span className="text-foreground">{item.name}</span>
                </li>
            ))}
        </ul>
    );
}

// ─────────────────────────────────────────────────────────────────
// GapCard
// ─────────────────────────────────────────────────────────────────

interface GapCardProps {
    gap: {
        name: string;
        state: number;
        evidence: number;
    };
}

export function GapCard({ gap }: GapCardProps) {
    const stateLabels: Record<number, string> = {
        0: 'Latent',
        1: 'Discovered',
        2: 'Engaged',
        3: 'Saturated',
    };

    return (
        <div className="mt-4 p-4 sm:p-6 rounded-lg bg-muted/10 border border-muted-foreground/10">
            <div className="flex items-center gap-2 mb-3">
                <StateDot state={gap.state as 0 | 1 | 2 | 3} />
                <h4 className="font-medium text-foreground text-sm sm:text-base">{gap.name}</h4>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                    <span className="text-muted-foreground">Current state: </span>
                    <span className="text-foreground">{stateLabels[gap.state] || 'Unknown'}</span>
                </div>
                <div>
                    <span className="text-muted-foreground">Evidence: </span>
                    <span className="text-foreground">{gap.evidence.toFixed(1)}</span>
                </div>
            </div>
            <p className="text-sm text-muted-foreground">
                This area shows activity but may benefit from more intentional engagement.
            </p>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────
// ReportHeader
// ─────────────────────────────────────────────────────────────────

interface ReportHeaderProps {
    timeWindow: string;
    scopeLabel: string;
    confidence: string;
}

export function ReportHeader({ timeWindow, scopeLabel, confidence }: ReportHeaderProps) {
    return (
        <header className="mb-8 sm:mb-12">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4 sm:mb-6">
                Attention & Knowledge Health Report
            </h1>
            <dl className="text-sm sm:text-base text-muted-foreground space-y-2">
                <div className="flex flex-col sm:flex-row sm:gap-3">
                    <dt className="text-foreground font-medium sm:w-32">Time Window</dt>
                    <dd>{timeWindow}</dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:gap-3">
                    <dt className="text-foreground font-medium sm:w-32">Scope</dt>
                    <dd>{scopeLabel}</dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:gap-3">
                    <dt className="text-foreground font-medium sm:w-32">Confidence</dt>
                    <dd>{confidence}</dd>
                </div>
            </dl>
        </header>
    );
}

// ─────────────────────────────────────────────────────────────────
// QuickInsight
// ─────────────────────────────────────────────────────────────────

interface QuickInsightProps {
    insight: string;
}

export function QuickInsight({ insight }: QuickInsightProps) {
    return (
        <section className="py-4 px-4 sm:py-6 sm:px-6 rounded-lg bg-muted/20 border-l-2 border-foreground/10">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2 sm:mb-3">
                Quick Insight
            </p>
            <p className="text-base sm:text-lg text-foreground leading-relaxed">
                {insight}
            </p>
        </section>
    );
}

// ─────────────────────────────────────────────────────────────────
// SuggestedAction
// ─────────────────────────────────────────────────────────────────

interface SuggestedActionProps {
    action: string;
}

export function SuggestedAction({ action }: SuggestedActionProps) {
    return (
        <div className="mt-6 py-4 px-5 rounded-lg bg-muted/15 border-l-2 border-muted-foreground/20">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 font-medium">
                Suggested action
            </p>
            <p className="text-base text-foreground">{action}</p>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────
// ReportSkeleton
// ─────────────────────────────────────────────────────────────────

export function ReportSkeleton() {
    return (
        <div className="max-w-3xl mx-auto px-8 py-12">
            <div className="h-10 w-96 bg-muted/50 rounded mb-4 animate-pulse" />
            <div className="h-4 w-64 bg-muted/50 rounded mb-2 animate-pulse" />
            <div className="h-4 w-48 bg-muted/50 rounded mb-8 animate-pulse" />
            <div className="h-24 w-full bg-muted/50 rounded mb-6 animate-pulse" />
            <div className="h-64 w-full bg-muted/50 rounded animate-pulse" />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────
// ReportEmptyState
// ─────────────────────────────────────────────────────────────────

export function ReportEmptyState() {
    return (
        <div className="text-center py-12 sm:py-20">
            <p className="text-base sm:text-lg text-muted-foreground mb-2">No data yet</p>
            <p className="text-xs sm:text-sm text-muted-foreground">
                Create a space and browse to start tracking your attention.
            </p>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────
// ReportError
// ─────────────────────────────────────────────────────────────────

interface ReportErrorProps {
    error: string;
}

export function ReportError({ error }: ReportErrorProps) {
    return (
        <div className="max-w-3xl mx-auto px-8 py-16">
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-6">
                <h3 className="font-semibold text-destructive mb-2">Error Loading Report</h3>
                <p className="text-sm text-muted-foreground">{error}</p>
            </div>
        </div>
    );
}
