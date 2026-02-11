/**
 * UI Store — Global UI state (sidebar, modals, etc.)
 */
import { create } from 'zustand';

interface UIState {
    sidebarOpen: boolean;
    createSpaceModalOpen: boolean;

    // Actions
    toggleSidebar: () => void;
    setSidebarOpen: (open: boolean) => void;
    openCreateSpaceModal: () => void;
    closeCreateSpaceModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
    sidebarOpen: true,
    createSpaceModalOpen: false,

    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    openCreateSpaceModal: () => set({ createSpaceModalOpen: true }),
    closeCreateSpaceModal: () => set({ createSpaceModalOpen: false }),
}));
