-- Migration: Add Signals table for Brimstone (Auditability)
-- Assumes 'artifacts', 'spaces', 'subspaces' already exist.

-- 1. Signals Table
-- This is unique to Brimstone. It tracks the mathematical "events" that occur.
create table if not exists signals (
    id uuid primary key default gen_random_uuid(),
    artifact_id uuid references public.artifacts(id) on delete cascade,
    space_id uuid references public.spaces(id),
    subspace_id uuid references public.subspaces(id),
    
    vector vector(384),    -- The semantic position (assuming all-MiniLM-L6-v2)
    magnitude float not null default 1.0,
    signal_type text not null, -- 'semantic', 'temporal', 'behavioral'
    
    created_at timestamptz not null default now()
);

-- 2. Indexes for Speed
create index if not exists signals_vector_idx on signals using hnsw (vector vector_cosine_ops);
create index if not exists signals_artifact_idx on signals(artifact_id);
create index if not exists signals_space_idx on signals(space_id);
