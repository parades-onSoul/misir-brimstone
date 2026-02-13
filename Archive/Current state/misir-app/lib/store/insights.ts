import { create } from 'zustand';
import { Insight } from '@/lib/types';
import { devtools } from 'zustand/middleware';
import { createBrowserClient } from '@supabase/ssr';

interface InsightState {
    insights: Insight[];
    loading: boolean;

    setInsights: (insights: Insight[]) => void;
    removeInsight: (id: string) => void;
    setLoading: (loading: boolean) => void;

    // Actions
    fetchInsights: () => Promise<void>;
    performAction: (id: string, action: 'dismiss' | 'keep' | 'crystallize') => Promise<void>;
}

/**
 * Get Supabase client
 */
function getSupabase() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}

export const useInsightStore = create<InsightState>()(
    devtools(
        (set, get) => ({
            insights: [],
            loading: false,

            setInsights: (insights) => set({ insights }),

            removeInsight: (id) => set((state) => ({
                insights: state.insights.filter(i => i.id !== id)
            })),

            setLoading: (loading) => set({ loading }),

            fetchInsights: async () => {
                set({ loading: true });
                try {
                    const supabase = getSupabase();
                    const { data, error } = await supabase
                        .from('insights')
                        .select('*')
                        .eq('status', 'active')
                        .order('created_at', { ascending: false })
                        .limit(20);
                    
                    if (error) throw error;
                    
                    // Map DB format to Insight type
                    const insights: Insight[] = (data || []).map(row => ({
                        id: row.id,
                        type: row.type,
                        title: row.title,
                        description: row.description,
                        priority: row.priority || 0,
                        spaceId: row.space_id,
                        status: row.status,
                        createdAt: new Date(row.created_at),
                        actionedAt: row.actioned_at ? new Date(row.actioned_at) : undefined,
                    }));
                    
                    set({ insights });
                } catch (err) {
                    console.error('Failed to fetch insights:', err);
                } finally {
                    set({ loading: false });
                }
            },

            performAction: async (id, action) => {
                // Optimistic update
                const currentInsights = get().insights;
                set({ insights: currentInsights.filter(i => i.id !== id) });

                try {
                    const supabase = getSupabase();
                    const status = action === 'dismiss' ? 'dismissed' 
                        : action === 'keep' ? 'kept' 
                        : 'crystallized';
                    
                    const { error } = await supabase
                        .from('insights')
                        .update({ 
                            status,
                            actioned_at: new Date().toISOString()
                        })
                        .eq('id', id);

                    if (error) throw error;
                } catch (err) {
                    console.error('Action failed, rolling back:', err);
                    set({ insights: currentInsights }); // Rollback
                }
            },
        }),
        { name: 'insight-store' }
    )
);
