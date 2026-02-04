'use client';

import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useArtifacts, useSpace } from '@/lib/hooks/index';
import { getDomain, getFaviconUrl, formatDateTime, ARTIFACT_TYPE_COLORS, ARTIFACT_TYPE_LABELS, getRelevanceClass } from '@/lib/utils/index';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ExternalLink, MoreHorizontal, Search, Trash2 } from 'lucide-react';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ITEMS_PER_PAGE = 10;

type FilterType = 'all' | 'ambient' | 'engaged' | 'committed';

export default function ArtifactsPage() {
  const params = useParams();
  const spaceId = params.id as string;

  // Use new hooks instead of direct Supabase
  const { space, isLoading: spaceLoading } = useSpace(spaceId);
  const { artifacts, isLoading: artifactsLoading, refresh } = useArtifacts(spaceId);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const isLoading = spaceLoading || artifactsLoading;

  // Delete handler
  const handleDelete = useCallback(async (artifactId: string) => {
    try {
      const response = await fetch(`/api/artifacts?id=${artifactId}`, { method: 'DELETE' });
      if (response.ok) {
        refresh(); // Revalidate via SWR
      }
    } catch (error) {
      console.error('Failed to delete artifact:', error);
    }
  }, [refresh]);

  // Filtered artifacts
  const filteredArtifacts = useMemo(() => {
    let result = [...artifacts];

    if (typeFilter !== 'all') {
      result = result.filter(a => a.artifact_type === typeFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(a =>
        a.title?.toLowerCase().includes(query) ||
        a.url?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [artifacts, typeFilter, searchQuery]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredArtifacts.length / ITEMS_PER_PAGE);
  const paginatedArtifacts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredArtifacts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredArtifacts, currentPage]);

  // Reset page when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [typeFilter, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{space?.name}</h1>
          <p className="text-sm text-muted-foreground">
            {artifacts.length} artifact{artifacts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refresh()}>
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search artifacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={typeFilter}
          onValueChange={(val) => setTypeFilter(val as FilterType)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="ambient">Ambient</SelectItem>
            <SelectItem value="engaged">Engaged</SelectItem>
            <SelectItem value="committed">Committed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60%]">Page</TableHead>
              <TableHead className="w-[100px]">Type</TableHead>
              <TableHead className="w-[80px] text-right">Rel.</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedArtifacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                  {searchQuery || typeFilter !== 'all'
                    ? 'No matching artifacts'
                    : 'No artifacts yet. Browse with the extension to start capturing.'}
                </TableCell>
              </TableRow>
            ) : (
              paginatedArtifacts.map((artifact) => {
                const favicon = getFaviconUrl(artifact.url);
                const relevance = artifact.relevance ?? 0;
                const relevancePercent = Math.round(relevance * 100);
                const domain = getDomain(artifact.url);

                return (
                  <TableRow key={artifact.id}>
                    <TableCell className="py-3">
                      <div className="flex items-start gap-3">
                        {favicon && (
                          <img
                            src={favicon}
                            alt=""
                            className="w-4 h-4 shrink-0 mt-1 opacity-70"
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                          />
                        )}
                        <div className="min-w-0 flex flex-col gap-1">
                          <a
                            href={artifact.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold hover:underline truncate block text-sm"
                          >
                            {artifact.title || 'Untitled'}
                          </a>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="text-foreground/70">{domain}</span>
                            <span>•</span>
                            <span>{formatDateTime(artifact.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`font-normal ${ARTIFACT_TYPE_COLORS[artifact.artifact_type]}`}>
                        {ARTIFACT_TYPE_LABELS[artifact.artifact_type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={getRelevanceClass(relevance)}>
                        {relevancePercent}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <a href={artifact.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Open link
                            </a>
                          </DropdownMenuItem>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                className="text-destructive"
                                onSelect={(e) => e.preventDefault()}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete artifact?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently remove this artifact.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => handleDelete(artifact.id)}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage > 1) setCurrentPage(p => p - 1);
                }}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>

            {Array.from({ length: totalPages }).map((_, i) => {
              const p = i + 1;
              if (
                p === 1 ||
                p === totalPages ||
                (p >= currentPage - 1 && p <= currentPage + 1)
              ) {
                return (
                  <PaginationItem key={p}>
                    <PaginationLink
                      href="#"
                      isActive={currentPage === p}
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage(p);
                      }}
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                );
              }

              if (
                (p === 2 && currentPage > 3) ||
                (p === totalPages - 1 && currentPage < totalPages - 2)
              ) {
                return (
                  <PaginationItem key={p}>
                    <PaginationEllipsis />
                  </PaginationItem>
                );
              }

              return null;
            })}

            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage < totalPages) setCurrentPage(p => p + 1);
                }}
                className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
