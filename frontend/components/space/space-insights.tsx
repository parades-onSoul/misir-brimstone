'use client';

import { useMemo } from 'react';
import {
  useSpaceConfidence,
  useSpaceVelocity,
  useSpaceDrift,
  useMarginDistribution,
} from '@/lib/api/analytics';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
  type TooltipProps,
} from 'recharts';

interface ClarityStats {
  weak: number;
  moderate: number;
  strong: number;
  total: number;
  weakPct: number;
  moderatePct: number;
  strongPct: number;
}

interface SpaceInsightsProps {
  spaceId: number;
  userId: string;
}

export function SpaceInsights({ spaceId, userId }: SpaceInsightsProps) {
  const { data: confidence, isLoading: loadingConfidence } = useSpaceConfidence(spaceId, userId);
  const { data: velocity, isLoading: loadingVelocity } = useSpaceVelocity(spaceId, userId);
  const { data: drift } = useSpaceDrift(spaceId, userId);
  const { data: margin, isLoading: loadingMargin } = useMarginDistribution(spaceId, userId);

  const focusSeries = useMemo(() => buildDailyAverage(confidence, 'computed_at', 'confidence'), [confidence]);
  const paceSeries = useMemo(() => buildDailyAverage(velocity, 'measured_at', 'velocity'), [velocity]);
  const driftMarkers = useMemo(() =>
    (drift || [])
      .filter((event) => event.drift_magnitude > 0.25)
      .map((event) => ({
        date: event.occurred_at.slice(0, 10),
        label: event.subspace_name,
        magnitude: Number(event.drift_magnitude.toFixed(2)),
      })),
  [drift]);

  const claritySnapshot = useMemo<ClarityStats>(() => {
    if (!margin || margin.total === 0) {
      return { weak: 0, moderate: 0, strong: 0, total: 0, weakPct: 0, moderatePct: 0, strongPct: 0 };
    }
    const { weak = 0, moderate = 0, strong = 0 } = margin.distribution;
    return {
      weak,
      moderate,
      strong,
      total: margin.total,
      weakPct: Math.round((weak / margin.total) * 100),
      moderatePct: Math.round((moderate / margin.total) * 100),
      strongPct: Math.round((strong / margin.total) * 100),
    };
  }, [margin]);

  const marginBars = useMemo(() => buildMarginBars(claritySnapshot), [claritySnapshot]);

  const latestFocus = focusSeries.at(-1)?.value ?? 0;
  const currentPace = paceSeries.at(-1)?.value ?? 0;
  const averagePace = paceSeries.length
    ? paceSeries.reduce((sum, item) => sum + item.value, 0) / paceSeries.length
    : 0;

  const clarityMessage = claritySnapshot.total === 0
    ? 'No margin data yet.'
    : claritySnapshot.weakPct > 35
      ? 'You are exploring lots of new territory.'
      : claritySnapshot.strongPct > 60
        ? 'Most items reinforce existing topics.'
        : 'Healthy balance between depth and exploration.';

  const chartsLoading = loadingConfidence && loadingVelocity && loadingMargin;

  if (chartsLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        {[...Array(4)].map((_, idx) => (
          <Skeleton key={idx} className="h-65 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Focus Over Time</CardTitle>
            <CardDescription>
              {focusSeries.length ? `${getFocusLabel(latestFocus)} focus right now` : 'No confidence history yet.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {focusSeries.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={focusSeries} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F1F22" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#7B7F86', fontSize: 12 }}
                    tickFormatter={(value) => formatDateLabel(String(value))}
                    angle={-15}
                    height={40}
                    interval="preserveEnd"
                  />
                  <YAxis domain={[0, 1]} tick={{ fill: '#7B7F86', fontSize: 12 }} width={30} />
                  <Tooltip content={<FocusTooltip />} />
                  <Line type="monotone" dataKey="value" stroke="#5E6AD2" strokeWidth={2} dot={false} />
                  {driftMarkers.map((marker) => (
                    <ReferenceLine
                      key={`${marker.date}-${marker.label}`}
                      x={marker.date}
                      stroke="#F59E0B"
                      strokeDasharray="4 4"
                      label={{ position: 'top', value: marker.label, fill: '#F59E0B', fontSize: 11 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="Confidence updates will appear here once the space collects more history." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reading Pace</CardTitle>
            <CardDescription>
              {paceSeries.length
                ? `Current pace ${formatPace(currentPace)} • Avg ${formatPace(averagePace)}`
                : 'No velocity data yet.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {paceSeries.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={paceSeries} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F1F22" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#7B7F86', fontSize: 12 }}
                    tickFormatter={(value) => formatDateLabel(String(value))}
                    angle={-15}
                    height={40}
                    interval="preserveEnd"
                  />
                  <YAxis tick={{ fill: '#7B7F86', fontSize: 12 }} width={30} allowDecimals={false} />
                  <Tooltip content={<PaceTooltip />} />
                  <Line type="monotone" dataKey="value" stroke="#0EA5E9" strokeWidth={2} dot={{ r: 3, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="Velocity signals have not been recorded for this space yet." />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Clarity Snapshot</CardTitle>
            <CardDescription>{clarityMessage}</CardDescription>
          </CardHeader>
          <CardContent className="h-64 flex flex-col gap-4">
            {claritySnapshot.total ? (
              <>
                <div className="text-sm text-muted-foreground">
                  {claritySnapshot.strongPct}% clear matches • {claritySnapshot.moderatePct}% partial • {claritySnapshot.weakPct}% weak
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[claritySnapshot]} stackOffset="expand">
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F1F22" vertical={false} />
                    <XAxis dataKey={() => 'Current'} tick={false} axisLine={false} />
                    <YAxis hide />
                    <Tooltip content={<ClarityTooltip />} />
                    <Bar dataKey="strong" stackId="a" fill="#22C55E" radius={[8, 0, 0, 8]} />
                    <Bar dataKey="moderate" stackId="a" fill="#FACC15" />
                    <Bar dataKey="weak" stackId="a" fill="#F97316" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <EmptyState message="We need a few more captured items to gauge clarity." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Margin Distribution</CardTitle>
            <CardDescription>
              {claritySnapshot.total ? `${claritySnapshot.weak} items look like emerging topics.` : 'No assignment scores yet.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {claritySnapshot.total ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={marginBars}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F1F22" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#7B7F86', fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fill: '#7B7F86', fontSize: 12 }} />
                  <Tooltip content={<MarginTooltip />} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {marginBars.map((entry) => (
                      <Cell key={entry.label} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="Margin analysis will populate after a few captured items." />
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

type DailyAveragePoint = { date: string; label: string; value: number };

function buildDailyAverage<T>(data: T[] | undefined, dateKey: keyof T, valueKey: keyof T) {
  if (!data?.length) return [] as DailyAveragePoint[];
  const buckets = new Map<string, { total: number; count: number }>();

  data.forEach((item) => {
    const rawDate = item[dateKey];
    const iso = typeof rawDate === 'string'
      ? rawDate
      : rawDate instanceof Date
        ? rawDate.toISOString()
        : null;
    if (!iso) return;
    const day = iso.slice(0, 10);
    const rawValue = item[valueKey];
    const value = typeof rawValue === 'number' ? rawValue : Number(rawValue);
    if (!Number.isFinite(value)) return;
    const bucket = buckets.get(day) || { total: 0, count: 0 };
    bucket.total += value;
    bucket.count += 1;
    buckets.set(day, bucket);
  });

  return Array.from(buckets.entries())
    .map(([date, stats]) => ({
      date,
      label: formatDateLabel(date),
      value: Number((stats.total / stats.count).toFixed(3)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function buildMarginBars(clarity: ClarityStats) {
  const entries = [
    { label: 'Strong fit', value: clarity.strong, color: '#22C55E' },
    { label: 'Partial fit', value: clarity.moderate, color: '#FACC15' },
    { label: 'Weak fit', value: clarity.weak, color: '#F97316' },
  ];
  return entries.filter((entry) => entry.value > 0);
}

function formatDateLabel(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getFocusLabel(value: number) {
  if (value >= 0.8) return 'Very strong';
  if (value >= 0.6) return 'Strong';
  if (value >= 0.4) return 'Moderate';
  if (value >= 0.2) return 'Developing';
  return 'Just starting';
}

function formatPace(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 / wk';
  if (value < 1) return '<1 / wk';
  return `${value.toFixed(1)} / wk`;
}

type ChartTooltipProps = TooltipProps<number, string>;

function FocusTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const { payload: point } = payload[0];
  if (!point || typeof point.value !== 'number') return null;
  return (
    <div className="rounded-md border border-white/10 bg-black/80 px-3 py-2 text-xs text-white">
      <div className="font-semibold">{point.label}</div>
      <div>{(point.value * 100).toFixed(0)}% focus</div>
    </div>
  );
}

function PaceTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const { payload: point } = payload[0];
  if (!point || typeof point.value !== 'number') return null;
  return (
    <div className="rounded-md border border-white/10 bg-black/80 px-3 py-2 text-xs text-white">
      <div className="font-semibold">{point.label}</div>
      <div>{formatPace(point.value)}</div>
    </div>
  );
}

function ClarityTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-white/10 bg-black/80 px-3 py-2 text-xs text-white space-y-1">
      {payload.map((entry) => (
        <div key={entry.name ?? entry.dataKey}>
          {entry.name ?? entry.dataKey}: {entry.value}
        </div>
      ))}
    </div>
  );
}

function MarginTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const { payload: point } = payload[0];
  if (!point) return null;
  return (
    <div className="rounded-md border border-white/10 bg-black/80 px-3 py-2 text-xs text-white">
      <div className="font-semibold">{point.label}</div>
      <div>{point.value} items</div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
