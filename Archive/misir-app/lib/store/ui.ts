import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface UIState {
  sidebarOpen: boolean;
  theme: 'dark' | 'light';
  createSpaceModalOpen: boolean;
  selectedView: 'grid' | 'list';
  
  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  toggleCreateSpaceModal: () => void;
  setCreateSpaceModalOpen: (open: boolean) => void;
  setSelectedView: (view: 'grid' | 'list') => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      (set) => ({
        sidebarOpen: true,
        theme: 'dark',
        createSpaceModalOpen: false,
        selectedView: 'grid',

        toggleSidebar: () => 
          set((state) => ({ sidebarOpen: !state.sidebarOpen })),

        setSidebarOpen: (open) => 
          set({ sidebarOpen: open }),

        setTheme: (theme) => 
          set({ theme }),

        toggleCreateSpaceModal: () =>
          set((state) => ({ createSpaceModalOpen: !state.createSpaceModalOpen })),

        setCreateSpaceModalOpen: (open) =>
          set({ createSpaceModalOpen: open }),

        setSelectedView: (view) =>
          set({ selectedView: view }),
      }),
      {
        name: 'ui-store',
        partialize: (state) => ({
          theme: state.theme,
          selectedView: state.selectedView,
        }),
      }
    ),
    { name: 'ui-store' }
  )
);
