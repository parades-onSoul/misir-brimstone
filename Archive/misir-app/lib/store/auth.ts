import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/db/supabase';

interface AuthState {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  initialize: () => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      user: null,
      loading: true,

      setUser: (user) => set({ user }),
      
      setLoading: (loading) => set({ loading }),

      initialize: () => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
          set({ user: session?.user ?? null, loading: false });
        });

        // Listen to auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (_event, session) => {
            set({ user: session?.user ?? null, loading: false });
          }
        );

        // Cleanup subscription
        return () => subscription.unsubscribe();
      },

      signOut: async () => {
        await supabase.auth.signOut();
        set({ user: null });
      },
    }),
    { name: 'auth-store' }
  )
);

// Initialize auth on store creation
if (typeof window !== 'undefined') {
  useAuthStore.getState().initialize();
}
