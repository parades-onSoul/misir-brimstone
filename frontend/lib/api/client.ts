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
    UpdateSpaceRequest,
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
    PaginatedResponse,
} from '@/types/api';

// Prefer explicit v1 prefix; match FastAPI settings.API_V1_STR
const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '');
const NETWORK_RETRY_ATTEMPTS = 2;
const NETWORK_RETRY_BACKOFF_MS = 500;

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
        options: RequestInit = {},
        attempt: number = 0
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
                const contentType = response.headers.get('content-type') || '';
                const rawText = await response.text();

                // Try to parse RFC 9457 Problem Details (or any JSON error body)
                if (contentType.includes('application/problem+json') || contentType.includes('application/json')) {
                    let parsed: Record<string, unknown> | null = null;
                    if (rawText) {
                        try {
                            parsed = JSON.parse(rawText) as Record<string, unknown>;
                        } catch {
                            parsed = null;
                        }
                    }

                    if (parsed) {
                        const detailRaw = String(parsed.detail ?? parsed.message ?? rawText ?? '');
                        const problem: ProblemDetails = {
                            type: String(parsed.type ?? 'about:blank'),
                            title: String(parsed.title ?? response.statusText ?? 'Request failed'),
                            status: Number(parsed.status ?? response.status),
                            detail: detailRaw ? detailRaw : response.statusText,
                            instance: String(parsed.instance ?? endpoint),
                            context: (parsed.context as Record<string, unknown> | undefined) ?? parsed,
                        };

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
                    }
                }

                // Fallback for non-standard error responses
                throw new Error(`HTTP ${response.status}: ${rawText || response.statusText}`);
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
                if (attempt < NETWORK_RETRY_ATTEMPTS) {
                    const backoffMs = NETWORK_RETRY_BACKOFF_MS * (attempt + 1);
                    await new Promise((resolve) => setTimeout(resolve, backoffMs));
                    return this.request<T>(endpoint, options, attempt + 1);
                }

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
         * GET /spaces
         */
        list: async (_userId?: string): Promise<SpaceListResponse> => {
            void _userId; // Legacy arg kept for hook compatibility (JWT auth is server-side).
            return this.request<SpaceListResponse>(`/spaces`);
        },

        /**
         * Create a new space
         * POST /spaces
         */
        create: async (data: CreateSpaceRequest, _userId?: string): Promise<SpaceResponse> => {
            void _userId;
            return this.request<SpaceResponse>(`/spaces`, {
                method: 'POST',
                body: JSON.stringify(data),
            });
        },

        /**
         * Get space by ID
         * GET /spaces/{id}
         */
        get: async (spaceId: number, _userId?: string): Promise<SpaceResponse> => {
            void _userId;
            if (spaceId === undefined || spaceId === null || Number.isNaN(spaceId)) {
                throw new Error('spaceId is required to fetch a space');
            }
            return this.request<SpaceResponse>(`/spaces/${spaceId}`);
        },

        /**
         * Delete a space
         * DELETE /spaces/{id}
         */
        delete: async (spaceId: number, _userId?: string): Promise<DeleteSpaceResponse> => {
            void _userId;
            if (spaceId === undefined || spaceId === null || Number.isNaN(spaceId)) {
                throw new Error('spaceId is required to delete a space');
            }
            return this.request<DeleteSpaceResponse>(`/spaces/${spaceId}` , {
                method: 'DELETE',
            });
        },

        /**
         * Update mutable fields for a space
         * PATCH /spaces/{id}
         */
        update: async (spaceId: number, _userId: string | undefined, data: UpdateSpaceRequest): Promise<SpaceResponse> => {
            void _userId;
            if (spaceId === undefined || spaceId === null || Number.isNaN(spaceId)) {
                throw new Error('spaceId is required to update a space');
            }
            return this.request<SpaceResponse>(`/spaces/${spaceId}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            });
        },

        /**
         * List subspaces for a space
         * GET /spaces/{id}/subspaces
         */
        getSubspaces: async (spaceId: number, _userId?: string): Promise<Subspace[]> => {
            void _userId;
            if (spaceId === undefined || spaceId === null || Number.isNaN(spaceId)) {
                throw new Error('spaceId is required to fetch subspaces');
            }
            return this.request<Subspace[]>(`/spaces/${spaceId}/subspaces`);
        },

        /**
         * Create subspace (topic area)
         * POST /spaces/{id}/subspaces
         */
        createSubspace: async (
            spaceId: number,
            data: { name: string; description?: string; markers?: string[] }
        ): Promise<Subspace> => {
            if (!spaceId) throw new Error('spaceId is required');
            return this.request<Subspace>(`/spaces/${spaceId}/subspaces`, {
                method: 'POST',
                body: JSON.stringify(data),
            });
        },

        /**
         * Update subspace
         * PATCH /spaces/{id}/subspaces/{subspaceId}
         */
        updateSubspace: async (
            spaceId: number,
            subspaceId: number,
            data: { name?: string; description?: string }
        ): Promise<Subspace> => {
            if (!spaceId) throw new Error('spaceId is required');
            if (!subspaceId) throw new Error('subspaceId is required');
            return this.request<Subspace>(`/spaces/${spaceId}/subspaces/${subspaceId}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            });
        },

        /**
         * Delete subspace
         * DELETE /spaces/{id}/subspaces/{subspaceId}
         */
        deleteSubspace: async (spaceId: number, subspaceId: number): Promise<{ deleted: boolean }> => {
            if (!spaceId) throw new Error('spaceId is required');
            if (!subspaceId) throw new Error('subspaceId is required');
            return this.request<{ deleted: boolean }>(`/spaces/${spaceId}/subspaces/${subspaceId}`, {
                method: 'DELETE',
            });
        },

        /**
         * Merge subspace into another subspace
         * POST /spaces/{id}/subspaces/{subspaceId}/merge
         */
        mergeSubspace: async (
            spaceId: number,
            sourceSubspaceId: number,
            targetSubspaceId: number
        ): Promise<{ merged: boolean; source_subspace_id: number; target_subspace_id: number; moved_artifacts: number }> => {
            if (!spaceId) throw new Error('spaceId is required');
            if (!sourceSubspaceId) throw new Error('sourceSubspaceId is required');
            if (!targetSubspaceId) throw new Error('targetSubspaceId is required');
            return this.request<{ merged: boolean; source_subspace_id: number; target_subspace_id: number; moved_artifacts: number }>(
                `/spaces/${spaceId}/subspaces/${sourceSubspaceId}/merge`,
                {
                    method: 'POST',
                    body: JSON.stringify({ target_subspace_id: targetSubspaceId }),
                }
            );
        },

        /**
         * Get timeline for a space
         * GET /spaces/{id}/timeline
         */
        getTimeline: async (spaceId: number, _userId?: string): Promise<TimelineResponse> => {
            void _userId;
            return this.request<TimelineResponse>(`/spaces/${spaceId}/timeline`);
        },

        /**
         * Get artifacts for a space (paginated)
         * GET /spaces/{id}/artifacts?page={page}&page_size={pageSize}
         */
        getArtifacts: async (
            spaceId: number, 
            _userId?: string, 
            page: number = 1, 
            pageSize: number = 50
        ): Promise<PaginatedResponse<Artifact> & { artifacts: Artifact[] }> => {
            void _userId;
            if (!spaceId) throw new Error('spaceId is required');
            const response = await this.request<SpaceArtifactsListResponse>(`/spaces/${spaceId}/artifacts?page=${page}&page_size=${pageSize}`);
            const artifacts = response.artifacts.map((artifact) => ({
                ...artifact,
                // Space artifacts endpoint is JWT-scoped and does not include user_id.
                // Keep compatibility with Artifact shape expected by existing UI.
                user_id: '',
                space_id: spaceId,
            }));
            return {
                items: artifacts,
                artifacts,
                count: response.count,
                page: response.page,
                page_size: response.page_size,
            };
        },

        /**
         * Get alerts for a space
         * GET /spaces/{id}/alerts
         */
        getAlerts: async (spaceId: number, _userId?: string): Promise<SpaceAlertsResponse> => {
            void _userId;
            if (!spaceId) throw new Error('spaceId is required');
            return this.request<SpaceAlertsResponse>(`/spaces/${spaceId}/alerts`);
        },
    };

    // ============ Capture API ============

    /**
     * Capture an artifact with its signal
     * POST /capture
     */
    capture = async (data: CaptureRequest): Promise<CaptureResponse> => {
        return this.request<CaptureResponse>('/artifacts/capture', {
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
         * List recent artifacts for the authenticated user
         * GET /artifacts?limit={limit}
         */
        list: async (limit: number = 50): Promise<Artifact[]> => {
            const normalizedLimit = Number.isFinite(limit)
                ? Math.min(1000, Math.max(1, Math.floor(limit)))
                : 50;
            return this.request<Artifact[]>(`/artifacts?limit=${normalizedLimit}`);
        },

        /**
         * Update artifact fields
         * PATCH /artifacts/{id}
         */
        update: async (
            artifactId: number,
            data: UpdateArtifactRequest
        ): Promise<{ message: string }> => {
            return this.request(`/artifacts/${artifactId}`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            });
        },

        /**
         * Soft-delete an artifact
         * DELETE /artifacts/{id}
         */
        delete: async (artifactId: number): Promise<{ message: string }> => {
            return this.request(`/artifacts/${artifactId}`, {
                method: 'DELETE',
            });
        },
    };

    // ============ Analytics API ============
    
    analytics = {
        /**
         * Get space analytics
         * GET /spaces/{id}/analytics
         */
        space: async (spaceId: number): Promise<AnalyticsResponse> => {
            return this.request<AnalyticsResponse>(`/spaces/${spaceId}/analytics`);
        },

        /**
         * Get space topology
         * GET /spaces/{id}/topology
         */
        topology: async (spaceId: number): Promise<TopologyResponse> => {
            return this.request<TopologyResponse>(`/spaces/${spaceId}/topology`);
        },

        drift: async (spaceId: number): Promise<DriftEvent[]> => {
            return this.request<DriftEvent[]>(`/spaces/${spaceId}/analytics/drift`);
        },

        velocity: async (spaceId: number): Promise<VelocityPoint[]> => {
            return this.request<VelocityPoint[]>(`/spaces/${spaceId}/analytics/velocity`);
        },

        confidence: async (spaceId: number): Promise<ConfidencePoint[]> => {
            return this.request<ConfidencePoint[]>(`/spaces/${spaceId}/analytics/confidence`);
        },

        marginDistribution: async (spaceId: number): Promise<MarginDistribution> => {
            return this.request<MarginDistribution>(`/spaces/${spaceId}/analytics/margin_distribution`);
        },

        alerts: async (spaceId: number): Promise<SmartAlert[]> => {
            return this.request<SmartAlert[]>(`/spaces/${spaceId}/analytics/alerts`);
        },

        /**
         * Get global analytics
         * GET /analytics/global
         */
        global: async (): Promise<GlobalAnalyticsResult> => {
            return this.request<GlobalAnalyticsResult>(`/analytics/global`);
        }
    };

    // ============ Profile API ============

    profile = {
        /**
         * Get user profile
         * GET /profile
         */
        get: async (_userId?: string): Promise<ProfileResponse> => {
            void _userId;
            return this.request<ProfileResponse>(`/profile`);
        },

        /**
         * Update user settings
         * PATCH /profile
         */
        updateSettings: async (_userId: string | undefined, settings: Record<string, unknown>): Promise<ProfileResponse> => {
            void _userId;
            const body: UpdateSettingsRequest = { settings };
            return this.request<ProfileResponse>(`/profile`, {
                method: 'PATCH',
                body: JSON.stringify(body),
            });
        },

        /**
         * Mark user as onboarded
         * POST /profile/onboard
         */
        markOnboarded: async (_userId?: string): Promise<ProfileResponse> => {
            void _userId;
            return this.request<ProfileResponse>(`/profile/onboard`, {
                method: 'POST',
            });
        },

        /**
         * Update profile metadata
         * PATCH /profile/metadata
         */
        updateMetadata: async (_userId: string | undefined, data: UpdateProfileRequest): Promise<ProfileResponse> => {
            void _userId;
            return this.request<ProfileResponse>(`/profile/metadata`, {
                method: 'PATCH',
                body: JSON.stringify(data),
            });
        },
    };

    // ============ Insights API ============
    
    /**
     * Get user insights
     */
    getInsights = async (_userId: string | undefined, status = 'active', limit = 5): Promise<Insight[]> => {
        void _userId;
        return this.request<Insight[]>(`/insights?status=${status}&limit=${limit}`);
    };

    /**
     * Trigger insight generation
     */
    generateInsights = async (_userId?: string): Promise<{ count: number }> => {
        void _userId;
        return this.request<{ count: number }>(`/insights/generate`, {
            method: 'POST',
        });
    };
}

const api = new ApiClient();

export default api;
export { ApiClient };
