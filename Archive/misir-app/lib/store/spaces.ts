import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Space, SpaceSnapshot } from '@/lib/types';

interface SpaceState {
  spaces: Space[];
  snapshots: SpaceSnapshot[];
  loading: boolean;
  selectedSpaceId: string | null;
  
  // Actions
  setSpaces: (spaces: Space[]) => void;
  addSpace: (space: Space) => void;
  updateSpace: (id: string, updates: Partial<Space>) => void;
  deleteSpace: (id: string) => void;
  setSnapshots: (snapshots: SpaceSnapshot[]) => void;
  setLoading: (loading: boolean) => void;
  selectSpace: (id: string | null) => void;
  
  // Optimistic updates
  optimisticAddArtifact: (spaceId: string, evidenceDelta: number) => void;
}

export const useSpaceStore = create<SpaceState>()(
  devtools(
    (set) => ({
      spaces: [],
      snapshots: [],
      loading: false,
      selectedSpaceId: null,

      setSpaces: (spaces) => {
        // Deduplicate spaces by ID to prevent React key warnings
        const uniqueSpaces = Array.from(
          new Map(spaces.map(space => [space.id, space])).values()
        );
        set({ spaces: uniqueSpaces });
      },

      addSpace: (space) => 
        set((state) => ({ spaces: [...state.spaces, space] })),

      updateSpace: (id, updates) =>
        set((state) => ({
          spaces: state.spaces.map((space) =>
            space.id === id ? { ...space, ...updates } : space
          ),
        })),

      deleteSpace: (id) =>
        set((state) => ({
          spaces: state.spaces.filter((space) => space.id !== id),
          selectedSpaceId: state.selectedSpaceId === id ? null : state.selectedSpaceId,
        })),

      setSnapshots: (snapshots) => set({ snapshots }),

      setLoading: (loading) => set({ loading }),

      selectSpace: (id) => set({ selectedSpaceId: id }),

      optimisticAddArtifact: (spaceId, evidenceDelta) =>
        set((state) => ({
          spaces: state.spaces.map((space) =>
            space.id === spaceId
              ? {
                  ...space,
                  evidence: (space.evidence || 0) + evidenceDelta,
                  lastUpdatedAt: new Date(),
                }
              : space
          ),
        })),
    }),
    { name: 'space-store' }
  )
);
