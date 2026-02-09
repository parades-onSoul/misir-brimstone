-- Migration: v1.3 - Webhook Support
-- Purpose: Add tables for webhook subscriptions and event logging
-- Date: February 4, 2026

BEGIN;

-- 1. Webhook Subscriptions Table
CREATE TABLE IF NOT EXISTS misir.webhook_subscription (
    id bigint generated always as identity primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    url text not null,
    events text[] not null, -- Array of event types to subscribe to
    secret text not null,   -- Signing secret
    is_active boolean default true,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- 2. Webhook Events Log Table (for delivery tracking)
CREATE TABLE IF NOT EXISTS misir.webhook_event (
    id bigint generated always as identity primary key,
    subscription_id bigint references misir.webhook_subscription(id) on delete cascade,
    event_type text not null,
    payload jsonb not null,
    status text not null check (status in ('pending', 'success', 'failed', 'retrying')),
    attempts integer default 0,
    last_attempt_at timestamp with time zone,
    created_at timestamp with time zone default now()
);

-- 3. Indexes
CREATE INDEX idx_webhook_sub_user ON misir.webhook_subscription(user_id);
CREATE INDEX idx_webhook_event_status ON misir.webhook_event(status);

-- 4. RLS Policies
ALTER TABLE misir.webhook_subscription ENABLE ROW LEVEL SECURITY;
ALTER TABLE misir.webhook_event ENABLE ROW LEVEL SECURITY;

-- Subscriptions: Users can only see/manage their own
CREATE POLICY "Users can manage own webhook subscriptions"
    ON misir.webhook_subscription
    FOR ALL
    USING (auth.uid() = user_id);

-- Events: Users can view logs for their subscriptions
CREATE POLICY "Users can view own webhook events"
    ON misir.webhook_event
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM misir.webhook_subscription s
            WHERE s.id = webhook_event.subscription_id
            AND s.user_id = auth.uid()
        )
    );

COMMIT;
