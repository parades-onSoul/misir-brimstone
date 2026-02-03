-- Enable pgvector extension
create extension if not exists vector;

-- Artifacts Table (The Source of Truth)
create table if not exists artifacts (
    id uuid primary key,
    content text not null,
    source_url text,
    artifact_type text not null,
    created_at timestamptz not null,
    metadata jsonb default '{}'::jsonb,
    content_hash text unique -- Idempotency
);

-- Spaces / Subspaces Table
create table if not exists spaces (
    id uuid primary key,
    name text not null,
    centroid vector(768), -- Nomic Embed v1.5 dimension
    confidence float default 1.0,
    last_updated timestamptz default now(),
    -- For simplified single-user MVP, we might assume one root space or link to user
    user_id uuid
);

-- Markers Table (Keywords for Subspaces)
create table if not exists markers (
    id uuid primary key default gen_random_uuid(),
    space_id uuid references spaces(id) on delete cascade,
    term text not null,
    weight float not null,
    confidence float not null,
    source_artifact_ids uuid[] default '{}'
);

-- Signals Table ( The Mathematical Events )
create table if not exists signals (
    id uuid primary key,
    artifact_id uuid references artifacts(id),
    space_id uuid references spaces(id),
    
    vector vector(768), -- Nomic Embed v1.5 (768-dim, 8k context)
    magnitude float not null,
    signal_type text not null,
    created_at timestamptz not null
);

-- Indexes for Speed
create index on signals using hnsw (vector vector_cosine_ops);
create index on artifacts (content_hash);
