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

export interface CreateMarkerInput {
    text: string;
}

export interface CreateSubspaceInput {
    name: string;
    description?: string;
    markers?: string[];
    depth?: string;
    prerequisites?: string[];
    suggested_study_order?: number;
}

export interface CreateSpaceRequest {
    user_id?: string;
    name: string;
    description?: string;
    intention?: string;
    subspaces?: CreateSubspaceInput[];
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

export interface TimelineArtifact {
    id: number;
    title: string | null;
    url: string;
    domain: string;
    created_at: string;
    engagement_level: string;
    subspace_id: number | null;
}

export interface TimelineResponse {
    artifacts: TimelineArtifact[];
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
    engagement_level: EngagementLevel;
    dwell_time_ms: number;
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
    title: string | null;
    domain: string;
    engagement_level: EngagementLevel;
    subspace_id: number | null;
    margin: number | null;
    dwell_time_ms: number;
    created_at: string;
    // Optional fields from full artifact view
    normalized_url?: string;
    content?: string | null;
    word_count?: number;
    content_source?: SourceType;
    scroll_depth?: number;
    reading_depth?: number;
    session_id?: number | null;
    updated_at?: string;
    captured_at?: string | null;
    deleted_at?: string | null;
    reading_time_min?: number | null;
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
    markers: string[];
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

// ============ Analytics (matching backend/interfaces/api/analytics.py) ============

export interface DomainStat {
    domain: string;
    count: number;
}

export interface SubspaceHealth {
    name: string;
    confidence: number;
}

export interface AnalyticsResponse {
    total_artifacts: number;
    engagement_distribution: {
      latent: number;
      discovered: number;
      engaged: number;
      saturated: number;
    };
    top_domains: DomainStat[];
    activity_level: string; // High, Medium, Low
    subspace_health: SubspaceHealth[];
}

export interface TopologyNode {
    subspace_id: number;
    name: string;
    artifact_count: number;
    confidence: number;
    x: number;
    y: number;
    updated_at?: string | null;
    last_active_at?: string | null;
    recent_artifact_count?: number | null;
    activity_band?: 'low' | 'medium' | 'high';
}

export interface TopologySnapshot {
    timestamp: string;
    nodes: TopologyNode[];
}

export interface TopologyResponse {
    nodes: TopologyNode[];
    history?: TopologySnapshot[];
    metadata?: {
        last_updated?: string;
        sampling_window_start?: string;
        sampling_window_end?: string;
    };
}

export interface DriftEvent {
    id: number | null;
    subspace_id: number;
    subspace_name: string;
    drift_magnitude: number;
    occurred_at: string; 
    trigger_signal_id: number | null;
}

export interface VelocityPoint {
    subspace_id: number;
    subspace_name: string;
    velocity: number;
    measured_at: string;
}

export interface ConfidencePoint {
    subspace_id: number;
    subspace_name: string;
    confidence: number;
    computed_at: string;
}

export interface MarginDistribution {
    distribution: {
        weak: number;
        moderate: number;
        strong: number;
    };
    total: number;
}

export interface SmartAlert {
    type: string; // low_margin, high_drift, velocity_drop, confidence_drop
    title: string;
    message: string;
    severity: string; // info, warning
    trigger_value: number;
}

// ============ Alerts (matching backend/interfaces/api/spaces.py) ============

export interface AlertAction {
    label: string;
    action: string;
    target?: string;
}

export interface SpaceAlert {
    id: string;
    type: string; // low_margin, high_drift, velocity_drop, confidence_drop
    severity: string; // info, warning, danger
    title: string;
    message: string;
    affected_artifacts: number[];
    suggested_actions: AlertAction[];
    space_id: number;
}

export interface SpaceAlertsResponse {
    alerts: SpaceAlert[];
    count: number;
}



// ============ Analytics Types ============

export interface OverviewMetrics {
    total_artifacts: number;
    active_spaces: number;
    overall_focus: number; // 0.0 to 1.0
    system_health: string;
}

export interface TimeAllocationItem {
    space_id: number;
    space_name: string;
    space_color: string;
    minutes: number;
    percentage: number;
}

export interface HeatmapItem {
    date: string;
    count: number;
}

export interface WeaknessItem {
    id: number;
    title: string;
    space_name: string;
    margin: number;
    created_at: string;
}

export interface PaceItem {
    space_name: string;
    count: number;
    trend: string;
}

export interface GlobalAnalyticsResult {
    overview: OverviewMetrics;
    time_allocation: TimeAllocationItem[];
    activity_heatmap: HeatmapItem[];
    weak_items: WeaknessItem[];
    pace_by_space: PaceItem[];
}

// ============ Profile (matching backend/interfaces/api/profile.py) ============

export interface ProfileResponse {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    timezone: string;
    onboarding_completed: boolean;
    onboarded_at: string | null;
    settings: Record<string, any>;
    created_at: string;
    updated_at: string;
}

export interface UpdateSettingsRequest {
    settings: Record<string, any>;
}

export interface UpdateProfileRequest {
    display_name?: string;
    avatar_url?: string;
    timezone?: string;
}

// Common settings structure
export interface UserSettings {
    theme?: 'light' | 'dark' | 'auto';
    density?: 'comfortable' | 'compact' | 'cozy';
    notifications_enabled?: boolean;
    retention_days?: number;
}



