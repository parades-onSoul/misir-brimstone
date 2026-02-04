'use client';

import { useEffect } from 'react';
import { useSpaceStore, useAuthStore } from '@/lib/store';
import { SpaceCard } from './space-card';
import { Skeleton } from '@/components/ui/skeleton';

export function SpaceGrid() {
  const { spaces, loading, setSpaces, setLoading } = useSpaceStore();
  const { user } = useAuthStore();

  useEffect(() => {
    async function fetchSpaces() {
      if (!user) return;

      setLoading(true);
      try {
        const response = await fetch('/api/spaces');
        if (response.ok) {
          const data = await response.json();
          setSpaces(data.spaces || []);
        }
      } catch (error) {
        console.error('Failed to fetch spaces:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSpaces();
  }, [user, setSpaces, setLoading]);

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-64 rounded-lg" />
        ))}
      </div>
    );
  }

  if (spaces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-12">
        <div className="text-muted-foreground">
          <p className="text-lg font-medium mb-2">No spaces yet</p>
          <p className="text-sm">Create your first space to start tracking your interests</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {spaces.map((space) => (
        <SpaceCard key={space.id} space={space} />
      ))}
    </div>
  );
}
