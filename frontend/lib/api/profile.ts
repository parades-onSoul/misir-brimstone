/**
 * Profile API Hooks — React Query hooks for user profile operations
 * 
 * Hooks:
 * - useProfile: Get user profile
 * - useUpdateSettings: Update user settings (theme, density, etc.)
 * - useMarkOnboarded: Mark user as onboarded
 * - useUpdateProfileMetadata: Update display name, avatar, timezone
 */
import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';
import api from './client';
import type { ProfileResponse } from '@/types/api';

/**
 * Query keys for profile operations
 */
export const profileKeys = {
    all: ['profile'] as const,
    byUser: (userId?: string) => [...profileKeys.all, userId] as const,
};

/**
 * Get user profile
 * Creates profile with defaults if not exists
 */
export function useProfile(userId?: string): UseQueryResult<ProfileResponse, Error> {
    return useQuery({
        queryKey: profileKeys.byUser(userId),
        queryFn: async () => {
            if (!userId) {
                throw new Error('userId is required');
            }
            return api.profile.get(userId);
        },
        enabled: !!userId,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}

/**
 * Update user settings
 * Merges with existing settings
 */
export function useUpdateSettings(): UseMutationResult<
    ProfileResponse,
    Error,
    { userId: string; settings: Record<string, any> }
> {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ userId, settings }) => {
            return api.profile.updateSettings(userId, settings);
        },
        onSuccess: (data, variables) => {
            // Invalidate profile query to refetch
            queryClient.invalidateQueries({ queryKey: profileKeys.byUser(variables.userId) });
            
            // Optimistically update cache
            queryClient.setQueryData(profileKeys.byUser(variables.userId), data);
        },
    });
}

/**
 * Mark user as having completed onboarding
 */
export function useMarkOnboarded(): UseMutationResult<
    ProfileResponse,
    Error,
    { userId: string }
> {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ userId }) => {
            return api.profile.markOnboarded(userId);
        },
        onSuccess: (data, variables) => {
            // Invalidate and update profile query
            queryClient.invalidateQueries({ queryKey: profileKeys.byUser(variables.userId) });
            queryClient.setQueryData(profileKeys.byUser(variables.userId), data);
        },
    });
}

/**
 * Update profile metadata (display name, avatar, timezone)
 */
export function useUpdateProfileMetadata(): UseMutationResult<
    ProfileResponse,
    Error,
    { userId: string; display_name?: string; avatar_url?: string; timezone?: string }
> {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ userId, display_name, avatar_url, timezone }) => {
            return api.profile.updateMetadata(userId, {
                display_name,
                avatar_url,
                timezone,
            });
        },
        onSuccess: (data, variables) => {
            // Invalidate and update profile query
            queryClient.invalidateQueries({ queryKey: profileKeys.byUser(variables.userId) });
            queryClient.setQueryData(profileKeys.byUser(variables.userId), data);
        },
    });
}
