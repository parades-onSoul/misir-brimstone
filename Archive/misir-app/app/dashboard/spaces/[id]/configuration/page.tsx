'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSpaceStore } from "@/lib/store";
import type { Space } from "@/lib/types";
import { ChevronRight } from 'lucide-react';

export default function SpaceConfigurationPage() {
  const params = useParams();
  const router = useRouter();
  const { spaces, deleteSpace } = useSpaceStore();
  const [space, setSpace] = useState<Space | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expandedSubspaces, setExpandedSubspaces] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (params.id) {
      const foundSpace = spaces.find(s => s.id === params.id);
      if (foundSpace) {
        setSpace(foundSpace);
        setLoading(false);
      } else {
        async function fetchSpace() {
          try {
            const response = await fetch(`/api/spaces?id=${params.id}`);
            if (response.ok) {
              const data = await response.json();
              setSpace(data.space);
            }
          } catch (error) {
            console.error('Failed to fetch space:', error);
          } finally {
            setLoading(false);
          }
        }
        void fetchSpace();
      }
    }
  }, [params.id, spaces]);

  const toggleSubspace = (id: string) => {
    setExpandedSubspaces(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  async function handleDelete() {
    if (!space) return;
    
    setDeleting(true);
    try {
      const response = await fetch(`/api/spaces?id=${space.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        deleteSpace(space.id);
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error deleting space:', error);
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="mt-6 space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (!space) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Space not found</p>
      </div>
    );
  }

  const totalMarkers = space.subspaces?.reduce((sum, s) => sum + s.markers.length, 0) || 0;

  return (
    <div className="flex flex-1 flex-col p-6 overflow-y-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold">{space.name}</h1>
        {space.intention && (
          <p className="text-sm text-muted-foreground mt-1">{space.intention}</p>
        )}
      </div>

      {/* Subspaces */}
      {space.subspaces && space.subspaces.length > 0 && (
        <div className="mb-8">
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Subspaces
            </span>
            <span className="text-xs text-muted-foreground">
              {space.subspaces.length} · {totalMarkers} markers
            </span>
          </div>
          
          <div className="border rounded-lg divide-y">
            {space.subspaces.map((subspace) => {
              const isExpanded = expandedSubspaces.has(subspace.id);
              
              return (
                <div key={subspace.id}>
                  <button
                    onClick={() => toggleSubspace(subspace.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                  >
                    <ChevronRight 
                      className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${
                        isExpanded ? 'rotate-90' : ''
                      }`}
                    />
                    <span className="font-medium text-sm flex-1">{subspace.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {subspace.markers.length}
                    </span>
                  </button>
                  
                  {isExpanded && (
                    <div className="px-10 pb-3 pt-1">
                      <div className="flex flex-wrap gap-1.5">
                        {subspace.markers.map((marker, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                          >
                            {marker}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {(!space.subspaces || space.subspaces.length === 0) && (
        <div className="mb-8">
          <div className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">
            Subspaces
          </div>
          <div className="text-sm text-muted-foreground py-8 text-center border rounded-lg">
            No subspaces yet. They&apos;ll be generated as you browse.
          </div>
        </div>
      )}

      {/* Danger Zone */}
      <div className="mt-auto pt-8 border-t">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Delete space</p>
            <p className="text-xs text-muted-foreground">
              Permanently remove this space and all its data
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setShowDeleteDialog(true)}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &quot;{space.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all artifacts and subspaces. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
