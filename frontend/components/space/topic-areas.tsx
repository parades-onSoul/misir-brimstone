'use client';

import { useMemo, useState } from 'react';
import type { Artifact, Subspace } from '@/types/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Layers, Pencil, Plus, Trash2 } from 'lucide-react';
import { formatRelativeTime, getFocusLabel } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface TopicAreasProps {
  subspaces?: Subspace[];
  artifacts?: Artifact[];
  onCreateTopic?: () => void;
  onViewTopic?: (subspaceId: number) => void;
  onRenameTopic?: (subspace: Subspace) => void;
  onMergeTopic?: (subspace: Subspace) => void;
  onDeleteTopic?: (subspace: Subspace) => void;
}

const FALLBACK_RECENT_TITLE = 'Untitled item';

const getRecentTitle = (artifact: Artifact): string => {
  return artifact.title?.trim() || artifact.domain || artifact.url || FALLBACK_RECENT_TITLE;
};

export function TopicAreas({
  subspaces = [],
  artifacts = [],
  onCreateTopic,
  onViewTopic,
  onRenameTopic,
  onMergeTopic,
  onDeleteTopic,
}: TopicAreasProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const sortedSubspaces = useMemo(() => {
    return [...subspaces].sort((a, b) => {
      const aCount = a.artifact_count ?? a.artifacts_count ?? 0;
      const bCount = b.artifact_count ?? b.artifacts_count ?? 0;
      return bCount - aCount;
    });
  }, [subspaces]);

  const previewsBySubspace = useMemo(() => {
    const map = new Map<number, Artifact[]>();
    artifacts.forEach((artifact) => {
      if (!artifact.subspace_id) return;
      const existing = map.get(artifact.subspace_id) ?? [];
      existing.push(artifact);
      map.set(artifact.subspace_id, existing);
    });
    map.forEach((items, key) => {
      const sorted = [...items].sort((a, b) => {
        const aDate = new Date(a.captured_at || a.created_at).getTime();
        const bDate = new Date(b.captured_at || b.created_at).getTime();
        return bDate - aDate;
      });
      map.set(key, sorted.slice(0, 3));
    });
    return map;
  }, [artifacts]);

  const toggle = (id: number) => {
    setExpandedId((current) => (current === id ? null : id));
  };

  if (sortedSubspaces.length === 0) {
    return (
      <Card className="bg-[#101114] border-white/5">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Topic Areas</CardTitle>
          <Button size="sm" onClick={onCreateTopic}>
            <Plus className="mr-2 h-4 w-4" /> Create topic area
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            We have not detected any topic areas for this space yet. Capture a few items or start one manually.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#101114] border-white/5">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Topic Areas</CardTitle>
          <p className="text-sm text-muted-foreground">Expandable list of detected subspaces with recent context.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onCreateTopic}>
          <Plus className="mr-2 h-4 w-4" /> New topic
        </Button>
      </CardHeader>
      <CardContent className="divide-y divide-white/5">
        {sortedSubspaces.map((subspace) => {
          const isOpen = expandedId === subspace.id;
          const evidence = subspace.artifact_count ?? subspace.artifacts_count ?? 0;
          const focusLabel = getFocusLabel(subspace.confidence ?? 0);
          const lastActive = formatRelativeTime(
            subspace.last_active_at || subspace.updated_at || subspace.centroid_updated_at
          );
          const previews = previewsBySubspace.get(subspace.id) ?? [];

          return (
            <div key={subspace.id}>
              <button
                type="button"
                className="w-full py-4 flex items-center gap-4"
                onClick={() => toggle(subspace.id)}
                aria-expanded={isOpen}
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-[#EEEEF0]">{subspace.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {evidence} item{evidence === 1 ? '' : 's'} • {focusLabel}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>Last active</p>
                  <p className="font-medium text-[#EEEEF0]">{lastActive}</p>
                </div>
              </button>

              {isOpen && (
                <div className="pb-5 pl-8 space-y-4">
                  {subspace.description && (
                    <p className="text-sm text-muted-foreground">{subspace.description}</p>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg border border-white/5 bg-[#0B0C0E] p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Recent items</p>
                      {previews.length ? (
                        <ul className="space-y-2">
                          {previews.map((artifact) => (
                            <li key={artifact.id} className="text-sm">
                              <p className="text-[#EEEEF0] font-medium truncate">{getRecentTitle(artifact)}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-2">
                                <span>{artifact.domain}</span>
                                <span className="w-1 h-1 rounded-full bg-white/30" />
                                <span>{formatRelativeTime(artifact.captured_at || artifact.created_at)}</span>
                              </p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">No recent items in this topic.</p>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-3 px-0 text-xs text-[#5E6AD2] hover:text-white"
                        onClick={() => onViewTopic?.(subspace.id)}
                        disabled={!onViewTopic}
                      >
                        View all items →
                      </Button>
                    </div>

                    <div className="rounded-lg border border-white/5 bg-[#0B0C0E] p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Markers</p>
                      {subspace.markers?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {subspace.markers.map((marker) => (
                            <span key={marker} className="rounded-full bg-white/5 px-2 py-1 text-xs text-[#EEEEF0]">
                              {marker}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No markers assigned yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRenameTopic?.(subspace)}
                      disabled={!onRenameTopic}
                    >
                      <Pencil className="mr-2 h-3.5 w-3.5" /> Rename
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onMergeTopic?.(subspace)}
                      disabled={!onMergeTopic}
                    >
                      <Layers className="mr-2 h-3.5 w-3.5" /> Merge
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-200"
                      onClick={() => onDeleteTopic?.(subspace)}
                      disabled={!onDeleteTopic}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
      <div className="px-6 py-4">
        <button
          type="button"
          className={cn(
            'flex items-center text-sm font-medium text-[#5E6AD2] hover:text-white transition-colors',
            !onCreateTopic && 'opacity-60 cursor-not-allowed'
          )}
          onClick={onCreateTopic}
          disabled={!onCreateTopic}
        >
          <Plus className="mr-2 h-4 w-4" /> Create new topic area
        </button>
      </div>
    </Card>
  );
}
