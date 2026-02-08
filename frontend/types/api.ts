/**
 * API Types — Matching FastAPI backend DTOs (Backend v1.0)
 * Generated from backend/interfaces/api/*.py
 */

// ============ Enums (matching backend/domain/value_objects/types.py) ============

/**
 * Semantic ordering of user engagement.
 * IMPORTANT: Never downgrade (DB enforces via semantic comparison).
 */
export type EngagementLevel = 'latent' | 'discovered' | 'engaged' | 'saturated';

/**
 * Source type for artifacts.
 */
export type SourceType = 'web' | 'pdf' | 'video' | 'chat' | 'note' | 'other';

/**
 * Type of signal emitted.
 */
export type SignalType = 'semantic' | 'temporal' | 'behavioral';

// ============ Spaces (matching backend/interfaces/api/spaces.py) ============

export interface CreateSpaceRequest {
    user_id: string;
    name: string;
    description?: string;
}

export interface SpaceResponse {
    id: number;
    name: string;
    description: string | null;
    user_id: string;
    artifact_count: number;
    artifacts_count?: number;
    created_at?: string;
    updated_at?: string;
}

// Alias for components
export type Space = SpaceResponse;

export interface SpaceListResponse {
    spaces: SpaceResponse[];
    count: number;
}

export interface DeleteSpaceResponse {
    deleted: boolean;
}

// ============ Capture (matching backend/interfaces/api/capture.py) ============

export interface CaptureRequest {
    space_id: number;
    url: string;
    // Optional - calculated by backend if missing
    embedding?: number[];
    // Metrics (client-provided)
    reading_depth: number; // 0.0 - 1.5
    scroll_depth: number;  // 0.0 - 1.0
    dwell_time_ms: number; // >= 0
    word_count: number;    // >= 0
    engagement_level: EngagementLevel;
    content_source: SourceType;
    // Optional
    subspace_id?: number;
    session_id?: number;
    title?: string;
    content?: string;
    signal_magnitude?: number;
    signal_type?: SignalType;
    matched_marker_ids?: number[];
    captured_at?: string; // ISO datetime
    // v1.1 Assignment Margin parameters
    margin?: number;
    updates_centroid?: boolean;
}

export interface CaptureResponse {
    artifact_id: number;
    signal_id: number;
    is_new: boolean;
    message: string;
}

// ============ Search (matching backend/interfaces/api/search.py) ============

export interface SearchResultItem {
    artifact_id: number;
    signal_id: number;
    similarity: number;
    title: string | null;
    url: string;
    content_preview: string | null;
    space_id: number;
    subspace_id: number | null;
}

export interface SearchResponse {
    results: SearchResultItem[];
    query: string;
    count: number;
    dimension_used: number;
}

// ============ Artifacts (basic entity types) ============

export interface Artifact {
    id: number;
    user_id: string;
    space_id: number;
    url: string;
    normalized_url: string;
    domain: string;
    title: string | null;
    content: string | null;
    word_count: number;
    engagement_level: EngagementLevel;
    content_source: SourceType;
    dwell_time_ms: number;
    scroll_depth: number;
    reading_depth: number;
    subspace_id: number | null;
    session_id: number | null;
    created_at: string;
    updated_at: string;
    captured_at: string | null;
    deleted_at: string | null;
}

export interface UpdateArtifactRequest {
    title?: string;
    content?: string;
    engagement_level?: EngagementLevel;
    reading_depth?: number;
}

// ============ Subspaces (database entities) ============

export interface Subspace {
    id: number;
    space_id: number;
    user_id: string;
    name: string;
    description: string | null;
    centroid_embedding: number[] | null;
    centroid_updated_at: string | null;
    learning_rate: number;
    artifact_count: number;
    artifacts_count?: number;
    confidence: number;
    created_at: string;
    updated_at: string;
}

// ============ Markers ============

export interface Marker {
    id: number;
    subspace_id: number;
    label: string;
    embedding: number[];
    weight: number;
    created_at: string;
}

// ============ Analytics (v1.0 schema support) ============

export interface SubspaceVelocity {
    id: number;
    subspace_id: number;
    velocity: number;
    displacement: number;
    measured_at: string;
}

export interface SubspaceDrift {
    id: number;
    subspace_id: number;
    drift_magnitude: number;
    cosine_similarity: number;
    trigger_signal_id: number | null;
    occurred_at: string;
}

// ============ RFC 9457 Problem Details (Error Responses) ============

export interface ProblemDetails {
    type: string;
    title: string;
    status: number;
    detail: string;
    instance: string;
    context?: Record<string, unknown>;
}

// ============ Helper Types ============

export type ApiResponse<T> = Promise<T>;

export interface PaginatedResponse<T> {
    items: T[];
    count: number;
    page?: number;
    page_size?: number;
    total_pages?: number;
}

// ============ Insights (Analytics) ============

export type InsightSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface Insight {
    id: number;
    user_id: string;
    space_id?: number;
    headline: string;
    description?: string;
    severity: InsightSeverity;
    category?: string;
    recommended_action?: string;
    created_at: string;
    updated_at?: string;
    dismissed_at?: string | null;
    acted_at?: string | null;
}

// ============ Profile ============

export interface Profile {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
}
