'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Skeleton } from "@/components/ui/skeleton";
import { useSpaceStore } from "@/lib/store";
import type { Space } from "@/lib/types";

export default function SpaceSettingsPage() {
  const params = useParams();
  const { spaces } = useSpaceStore();
  const [space, setSpace] = useState<Space | null>(null);
  const [loading, setLoading] = useState(true);

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
        fetchSpace();
      }
    }
  }, [params.id, spaces]);

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="space-y-6">
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-32 w-full" />
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

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">{space.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">Settings</p>
      </div>

      <div className="flex flex-col items-center justify-center h-64 border border-dashed rounded-lg">
        <p className="text-muted-foreground">Settings coming soon</p>
        <p className="text-sm text-muted-foreground mt-2">
          Configure space preferences, markers, and more
        </p>
      </div>
    </div>
  );
}
