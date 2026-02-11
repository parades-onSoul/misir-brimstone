'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api/client';

const INSIGHTS_KEY = ['insights'] as const;

export function useInsights(userId: string | undefined) {
    return useQuery({
        queryKey: [...INSIGHTS_KEY, userId],
        queryFn: () => api.getInsights(userId!),
        enabled: !!userId,
        staleTime: 60000 * 5, // 5 minutes
    });
}

export function useGenerateInsights() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: (userId: string) => api.generateInsights(userId),
        onSuccess: (data, userId) => {
            queryClient.invalidateQueries({ queryKey: [...INSIGHTS_KEY, userId] });
        },
    });
}
