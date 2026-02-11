'use client';

/**
 * Capture Hooks — TanStack Query hooks for artifact capture (Backend v1.0)
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api/client';
import type { CaptureRequest, CaptureResponse, UpdateArtifactRequest } from '@/types/api';

export function useCaptureArtifact() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: CaptureRequest) => api.capture(data),
        onSuccess: (response: CaptureResponse) => {
            // Invalidate spaces to update artifact count
            queryClient.invalidateQueries({ queryKey: ['spaces'] });
            
            // Could also invalidate search results if needed
            if (response.is_new) {
                queryClient.invalidateQueries({ queryKey: ['search'] });
            }
        },
    });
}

export function useUpdateArtifact() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ 
            artifactId, 
            userId, 
            data 
        }: { 
            artifactId: number; 
            userId: string; 
            data: UpdateArtifactRequest
        }) => api.artifacts.update(artifactId, userId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['artifacts'] });
        },
    });
}

export function useDeleteArtifact() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ artifactId, userId }: { artifactId: number; userId: string }) => 
            api.artifacts.delete(artifactId, userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['artifacts'] });
            queryClient.invalidateQueries({ queryKey: ['spaces'] });
        },
    });
}
