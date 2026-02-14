# System Architecture Overview

> **Pattern:** Domain-Driven Design (DDD)  
> **Framework:** FastAPI + Supabase  
> **Version:** 1.4  
> **Status:** Production Ready

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MISIR SYSTEM ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │  EXTENSION  │    │   WEB APP   │    │   BACKEND   │    │  DATABASE   │  │
│  │   (Sensor)  │───►│  (Next.js)  │───►│  (FastAPI)  │───►│ (PostgreSQL)│  │
│  └─────────────┘    └─────────────┘    └──────┬──────┘    └─────────────┘  │
│                                               │                             │
│                                        ┌──────┴──────┐                      │
│                                        │             │                      │
│                           ┌────────────┴─┐    ┌──────┴────────┐            │
│                           │  EMBEDDING   │    │  ALGORITHMS   │            │
│                           │   SERVICE    │    │   ENGINE      │            │
│                           │  (Nomic AI)  │    │ (OSCL/WESA)   │            │
│                           └──────────────┘    └───────────────┘            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Backend Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INTERFACES                                      │
│                   (API Routes, DTOs, HTTP Layer)                            │
│                     interfaces/api/                                         │
└─────────────────────────┬───────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            APPLICATION                                       │
│                    (Command Handlers, Use Cases)                            │
│                       application/handlers/                                 │
└─────────────────────────┬───────────────────────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
┌─────────────────────┐     ┌─────────────────────────────────────────────────┐
│       DOMAIN        │     │             INFRASTRUCTURE                      │
│ (Entities, Commands,│     │      (Repositories, External Services)         │
│   Value Objects)    │     │         infrastructure/                        │
│     domain/         │     │                                                 │
└─────────────────────┘     └─────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CORE                                           │
│                  (Config, Logging, Shared Utilities)                       │
│                            core/                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Domain Layer (`domain/`)
**Purpose:** Pure business logic, no external dependencies.

| Component | Description | Examples |
|-----------|-------------|-----------|
| **Entities** | Domain objects with identity | `Artifact`, `Signal`, `Subspace` |
| **Value Objects** | Immutable data types | `EngagementLevel`, `EmbeddingVector` |
| **Commands** | Request DTOs | `CaptureArtifactCommand` |

**Rules:**
- No imports from `infrastructure/` or `interfaces/`
- No database logic
- Pure Python, easily testable

### 2. Application Layer (`application/`)
**Purpose:** Orchestrate use cases, coordinate domain and infrastructure.

| Component | Description | Examples |
|-----------|-------------|-----------|
| **Handlers** | Command handlers | `CaptureHandler`, `SearchHandler` |

**Rules:**
- Receives commands from interfaces
- Validates, logs, delegates to repositories  
- Never computes (DB is arbiter)

### 3. Infrastructure Layer (`infrastructure/`)
**Purpose:** External systems integration.

| Component | Description | Examples |
|-----------|-------------|-----------|
| **Repositories** | Database access | `ArtifactRepository`, `SpaceRepository` |
| **Services** | External APIs | `EmbeddingService`, `WebhookService` |

**Rules:**
- RPC-based writes (atomic transactions)
- Command-shaped operations (no generic `.save()`)
- Supabase client management

### 4. Interfaces Layer (`interfaces/`)
**Purpose:** Entry points for external communication.

| Component | Description | Examples |
|-----------|-------------|-----------|
| **API** | FastAPI routes | `capture.py`, `search.py` |
| **DTOs** | Request/Response models | `CaptureRequest`, `SearchResponse` |

**Rules:**
- Thin layer (parse request, call handler, return response)
- JWT authentication enforcement
- Rate limiting and validation

## Design Principles

### 1. DB is Arbiter
The backend validates data *shape*, but the Database enforces *semantics* and *constraints*.
- URL normalization happens in DB triggers
- Engagement level ordering enforced by DB
- Centroid updates computed by DB

### 2. Command-Shaped Writes
No generic `.save()` methods. We use explicit commands:
- `CaptureArtifactCommand` → `ingest_with_signal` RPC
- `CreateSpaceCommand` → `create_space` method
- `UpdateArtifactCommand` → `update_artifact` method

### 3. Fail-Soft Configuration
System configuration relies on defaults if the DB config table is unreachable:
- `ConfigCache` with TTL and fallbacks
- Never crashes due to missing configuration
- Graceful degradation

### 4. Append-Only Semantics
Signals are immutable logs of user engagement:
- Signals never updated, only created
- State is derived from signal history
- Enables replay and audit capabilities

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **API** | FastAPI | High-performance async API framework |
| **Database** | PostgreSQL + pgvector | Relational DB with vector extensions |
| **ORM** | Supabase Client | Database client with RLS support |
| **Embedding** | Nomic AI Embed v1.5 | 768-dim semantic embeddings |
| **Search** | HNSW Index | Approximate nearest neighbor search |
| **Auth** | Supabase Auth | JWT-based authentication |
| **Monitoring** | Prometheus + Grafana | Metrics and observability |
| **Testing** | pytest | Unit and integration testing |

## Data Flow

### Artifact Capture Flow
```
1. Extension/Frontend → POST /api/v1/artifacts/capture
2. CaptureRequest → JWT Auth → CaptureArtifactCommand
3. CaptureHandler validates → ArtifactRepository
4. Repository → insert_artifact_with_signal RPC
5. DB Triggers → URL normalize, domain extract, centroid update
6. Webhook dispatch (fire-and-forget)
7. Response → CaptureResponse with artifact_id, signal_id
```

### Search Flow
```
1. Frontend → GET /api/v1/search?q=query
2. JWT Auth → SearchCommand
3. SearchHandler → EmbeddingService (embed query)
4. Repository → HNSW vector search
5. Results ranked by similarity
6. Response → SearchResponse with artifacts
```

## Next: Detailed Views

- [Domain Model Details](domain-model.md)
- [Algorithm Specification](algorithms.md)
- [Canonical API/Architecture Reference](../../Tomal Docs/Misir_Full_Project_Documentation_2026-02-14.md)
