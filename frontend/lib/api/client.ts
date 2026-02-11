/**
 * API Client — Typed fetch wrapper for Backend v1.0
 * 
 * Features:
 * - RFC 9457 Problem Details error handling
 * - TanStack Query compatible
 * - Type-safe request/response
 * - Supabase authentication
 */
import type {
    SpaceResponse,
    SpaceListResponse,
    DeleteSpaceResponse,
    Subspace,
    CreateSpaceRequest,
    CaptureRequest,
    CaptureResponse,
    SearchResponse,
    UpdateArtifactRequest,
    ProblemDetails,
    AnalyticsResponse,
    Insight,
    Artifact,
    TimelineResponse,
    SpaceArtifactsListResponse,
    SpaceAlertsResponse,
    GlobalAnalyticsResult,
    TopologyResponse,
    DriftEvent,
    VelocityPoint,
    ConfidencePoint,
    MarginDistribution,
    SmartAlert,
    ProfileResponse,
    UpdateSettingsRequest,
    UpdateProfileRequest,
} from '@/types/api';

// Prefer explicit v1 prefix; match FastAPI settings.API_V1_STR
const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '');

/**
 * API Error with RFC 9457 Problem Details
 */
export class ApiError extends Error {
    constructor(
        public problem: ProblemDetails,
        message?: string
    ) {
        super(message || problem.detail);
        this.name = 'ApiError';
    }
}

class ApiClient {
    private token: string | null = null;

    setToken(token: string | null) {
        this.token = token;
    }

    getToken(): string | null {
        return this.token;
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        if (this.token) {
            (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
        }

        const fullUrl = `${API_URL}${endpoint}`;
        
        try {
            const response = await fetch(fullUrl, {
                ...options,
                headers,
            });

            if (!response.ok) {
                const contentType = response.headers.get('content-type');
                
                // Try to parse RFC 9457 Problem Details
                if (contentType?.includes('application/problem+json') || contentType?.includes('application/json')) {
                    try {
                        const problem = await response.json() as ProblemDetails;
                        
                        // Log for debugging
                        console.error('API Problem:', {
                            status: problem.status,
                            type: problem.type,
                            title: problem.title,
                            detail: problem.detail,
                            instance: problem.instance,
                            context: problem.context,
                        });
                        
                        throw new ApiError(problem);
                    } catch (parseError) {
                        if (parseError instanceof ApiError) {
                            throw parseError;
                        }
                        // Fallback for non-JSON responses
                        const text = await response.text();
                        throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
                    }
                }
                
                // Fallback for non-standard error responses
                const text = await response.text();
                throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
            }

            // Handle no-content responses
            if (response.status === 204 || response.headers.get('content-length') === '0') {
                return undefined as T;
            }

            return response.json();
        } catch (fetchError) {
            // Network errors, CORS issues, etc.
            if (fetchError instanceof ApiError) {
                throw fetchError;
            }
            
            if (fetchError instanceof Error && fetchError.message.includes('Failed to fetch')) {
                console.error('Network Error:', {
                    message: 'Cannot connect to backend API',
                    url: fullUrl,
                    endpoint,
                    API_URL,
                    error: fetchError,
                });
                throw new Error(`Cannot connect to backend at ${API_URL}. Is the server running?`);
            }
            
            throw fetchError;
        }
    }

    // ============ Spaces API ============

    spaces = {
        /**
         * List all spaces for a user
         * GET /spaces?user_id={userId}
         */
        list: async (userId: string): Promise<SpaceListResponse> => {
            if (!userId) {
                throw new Error('userId is required to list spaces');
            }
            return this.request<SpaceListResponse>(`/spaces?user_id=${encodeURIComponent(userId)}`);
        },

        /**
         * Create a new space
         * POST /spaces?user_id={userId}
         */
        create: async (data: CreateSpaceRequest, userId: string): Promise<SpaceResponse> => {
            return this.request<SpaceResponse>(`/spaces?user_id=${encodeURIComponent(userId)}`, {
                method: 'POST',
                body: JSON.stringify({ ...data, user_id: userId }),
            });
        },

        /**
         * Get space by ID
         * GET /spaces/{id}?user_id={userId}
         */
        get: async (spaceId: number, userId: string): Promise<SpaceResponse> => {
            if (!userId) {
                throw new Error('userId is required to fetch a space');
            }
            if (spaceId === undefined || spaceId === null || Number.isNaN(spaceId)) {
                throw new Error('spaceId is required to fetch a space');
            }
            return this.request<SpaceResponse>(`/spaces/${spaceId}?user_id=${encodeURIComponent(userId)}`);
        },

        /**
         * Delete a space
         * DELETE /spaces/{id}?user_id={userId}
         */
        delete: async (spaceId: number, userId: string): Promise<DeleteSpaceResponse> => {
            if (!userId) {
                throw new Error('userId is required to delete a space');
            }
            if (spaceId === undefined || spaceId === null || Number.isNaN(spaceId)) {
                throw new Error('spaceId is required to delete a space');
            }
            return this.request<DeleteSpaceResponse>(`/spaces/${spaceId}?user_id=${encodeURIComponent(userId)}` , {
                method: 'DELETE',
            });
        },

        /**
         * List subspaces for a space
         * GET /spaces/{id}/subspaces?user_id={userId}
         */
        getSubspaces: async (spaceId: number, userId: string): Promise<Subspace[]> => {
            if (!userId) {
                throw new Error('userId is required to fetch subspaces');
            }
            if (spaceId === undefined || spaceId === null || Number.isNaN(spaceId)) {
                throw new Error('spaceId is required to fetch subspaces');
            }
            return this.request<Subspace[]>(`/spaces/${spaceId}/subspaces?user_id=${encodeURIComponent(userId)}`);
        },

        /**
         * Get timeline for a space
         * GET /spaces/{id}/timeline?user_id={userId}
         */
        getTimeline: async (spaceId: number, userId: string): Promise<TimelineResponse> => {
            if (!userId) throw new Error('userId is required');
            return this.request<TimelineResponse>(`/spaces/${spaceId}/timeline?user_id=${encodeURIComponent(userId)}`);
        },

        /**
         * Get artifacts for a space (paginated)
         * GET /spaces/{id}/artifacts?user_id={userId}&page={page}&page_size={pageSize}
         */
        getArtifacts: async (
            spaceId: number, 
            userId: string, 
            page: number = 1, 
            pageSize: number = 50
        ): Promise<PaginatedResponse<Artifact>> => {
            if (!userId) throw new Error('userId is required');
            if (!spaceId) throw new Error('spaceId is required');
            const response = await this.request<SpaceArtifactsListResponse>(`/spaces/${spaceId}/artifacts?user_id=${encodeURIComponent(userId)}&page=${page}&page_size=${pageSize}`);
            return {
                items: response.artifacts,
                count: response.count,
                page: response.page,
                page_size: response.page_size,
            };
        },

        /**
         * Get alerts for a space
         * GET /spaces/{id}/alerts?user_id={userId}
         */
        getAlerts: async (spaceId: number, userId: string): Promise<SpaceAlertsResponse> => {
            if (!userId) throw new Error('userId is required');
            if (!spaceId) throw new Error('spaceId is required');
            return this.request<SpaceAlertsResponse>(`/spaces/${spaceId}/alerts?user_id=${encodeURIComponent(userId)}`);
        },
    };

    // ============ Capture API ============

    /**
     * Capture an artifact with its signal
     * POST /capture
     */
    capture = async (data: CaptureRequest): Promise<CaptureResponse> => {
        return this.request<CaptureResponse>('/capture', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    };

    // ============ Search API ============

    /**
     * Search artifacts by semantic similarity
     * GET /search?q={query}&...filters
     */
    search = async (
        query: string,
        filters: {
            space_id?: number;
            subspace_id?: number;
            limit?: number;
            threshold?: number;
        } = {}
    ): Promise<SearchResponse> => {
        const params = new URLSearchParams({ q: query });

        if (filters.space_id) params.append('space_id', String(filters.space_id));
        if (filters.subspace_id) params.append('subspace_id', String(filters.subspace_id));
        if (filters.limit) params.append('limit', String(filters.limit));
        if (filters.threshold) params.append('threshold', String(filters.threshold));

        return this.request<SearchResponse>(`/search?${params.toString()}`);
    };

    // ============ Artifacts API ============

    artifacts = {
        /**
         * List artifacts for a user
         * GET /artifacts?user_id={userId}&limit={limit}
         */
        list: async (userId: string, limit: number = 50): Promise<Artifact[]> => {
            if (!userId) {
                throw new Error('userId is required to list artifacts');
            }
            return this.request<Artifact[]>(`/artifacts?user_id=${encodeURIComponent(userId)}&limit=${limit}`);
        },

        /**
         * Update artifact fields
         * PATCH /artifacts/{id}?user_id={userId}
         */
        update: async (
            artifactId: number,
            userId: string,
            data: UpdateArtifactRequest
        ): Promise<{ message: string }> => {
            return this.request(`/artifacts/${artifactId}?user_id=${encodeURIComponent(userId)}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            });
        },

        /**
         * Soft-delete an artifact
         * DELETE /artifacts/{id}?user_id={userId}
         */
        delete: async (artifactId: number, userId: string): Promise<{ message: string }> => {
            return this.request(`/artifacts/${artifactId}?user_id=${encodeURIComponent(userId)}`, {
                method: 'DELETE',
            });
        },
    };

    // ============ Analytics API ============
    
    analytics = {
        /**
         * Get space analytics
         * GET /spaces/{id}/analytics?user_id={userId}
         */
        space: async (spaceId: number, userId: string): Promise<AnalyticsResponse> => {
            if (!userId) {
                throw new Error('userId is required to fetch analytics');
            }
            return this.request<AnalyticsResponse>(`/spaces/${spaceId}/analytics?user_id=${encodeURIComponent(userId)}`);
        },

        /**
         * Get space topology
         * GET /spaces/{id}/topology
         */
        topology: async (spaceId: number, userId: string): Promise<TopologyResponse> => {
             if (!userId) {
                throw new Error('userId is required to fetch topology');
            }
            return this.request<TopologyResponse>(`/spaces/${spaceId}/topology?user_id=${encodeURIComponent(userId)}`);
        },

        drift: async (spaceId: number, userId: string): Promise<DriftEvent[]> => {
             if (!userId) { throw new Error('userId required'); }
            return this.request<DriftEvent[]>(`/spaces/${spaceId}/analytics/drift?user_id=${encodeURIComponent(userId)}`);
        },

        velocity: async (spaceId: number, userId: string): Promise<VelocityPoint[]> => {
             if (!userId) { throw new Error('userId required'); }
            return this.request<VelocityPoint[]>(`/spaces/${spaceId}/analytics/velocity?user_id=${encodeURIComponent(userId)}`);
        },

        confidence: async (spaceId: number, userId: string): Promise<ConfidencePoint[]> => {
             if (!userId) { throw new Error('userId required'); }
            return this.request<ConfidencePoint[]>(`/spaces/${spaceId}/analytics/confidence?user_id=${encodeURIComponent(userId)}`);
        },

        marginDistribution: async (spaceId: number, userId: string): Promise<MarginDistribution> => {
             if (!userId) { throw new Error('userId required'); }
            return this.request<MarginDistribution>(`/spaces/${spaceId}/analytics/margin_distribution?user_id=${encodeURIComponent(userId)}`);
        },

        alerts: async (spaceId: number, userId: string): Promise<SmartAlert[]> => {
             if (!userId) { throw new Error('userId required'); }
            return this.request<SmartAlert[]>(`/spaces/${spaceId}/analytics/alerts?user_id=${encodeURIComponent(userId)}`);
        },

        /**
         * Get global analytics
         * GET /analytics/global?user_id={userId}
         */
        global: async (userId: string): Promise<GlobalAnalyticsResult> => {
            if (!userId) {
                throw new Error('userId is required to fetch global analytics');
            }
            return this.request<GlobalAnalyticsResult>(`/analytics/global?user_id=${encodeURIComponent(userId)}`);
        }
    };

    // ============ Profile API ============

    profile = {
        /**
         * Get user profile
         * GET /profile?user_id={userId}
         */
        get: async (userId: string): Promise<ProfileResponse> => {
            if (!userId) {
                throw new Error('userId is required to fetch profile');
            }
            return this.request<ProfileResponse>(`/profile?user_id=${encodeURIComponent(userId)}`);
        },

        /**
         * Update user settings
         * PATCH /profile?user_id={userId}
         */
        updateSettings: async (userId: string, settings: Record<string, any>): Promise<ProfileResponse> => {
            if (!userId) {
                throw new Error('userId is required to update settings');
            }
            const body: UpdateSettingsRequest = { settings };
            return this.request<ProfileResponse>(`/profile?user_id=${encodeURIComponent(userId)}`, {
                method: 'PATCH',
                body: JSON.stringify(body),
            });
        },

        /**
         * Mark user as onboarded
         * POST /profile/onboard?user_id={userId}
         */
        markOnboarded: async (userId: string): Promise<ProfileResponse> => {
            if (!userId) {
                throw new Error('userId is required to mark onboarded');
            }
            return this.request<ProfileResponse>(`/profile/onboard?user_id=${encodeURIComponent(userId)}`, {
                method: 'POST',
            });
        },

        /**
         * Update profile metadata
         * PATCH /profile/metadata?user_id={userId}
         */
        updateMetadata: async (userId: string, data: UpdateProfileRequest): Promise<ProfileResponse> => {
            if (!userId) {
                throw new Error('userId is required to update profile');
            }
            return this.request<ProfileResponse>(`/profile/metadata?user_id=${encodeURIComponent(userId)}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            });
        },
    };

    // ============ Insights API ============
    
    /**
     * Get user insights
     */
    getInsights = async (userId: string, status = 'active', limit = 5): Promise<Insight[]> => {
        if (!userId) {
             throw new Error('userId is required to fetch insights');
        }
        return this.request<Insight[]>(`/insights?user_id=${encodeURIComponent(userId)}&status=${status}&limit=${limit}`);
    };

    /**
     * Trigger insight generation
     */
    generateInsights = async (userId: string): Promise<{ count: number }> => {
        if (!userId) {
             throw new Error('userId is required to generate insights');
        }
        return this.request<{ count: number }>(`/insights/generate?user_id=${encodeURIComponent(userId)}`, {
            method: 'POST',
        });
    };
}

const api = new ApiClient();

export default api;
export { ApiClient };
