-- Migration: v1.4 - Analytics Support
-- Purpose: Add tables for analytics tracking (velocity, drift)
-- Date: February 4, 2026

BEGIN;

-- 1. Subspace Velocity Tracking
-- Tracks the speed of centroid movement over time
CREATE TABLE IF NOT EXISTS misir.subspace_velocity (
    id bigint generated always as identity primary key,
    subspace_id bigint not null references misir.subspace(id) on delete cascade,
    velocity float not null, -- Scalar speed
    displacement float[] not null, -- Vector direction (displacement from prev centroid)
    measured_at timestamp with time zone default now()
);

-- 2. Subspace Drift History
-- Logs significant drift events (when centroid moves > threshold)
CREATE TABLE IF NOT EXISTS misir.subspace_drift (
    id bigint generated always as identity primary key,
    subspace_id bigint not null references misir.subspace(id) on delete cascade,
    drift_magnitude float not null, -- 1 - cosine_similarity
    previous_centroid float[] not null,
    new_centroid float[] not null,
    trigger_signal_id bigint references misir.signal(id) on delete set null,
    occurred_at timestamp with time zone default now()
);

-- 3. Indexes
CREATE INDEX idx_subspace_velocity_subspace ON misir.subspace_velocity(subspace_id);
CREATE INDEX idx_subspace_drift_subspace ON misir.subspace_drift(subspace_id);
CREATE INDEX idx_subspace_velocity_time ON misir.subspace_velocity(measured_at);

-- 4. RLS Policies
ALTER TABLE misir.subspace_velocity ENABLE ROW LEVEL SECURITY;
ALTER TABLE misir.subspace_drift ENABLE ROW LEVEL SECURITY;

-- Users can view analytics for their subspaces
CREATE POLICY "Users can view own subspace velocity"
    ON misir.subspace_velocity
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM misir.subspace s
            WHERE s.id = subspace_velocity.subspace_id
            AND s.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view own subspace drift"
    ON misir.subspace_drift
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM misir.subspace s
            WHERE s.id = subspace_drift.subspace_id
            AND s.user_id = auth.uid()
        )
    );

COMMIT;
