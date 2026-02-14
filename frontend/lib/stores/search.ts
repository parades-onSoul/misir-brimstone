import { create } from 'zustand';

interface SearchState {
    query: string;
    setQuery: (query: string) => void;
    
    filters: {
        space_id?: number;
        subspace_id?: number;
        limit?: number;
        threshold?: number;
    };
    setFilters: (filters: SearchState['filters']) => void;
    
    clearAll: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
    query: '',
    setQuery: (query) => set({ query }),
    
    filters: {
        limit: 20,
        threshold: 0.55,
    },
    setFilters: (filters) => set({ filters }),
    
    clearAll: () => set({ query: '', filters: { limit: 20, threshold: 0.55 } }),
}));
