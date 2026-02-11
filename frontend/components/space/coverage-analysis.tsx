'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Subspace } from '@/types/api';
import { useSpaceArtifacts } from '@/lib/api/spaces';
import { getFocusLabel, formatRelativeTime, truncateText } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface CoverageAnalysisProps {
  subspaces?: Subspace[];
  spaceId: number;
  userId?: string;
}

interface TopicSummary {
  id: number;
  name: string;
  count: number;
  confidence: number;
  updatedAt?: string;
}

const SECTION_COPY = {
  mastered: {
    title: 'You know a lot about...',
    description: 'High-confidence topics with plenty of evidence.',
    empty: 'Capture a few more items to establish strong expertise in this space.',
  },
  exploring: {
    title: "You're just starting to explore...",
    description: 'Topics that are forming but still need more signals.',
    empty: 'No emerging topics yet. Keep reading broadly to discover new clusters.',
  },
  gaps: {
    title: 'Possible gap detected...',
    description: 'Light coverage and low confidence. These may be blind spots.',
    empty: 'No gaps detected yet. Continue monitoring low-confidence topics.',
  },
};

export function CoverageAnalysis({ subspaces, spaceId, userId }: CoverageAnalysisProps) {
  const topicSummaries = useMemo<TopicSummary[]>(() => {
    if (!subspaces?.length) return [];
    return subspaces.map((sub) => ({
      id: sub.id,
      name: sub.name,
      count: sub.artifact_count ?? sub.artifacts_count ?? 0,
      confidence: sub.confidence ?? 0,
      updatedAt: sub.updated_at,
    }));
  }, [subspaces]);

  const { mastered, exploring, gaps } = useMemo(() => {
    const masteredBucket: TopicSummary[] = [];
    const exploringBucket: TopicSummary[] = [];
    const gapBucket: TopicSummary[] = [];

    topicSummaries.forEach((topic) => {
      if (topic.count >= 8 && topic.confidence > 0.7) {
        masteredBucket.push(topic);
        return;
      }

      if (topic.count < 3 && topic.confidence < 0.4) {
        gapBucket.push(topic);
        return;
      }

      // Anything in between counts as "exploring" to mirror spec ranges
      exploringBucket.push(topic);
    });

    return { mastered: masteredBucket, exploring: exploringBucket, gaps: gapBucket };
  }, [topicSummaries]);

  const {
    data: artifactPage,
    isLoading: suggestionsLoading,
  } = useSpaceArtifacts(spaceId, userId, 1, 100);

  const suggestionArtifacts = useMemo(() => {
    if (!artifactPage?.artifacts?.length) return [];

    return artifactPage.artifacts
      .filter((artifact) => !artifact.subspace_id || (artifact.margin ?? 1) < 0.3)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 3);
  }, [artifactPage]);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle>Coverage Analysis</CardTitle>
        <CardDescription>
          Snapshot of where your understanding is deep versus still forming, plus blind spots to review.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {topicSummaries.length === 0 ? (
          <EmptyCopy message="We need at least one topic to run coverage analysis. Try adding a few artifacts first." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <CoverageColumn tone="positive" data={mastered} copy={SECTION_COPY.mastered} />
            <CoverageColumn tone="neutral" data={exploring} copy={SECTION_COPY.exploring} />
            <CoverageColumn tone="alert" data={gaps} copy={SECTION_COPY.gaps} />
          </div>
        )}
      </CardContent>

      <div className="border-t border-white/5 px-6 py-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#EEEEF0]">Suggested next moves</p>
            <p className="text-xs text-[#9CA0AA]">Pulled from weak-fit or unassigned items in this space.</p>
          </div>
        </div>
        {!userId && (
          <p className="text-sm text-muted-foreground">Sign in to fetch personalized suggestions.</p>
        )}
        {userId && suggestionsLoading && <Skeleton className="h-16 w-full rounded-lg" />}
        {userId && !suggestionsLoading && suggestionArtifacts.length === 0 && (
          <p className="text-sm text-muted-foreground">No blind spot candidates right now. Keep exploring new angles.</p>
        )}
        {userId && suggestionArtifacts.length > 0 && (
          <ul className="space-y-3">
            {suggestionArtifacts.map((artifact) => (
              <li key={artifact.id} className="rounded-lg border border-white/5 bg-[#101114] p-3">
                <p className="text-sm font-medium text-[#EEEEF0]">{truncateText(artifact.title || artifact.url, 80)}</p>
                <div className="mt-1 text-xs text-[#9CA0AA] flex flex-wrap items-center gap-3">
                  <span>{artifact.margin !== null && artifact.margin !== undefined ? getFitCopy(artifact.margin) : 'Untyped fit'}</span>
                  <span>•</span>
                  <span>{formatRelativeTime(artifact.created_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function CoverageColumn({
  data,
  copy,
  tone,
}: {
  data: TopicSummary[];
  copy: { title: string; description: string; empty: string };
  tone: 'positive' | 'neutral' | 'alert';
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-[#101114] p-4">
      <p className={cn('text-sm font-semibold', toneColor(tone))}>{copy.title}</p>
      <p className="text-xs text-[#9CA0AA]">{copy.description}</p>
      <div className="mt-4 space-y-3">
        {data.length === 0 && <p className="text-sm text-muted-foreground">{copy.empty}</p>}
        {data.map((topic) => (
          <div key={topic.id} className="rounded-lg border border-white/5 bg-[#0B0C0E] p-3">
            <div className="flex items-center justify-between text-sm font-medium text-[#EEEEF0]">
              <span>{topic.name}</span>
              <span className="text-xs text-[#9CA0AA]">{topic.count} items</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-[#9CA0AA]">
              <span>{getFocusLabel(topic.confidence)}</span>
              <span>{topic.updatedAt ? formatRelativeTime(topic.updatedAt) : 'Recently'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyCopy({ message }: { message: string }) {
  return (
    <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#0B0C0E]/50 px-4 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function toneColor(tone: 'positive' | 'neutral' | 'alert') {
  if (tone === 'positive') return 'text-emerald-400';
  if (tone === 'alert') return 'text-amber-300';
  return 'text-[#EEEEF0]';
}

function getFitCopy(margin: number) {
  if (margin >= 0.5) return 'Clear match';
  if (margin >= 0.3) return 'Somewhat related';
  return "Doesn't fit well";
}
