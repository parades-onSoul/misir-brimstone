"use client";

import { useEffect, useState, useMemo } from "react";
import { Space } from "@/lib/types";
import { supabase } from "@/lib/db/supabase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ExternalLink, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArtifactActions } from "@/components/dashboard/artifact-actions";

interface Artifact {
  id: string;
  url: string;
  title: string | null;
  artifact_type: 'ambient' | 'engaged' | 'committed';
  base_weight: number;
  relevance: number;
  created_at: string;
  word_count?: number;
  subspace_id?: string;
}

interface SpaceDetailsModalProps {
  space: Space | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ARTIFACT_TYPE_COLORS: Record<string, string> = {
  ambient: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  engaged: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  committed: "bg-green-500/10 text-green-600 dark:text-green-400",
};

const ARTIFACT_TYPE_LABELS: Record<string, string> = {
  ambient: "Ambient",
  engaged: "Engaged",
  committed: "Committed",
};

export function SpaceDetailsModal({
  space,
  open,
  onOpenChange,
}: SpaceDetailsModalProps) {
  if (!space) return null;

  const subspaces = space.subspaces || [];
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [subspaceFilter, setSubspaceFilter] = useState<string>("all");

  // Fetch artifacts for this space
  useEffect(() => {
    if (!open || !space) return;

    const fetchArtifacts = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("artifacts")
          .select("id, url, title, artifact_type, base_weight, relevance, created_at, word_count")
          .eq("space_id", space.id)
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) {
          console.error("Failed to fetch artifacts:", error);
          setArtifacts([]);
        } else {
          setArtifacts(data || []);
        }
      } catch (err) {
        console.error("Error fetching artifacts:", err);
        setArtifacts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchArtifacts();
  }, [open, space]);

  // Filter artifacts
  const filteredArtifacts = useMemo(() => {
    return artifacts.filter((artifact) => {
      const matchesSearch =
        !searchTerm ||
        artifact.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        artifact.url.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType =
        typeFilter === "all" || artifact.artifact_type === typeFilter;

      const matchesSubspace =
        subspaceFilter === "all" ||
        (artifact.subspace_id && artifact.subspace_id === subspaceFilter);

      return matchesSearch && matchesType && matchesSubspace;
    });
  }, [artifacts, searchTerm, typeFilter, subspaceFilter]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{space.name}</DialogTitle>
          <DialogDescription>
            {space.intention || "No intention provided"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-6 pr-4">
            {/* State Vector */}
            <div>
              <h3 className="text-sm font-semibold mb-3">State Distribution</h3>
              <div className="flex gap-2 items-center">
                {(space.stateVector || [10, 0, 0, 0]).map((mass, idx) => {
                  const labels = ['Latent', 'Discovered', 'Engaged', 'Saturated'];
                  const stateVec = space.stateVector || [10, 0, 0, 0];
                  const total = stateVec.reduce((sum, m) => sum + m, 0);
                  const percentage = total > 0 ? (mass / total * 100).toFixed(1) : '0.0';

                  return (
                    <div key={idx} className="flex-1">
                      <div className="text-xs text-muted-foreground mb-1">{labels[idx]}</div>
                      <div className="bg-secondary rounded p-2 text-center">
                        <div className="text-lg font-semibold">{mass}</div>
                        <div className="text-xs text-muted-foreground">{percentage}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Evidence */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Evidence Score</h3>
              <div className="bg-secondary rounded p-3">
                <div className="text-2xl font-bold">{(space.evidence || 0).toFixed(2)}</div>
              </div>
            </div>

            <Separator />

            {/* Subspaces with Markers */}
            <div>
              <h3 className="text-sm font-semibold mb-3">
                Subspaces & Markers ({subspaces.length})
              </h3>

              {subspaces.length === 0 ? (
                <div className="text-sm text-muted-foreground p-4 bg-secondary rounded">
                  No subspaces generated yet
                </div>
              ) : (
                <div className="space-y-4 p-4 bg-secondary/30 rounded-lg">
                  {subspaces.map((subspace, idx: number) => (
                    <div key={subspace.id || idx} className="space-y-2">
                      <h4 className="font-medium text-sm">{subspace.name}</h4>
                      <div className="flex flex-wrap gap-1">
                        {subspace.markers.map((marker: string, mIdx: number) => (
                          <Badge
                            key={mIdx}
                            variant="outline"
                            className="text-xs font-normal"
                          >
                            {marker}
                          </Badge>
                        ))}
                      </div>
                      {idx < subspaces.length - 1 && <Separator className="mt-3" />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Artifacts Section */}
            <div>
              <h3 className="text-sm font-semibold mb-3">
                Artifacts ({filteredArtifacts.length})
              </h3>

              {/* Search and Filters */}
              <div className="space-y-3 mb-4">
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search artifacts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Filter Controls */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Type
                    </label>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="ambient">Ambient</SelectItem>
                        <SelectItem value="engaged">Engaged</SelectItem>
                        <SelectItem value="committed">Committed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {subspaces.length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Subspace
                      </label>
                      <Select value={subspaceFilter} onValueChange={setSubspaceFilter}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Subspaces</SelectItem>
                          {subspaces.map((subspace) => (
                            <SelectItem key={subspace.id} value={subspace.id || ""}>
                              {subspace.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>

              {/* Artifacts List */}
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : artifacts.length === 0 ? (
                <div className="text-sm text-muted-foreground p-4 bg-secondary/50 rounded">
                  No artifacts captured yet
                </div>
              ) : filteredArtifacts.length === 0 ? (
                <div className="text-sm text-muted-foreground p-4 bg-secondary/50 rounded">
                  No artifacts match your filters
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead className="w-[100px]">Type</TableHead>
                        <TableHead className="w-[100px]">Date</TableHead>
                        <TableHead className="w-[80px] text-right">Rel.</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredArtifacts.map((artifact) => (
                        <TableRow key={artifact.id}>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <a
                                href={artifact.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline text-primary flex items-center gap-1"
                              >
                                {artifact.title || "Untitled"}
                                <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-50" />
                              </a>
                              <span className="text-xs text-muted-foreground break-all">
                                {artifact.url}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge
                                variant="secondary"
                                className={`w-fit text-[10px] px-1 py-0 ${ARTIFACT_TYPE_COLORS[artifact.artifact_type]}`}
                              >
                                {ARTIFACT_TYPE_LABELS[artifact.artifact_type]}
                              </Badge>
                              {artifact.word_count && (
                                <span className="text-[10px] text-muted-foreground">
                                  {(artifact.word_count / 1000).toFixed(1)}k words
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(artifact.created_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={
                              artifact.relevance > 0.8 ? "text-green-600 font-medium" :
                                artifact.relevance > 0.5 ? "text-blue-600" :
                                  "text-muted-foreground"
                            }>
                              {(artifact.relevance * 100).toFixed(0)}%
                            </span>
                          </TableCell>
                          <TableCell>
                            <ArtifactActions
                              artifactId={artifact.id}
                              artifactTitle={artifact.title || 'Untitled'}
                              currentSpaceId={space.id}
                              currentSubspaceId={artifact.subspace_id || null}
                              onActionComplete={() => {
                                // Refresh logic could go here, for now relying on local state update potentially?
                                // ideally we filter it out of the local list
                                setArtifacts(prev => prev.filter(a => a.id !== artifact.id));
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Metadata */}
            <Separator />
            <div className="grid grid-cols-2 gap-4 text-sm pb-4">
              <div>
                <div className="text-muted-foreground">Created</div>
                <div>{new Date(space.createdAt).toLocaleDateString()}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Last Updated</div>
                <div>{new Date(space.lastUpdatedAt).toLocaleDateString()}</div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
