import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserState {
    userId: string | null;
    setUserId: (id: string | null) => void;
    
    // Active space context
    activeSpaceId: number | null;
    setActiveSpace: (id: number | null) => void;
    
    // Active subspace context
    activeSubspaceId: number | null;
    setActiveSubspace: (id: number | null) => void;
}

export const useUserStore = create<UserState>()(
    persist(
        (set) => ({
            userId: null,
            setUserId: (id) => set({ userId: id }),
            
            activeSpaceId: null,
            setActiveSpace: (id) => set({ activeSpaceId: id }),
            
            activeSubspaceId: null,
            setActiveSubspace: (id) => set({ activeSubspaceId: id }),
        }),
        {
            name: 'user-storage',
        }
    )
);
