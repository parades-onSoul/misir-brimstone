'use client';

/**
 * Auth Hook — Supabase authentication with API token sync
 */
import { useEffect, useState, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import api from '@/lib/api/client';

interface AuthState {
    user: User | null;
    session: Session | null;
    loading: boolean;
}

export function useAuth() {
    const [state, setState] = useState<AuthState>({
        user: null,
        session: null,
        loading: true,
    });

    const supabase = createClient();

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setState({
                user: session?.user ?? null,
                session,
                loading: false,
            });

            // Sync token with API client
            api.setToken(session?.access_token ?? null);
        });

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setState({
                user: session?.user ?? null,
                session,
                loading: false,
            });

            // Sync token with API client
            api.setToken(session?.access_token ?? null);
        });

        return () => subscription.unsubscribe();
    }, [supabase.auth]);

    const signIn = useCallback(
        async (email: string, password: string) => {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            return { error };
        },
        [supabase.auth]
    );

    const signUp = useCallback(
        async (email: string, password: string) => {
            const { error } = await supabase.auth.signUp({
                email,
                password,
            });
            return { error };
        },
        [supabase.auth]
    );

    const signOut = useCallback(async () => {
        await supabase.auth.signOut();
        api.setToken(null);
    }, [supabase.auth]);

    return {
        user: state.user,
        session: state.session,
        loading: state.loading,
        signIn,
        signUp,
        signOut,
    };
}
