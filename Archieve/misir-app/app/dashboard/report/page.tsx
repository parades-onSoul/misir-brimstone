'use client';

import { useState } from 'react';
import { useReport, getConfidenceLevel, getOneLineInsight, getTimeWindow } from '@/lib/hooks/use-report';
import { isGlobalReport, isSpaceReport, type ReportPeriod, type GlobalReport, type SpaceReport } from '@/lib/types/reports';
import {
  ReportHeader,
  ReportSection,
  SubSection,
  SubspaceList,
  GapCard,
  QuickInsight,
  SuggestedAction,
  ReportSkeleton,
  ReportEmptyState,
  ReportError,
} from '@/components/report/report-sections';
import { StateDistributionBar } from '@/components/report/report-visuals';
import { AlertTriangle, FileText, Globe, PlayCircle, ArrowRight } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────
// Period Selector
// ─────────────────────────────────────────────────────────────────

const PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

function PeriodSelector({ value, onChange }: { value: ReportPeriod; onChange: (v: ReportPeriod) => void }) {
  return (
    <div className="flex gap-2 mb-8">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${value === p.value
            ? 'bg-foreground text-background'
            : 'bg-muted/20 text-muted-foreground hover:bg-muted/40'
            }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Report Page
// ─────────────────────────────────────────────────────────────────

export default function ReportPage() {
  const [period, setPeriod] = useState<ReportPeriod>('weekly');
  const [mockupMode, setMockupMode] = useState<'none' | 'slide1' | 'slide2'>('none');
  const { report, isLoading, isError, error } = useReport({ period });

  if (isLoading) {
    return <ReportSkeleton />;
  }

  if (isError) {
    return <ReportError error={error?.message || 'Failed to load report'} />;
  }

  if (!report) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <PeriodSelector value={period} onChange={setPeriod} />
        <ReportEmptyState />
      </div>
    );
  }

  const timeWindow = getTimeWindow(period);
  const confidence = getConfidenceLevel(report);
  const insight = getOneLineInsight(report);
  const scopeLabel = isGlobalReport(report)
    ? `All Spaces (${report.totalSpaces})`
    : report.spaceName;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
      <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
        <button
          onClick={() => setMockupMode((prev) => (prev === 'slide1' ? 'none' : 'slide1'))}
          className="px-3 py-1.5 text-xs rounded-md bg-muted/20 text-muted-foreground hover:bg-muted/40 transition-colors"
        >
          {mockupMode === 'slide1' ? 'Back to Live Report' : 'Fake Report'}
        </button>
        <button
          onClick={() => setMockupMode((prev) => (prev === 'slide2' ? 'none' : 'slide2'))}
          className="px-3 py-1.5 text-xs rounded-md bg-muted/20 text-muted-foreground hover:bg-muted/40 transition-colors"
        >
          {mockupMode === 'slide2' ? 'Back to Live Report' : 'Slide 2'}
        </button>
      </div>

      {mockupMode === 'slide1' ? (
        <FakeReportMockup />
      ) : mockupMode === 'slide2' ? (
        <ReportBoardMockup />
      ) : (
        <>
          <PeriodSelector value={period} onChange={setPeriod} />

          <ReportHeader
            timeWindow={timeWindow}
            scopeLabel={scopeLabel}
            confidence={confidence}
          />

          <QuickInsight insight={insight} />

          <div className="divide-y divide-muted-foreground/10">
            {/* Section 1: State Distribution */}
            <ReportSection number={1} title="Attention Distribution">
              <StateDistributionBar
                massVector={[
                  report.allocation.latent,
                  report.allocation.discovered,
                  report.allocation.engaged,
                  report.allocation.saturated,
                ]}
                showLabels
              />
              <p className="mt-4">
                {report.deepeningPercent > 50
                  ? `You're focusing on deepening existing knowledge (${report.deepeningPercent.toFixed(0)}% engaged or saturated).`
                  : `You're in exploration mode (${report.explorationPercent.toFixed(0)}% latent or discovered).`}
              </p>
            </ReportSection>

            {/* Section 2: Scope-specific content */}
            {isGlobalReport(report) && <GlobalReportContent report={report} />}
            {isSpaceReport(report) && <SpaceReportContent report={report} />}

            {/* Section 3: Insights */}
            {report.insights.length > 0 && (
              <ReportSection number={3} title="Insights">
                <ul className="space-y-3">
                  {report.insights.map((ins) => (
                    <li key={ins.id} className="p-3 rounded-lg bg-muted/10 border border-muted-foreground/10">
                      <p className="font-medium text-foreground text-sm">{ins.headline}</p>
                      <p className="text-xs text-muted-foreground mt-1">{ins.explanation}</p>
                    </li>
                  ))}
                </ul>
              </ReportSection>
            )}

            {/* Section 4: Learning Posture (monthly/yearly) */}
            {report.learningPosture && (
              <ReportSection number={4} title="Learning Posture">
                <SubSection title="Current Mode">
                  <p>{report.learningPosture.mode}</p>
                </SubSection>
                <SubSection title="Risk">
                  <p>{report.learningPosture.risk}</p>
                </SubSection>
                <SubSection title="Opportunity">
                  <p>{report.learningPosture.opportunity}</p>
                </SubSection>
              </ReportSection>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Fake Report Mockup
// ─────────────────────────────────────────────────────────────────

function FakeReportMockup() {
  return (
    <div className="rounded-2xl border border-muted-foreground/10 bg-[#121212] text-zinc-100 p-6 sm:p-8 space-y-6">
      {/* Header Area */}
      <div className="space-y-3">
        <div className="text-xs text-zinc-400">Home &gt; Spaces &gt; Series A Prep</div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 text-xs bg-zinc-900/80 border border-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Active Session
          </div>
          <div className="text-xs text-zinc-400">Time Invested: <span className="text-zinc-200">14h 20m</span> this week</div>
        </div>
      </div>

      {/* Mirror Insight Card */}
      <div className="rounded-xl border border-amber-500/20 bg-zinc-900/60 p-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-300">Attention Imbalance Detected</p>
            <p className="text-xs text-zinc-300 mt-1">
              You have reached high saturation (85%) on Market Sizing but have low coverage (&lt;10%) on Go-To-Market Strategy.
            </p>
            <button className="mt-3 inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-md bg-amber-500 text-zinc-900 hover:bg-amber-400 transition-colors">
              <span>Pivot Context</span>
              <ArrowRight className="h-3.5 w-3.5" />
              <span>Go-To-Market</span>
            </button>
          </div>
        </div>
      </div>

      {/* Knowledge Topography */}
      <div className="space-y-4">
        <div className="text-xs uppercase tracking-widest text-zinc-400">Knowledge Topography</div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-100">Market Sizing</span>
            <span className="text-xs text-emerald-400">Saturated</span>
          </div>
          <div className="h-3 w-full rounded-full bg-zinc-800 overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: '90%' }} />
          </div>
          <div className="text-xs text-zinc-400">24 Artifacts · 4h 15m Dwell Time</div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-100">Go-To-Market Strategy</span>
            <span className="text-xs text-red-400">Critical Gap</span>
          </div>
          <div className="h-3 w-full rounded-full border border-red-500/40 bg-transparent overflow-hidden">
            <div className="h-full bg-red-500/40" style={{ width: '10%' }} />
          </div>
          <div className="text-xs text-zinc-400">2 Artifacts · 12m Dwell Time</div>
        </div>
      </div>

      {/* Recent Artifacts */}
      <div className="space-y-3">
        <div className="text-xs uppercase tracking-widest text-zinc-400">Recent Artifacts</div>
        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
            <FileText className="h-4 w-4 text-zinc-300" />
            <div className="text-xs text-zinc-200">Gartner_GenAI_Market_Report.pdf <span className="text-zinc-500">(Local File)</span></div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
            <Globe className="h-4 w-4 text-zinc-300" />
            <div className="text-xs text-zinc-200">Sequoia Arc: Finding Product Market Fit <span className="text-zinc-500">(sequoiacap.com)</span></div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
            <PlayCircle className="h-4 w-4 text-zinc-300" />
            <div className="text-xs text-zinc-200">All-In Podcast: Valuation metrics <span className="text-zinc-500">(YouTube)</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Report Board Mockup (Slide 2)
// ─────────────────────────────────────────────────────────────────

function ReportBoardMockup() {
  return (
    <div className="rounded-2xl border border-muted-foreground/10 bg-[#121212] text-zinc-100 p-6 sm:p-8 space-y-6">
      {/* Insight Card */}
      <div className="rounded-xl border border-amber-500/20 bg-zinc-900/60 p-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-300">High Friction Detected</p>
            <p className="text-xs text-zinc-300 mt-1">
              You have revisited &apos;Competitor Pricing&apos; 12 times this week but have created 0 artifacts. You are stuck in a consumption loop.
            </p>
            <button className="mt-3 inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-md bg-amber-500 text-zinc-900 hover:bg-amber-400 transition-colors">
              <span>Switch to Creation Mode</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Attention Distribution */}
      <div className="space-y-3">
        <div className="text-xs uppercase tracking-widest text-zinc-400">Cognitive Load (Last 7 Days)</div>
        <div className="h-3 w-full rounded-full bg-zinc-800 overflow-hidden flex">
          <div className="h-full" style={{ width: '60%', backgroundColor: '#7C3AED' }} />
          <div className="h-full bg-zinc-500" style={{ width: '30%' }} />
          <div className="h-full bg-zinc-700" style={{ width: '10%' }} />
        </div>
        <div className="flex flex-wrap gap-3 text-[11px] text-zinc-400">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: '#7C3AED' }} />Fundraising 60%</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-zinc-500" />Hiring Pipeline 30%</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-zinc-700" />Uncategorized/Noise 10%</span>
        </div>
      </div>

      {/* Space Overview */}
      <div className="space-y-3">
        <div className="text-xs uppercase tracking-widest text-zinc-400">Active Spaces</div>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-zinc-200">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Series A Prep
            </div>
            <div className="text-[11px] text-zinc-400">142 Artifacts · High Velocity</div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-zinc-200">
              <span className="h-2 w-2 rounded-full bg-blue-400" />
              Q3 Product Roadmap
            </div>
            <div className="text-[11px] text-zinc-400">56 Artifacts · Stable</div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-zinc-200">
              <span className="h-2 w-2 rounded-full bg-zinc-500" />
              Legal &amp; Compliance
            </div>
            <div className="text-[11px] text-zinc-400">12 Artifacts · Stagnant</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Global Report Content
// ─────────────────────────────────────────────────────────────────

function GlobalReportContent({ report }: { report: GlobalReport }) {
  const activeSpaces = report.spaces.filter((s) => s.movement === 'up' || s.subspaceCount > 0);
  const dormantSpaces = report.spaces.filter((s) => s.movement === 'down');

  return (
    <ReportSection number={2} title="Space Overview">
      <p>
        You have <strong>{report.totalSpaces}</strong> spaces with{' '}
        <strong>{report.totalSubspaces}</strong> total subspaces.
      </p>

      {activeSpaces.length > 0 && (
        <SubSection title="Active Spaces">
          <SubspaceList
            items={activeSpaces.map((s) => ({ name: s.name, state: s.dominantState }))}
          />
        </SubSection>
      )}

      {dormantSpaces.length > 0 && (
        <SubSection title="Needs Attention">
          <SubspaceList
            items={dormantSpaces.map((s) => ({ name: s.name, state: s.dominantState }))}
          />
        </SubSection>
      )}

      {report.imbalanceDetected && (
        <SuggestedAction action="Consider diversifying attention across more spaces to avoid knowledge silos." />
      )}
    </ReportSection>
  );
}

// ─────────────────────────────────────────────────────────────────
// Space Report Content
// ─────────────────────────────────────────────────────────────────

function SpaceReportContent({ report }: { report: SpaceReport }) {
  return (
    <ReportSection number={2} title="Subspace Breakdown">
      <p>
        This space has <strong>{report.subspaceCount}</strong> subspaces with{' '}
        <strong>{report.totalEvidence.toFixed(1)}</strong> total evidence.
      </p>

      {report.highActivity.length > 0 && (
        <SubSection title="High Activity">
          <SubspaceList
            items={report.highActivity.map((s) => ({ name: s.name, state: s.state }))}
          />
        </SubSection>
      )}

      {report.stabilized.length > 0 && (
        <SubSection title="Stabilized">
          <SubspaceList
            items={report.stabilized.map((s) => ({ name: s.name, state: s.state }))}
          />
        </SubSection>
      )}

      {report.knowledgeGaps.length > 0 && (
        <>
          <SubSection title="Knowledge Gaps">
            <p className="text-sm text-muted-foreground mb-3">
              These areas show potential but need more engagement.
            </p>
          </SubSection>
          {report.knowledgeGaps.map((gap) => (
            <GapCard key={gap.id} gap={gap} />
          ))}
        </>
      )}

      {report.dormant.length > 0 && (
        <SubSection title="Dormant">
          <SubspaceList
            items={report.dormant.map((s) => ({ name: s.name, state: s.state }))}
          />
        </SubSection>
      )}

      {report.imbalanceDetected && (
        <SuggestedAction action="Your attention is concentrated on a few subspaces. Consider exploring related topics." />
      )}
    </ReportSection>
  );
}
