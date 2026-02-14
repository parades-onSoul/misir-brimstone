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
            // Refresh all capture-dependent views.
            queryClient.invalidateQueries({ queryKey: ['spaces'] });
            queryClient.invalidateQueries({ queryKey: ['subspaces'] });
            queryClient.invalidateQueries({ queryKey: ['artifacts'] });
            queryClient.invalidateQueries({ queryKey: ['analytics'] });
            
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
            data 
        }: { 
            artifactId: number; 
            data: UpdateArtifactRequest
        }) => api.artifacts.update(artifactId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['artifacts'] });
        },
    });
}

export function useDeleteArtifact() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ artifactId }: { artifactId: number }) => 
            api.artifacts.delete(artifactId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['artifacts'] });
            queryClient.invalidateQueries({ queryKey: ['spaces'] });
        },
    });
}
