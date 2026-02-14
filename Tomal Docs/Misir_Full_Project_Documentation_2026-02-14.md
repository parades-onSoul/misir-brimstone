# Misir Full Project Documentation (Current State)

**Date:** February 14, 2026  
**Repo Root:** `d:\misir`  
**Audience:** Product, backend, frontend, extension, DevOps, QA

## 1. Purpose and Scope

This is the canonical technical documentation for the current Misir system state.

It covers:
- Full architecture (backend, frontend, extension, database)
- Data model and core algorithms
- API and message contracts
- Runtime configuration and sensitivity tuning
- Local setup, run, test, and troubleshooting
- Code navigation map by feature

If an older document conflicts with this file, use this file as source of truth.

---

## 2. Repository Map

Top-level modules:
- `backend/`: FastAPI service (DDD-style layering)
- `frontend/`: Next.js dashboard (App Router)
- `extension/`: MV3 browser extension (`Misir Sensor`)
- `database/`: SQL schema + migrations (`v1.0` to `v1.5`)
- `Docs/`: legacy focused docs (architecture, references, deployment)
- `Tomal Docs/`: working docs and current operational docs

Primary active entry points:
- Backend app: `backend/main.py`
- Frontend app shell: `frontend/app/layout.tsx`
- Extension worker entry: `extension/src/background/worker.ts`
- Latest DB overview: `database/latest/README.md`

---

## 3. End-to-End Architecture

### 3.1 High-level flow

1. User reads content in browser.
2. Extension content script scrapes page + engagement metrics.
3. Extension background worker classifies and sends capture payload to backend.
4. Backend validates/authenticates, computes embedding/margin/assignment, writes artifact+signal via DB RPC.
5. Frontend reads spaces/artifacts/analytics from backend and renders dashboards.

### 3.2 System responsibilities

- Extension: sensing, lightweight gating, retries/offline queue, auto-capture orchestration
- Backend: canonical ingestion logic, auth, assignment, analytics, search APIs
- Database: persistence, vector ops, centroid updates, assignment/search RPCs
- Frontend: visualization, workflows, AI-assisted space generation

---

## 4. Database Design and Migrations

## 4.1 Versioning

Migration path:
- Base: `database/v1.0/schema.sql`
- Security: `database/v1.0/security-fixes.sql`
- Then: `v1.1`, `v1.2`, `v1.3`, `v1.4`, `v1.5`

Current latest docs:
- `database/latest/README.md`
- `database/v1.5/README.md`

## 4.2 Core entities (misir schema)

Primary tables:
- `space`: top-level knowledge container
- `subspace`: topic cluster inside a space
- `artifact`: captured content unit
- `signal`: embedding + engagement signal linked to artifact
- `marker`: semantic anchors for subspaces
- `subspace_marker`: marker-to-subspace association (weights)
- `system_config`: runtime tuning knobs
- analytics/event tables: centroid history, insights, logs

## 4.3 Enums in active use

- `engagement_level`: `latent`, `discovered`, `engaged`, `saturated`
- `content_source`: `web`, `pdf`, `video`, `chat`, `note`, `other`

## 4.4 v1.5 Matryoshka additions

File: `database/v1.5/matryoshka-search-migration.sql`

Adds:
- `signal.vector_384`
- `subspace.centroid_embedding_384`
- sync triggers for shadow 384 vectors
- HNSW indexes for coarse retrieval
- RPCs:
  - `misir.search_signals_by_vector_matryoshka(...)`
  - `misir.calculate_assignment_margin_matryoshka(...)`

## 4.5 Sensitivity tuning

File: `database/v1.5/sensitivity-tuning.sql`

Sets:
- `system_config.assignment_margin_threshold = 0.05`

---

## 5. Backend Architecture

## 5.1 Layers

- `backend/interfaces/`: HTTP/API layer
- `backend/application/`: command handlers and orchestration
- `backend/domain/`: entities/commands/value objects
- `backend/infrastructure/`: repos + external services
- `backend/core/`: config, middleware, logging, error handling

## 5.2 Application entry and routers

App entry: `backend/main.py`

Mounted API prefixes:
- `/api/v1/artifacts`: capture, batch, artifact CRUD/classification
- `/api/v1`: spaces, subspaces, search, global analytics, insights, profile
- `/api/v1/spaces`: space analytics namespace
- internal dashboard: `/dashboard`, `/dashboard/api`

## 5.3 Auth model

- Backend validates bearer token using Supabase (`client.auth.get_user(token)`)
- User ID is server-derived from JWT on protected routes

## 5.4 Error model

- RFC 9457 style problem details via `fastapi-problem`
- Central handlers in `backend/core/error_handlers.py`
- API client code is expected to handle structured problem payloads

## 5.5 Key backend algorithms and methods

### 5.5.1 Embedding service

File: `backend/infrastructure/services/embedding_service.py`

Methods:
- `embed_text(text, dim?)`
- `embed_query(query, dim?)`
- `embed_batch(texts, dim?)`

Behavior:
- Lazy thread-safe model load
- Supports Matryoshka dims: `768, 384, 256, 128, 64`
- Prefix strategy:
  - docs: `search_document:`
  - queries: `search_query:`
- Truncation + L2 renormalization after truncation

### 5.5.2 Assignment margin service

File: `backend/infrastructure/services/margin_service.py`

Method:
- `calculate_margin(signal_vector, user_id, space_id)`

Rule:
- `margin = d2 - d1`
- `updates_centroid = margin >= assignment_margin_threshold`

Execution order:
1. Try Matryoshka RPC
2. Fallback legacy RPC
3. Fallback local cosine calculation

### 5.5.3 Capture orchestration

Files:
- API layer: `backend/interfaces/api/capture.py`
- Handler: `backend/application/handlers/capture_handler.py`

Pipeline:
1. Validate/auth input
2. Generate embedding if absent
3. Derive marker hints from text + marker embeddings
4. Resolve subspace via margin and marker fallback logic
5. Repair legacy marker/centroid embeddings and retry assignment when needed
6. Persist via repository (`insert_artifact_with_signal` RPC path)
7. Emit webhook event (best-effort)

### 5.5.4 Subspace analytics

File: `backend/infrastructure/services/subspace_analytics.py`

Methods and formulas:
- `calculate_drift(prev, new)`: `1 - cosine_similarity`
- `calculate_velocity(prev, new, dt)`: `||new-prev|| / dt`
- `calculate_batch_coherence(embeddings, centroid)`: mean cosine similarity
- `update_confidence(current, coherence, alpha)`: EMA
  - `new = (1 - alpha) * current + alpha * coherence`

### 5.5.5 Reading depth consistency check

File: `backend/application/handlers/capture_handler.py`

Important:
- Backend does not overwrite reading depth
- Logs suspicious mismatch vs expected model:
  - `expected_time = word_count * 60000 / avg_wpm`
  - `time_ratio = min(max_ratio, dwell_time / expected_time)`
  - `expected_depth = time_ratio*time_weight + scroll_depth*scroll_weight`

---

## 6. Backend API Contract (Current)

Base URL default: `http://127.0.0.1:8000/api/v1`

### 6.1 Artifacts namespace (`/artifacts`)
- `POST /artifacts/capture`
- `POST /artifacts/batch`
- `GET /artifacts`
- `PATCH /artifacts/{artifact_id}`
- `DELETE /artifacts/{artifact_id}`
- `POST /artifacts/classify`
- `GET /artifacts/classify/status`

### 6.2 Spaces namespace
- `GET /spaces`
- `POST /spaces`
- `GET /spaces/{space_id}`
- `PATCH /spaces/{space_id}`
- `DELETE /spaces/{space_id}`
- `GET /spaces/{space_id}/timeline`
- `GET /spaces/{space_id}/artifacts`
- `GET /spaces/{space_id}/alerts`

### 6.3 Subspaces
- `GET /spaces/{space_id}/subspaces`
- `POST /spaces/{space_id}/subspaces`
- `PATCH /spaces/{space_id}/subspaces/{subspace_id}`
- `DELETE /spaces/{space_id}/subspaces/{subspace_id}`
- `POST /spaces/{space_id}/subspaces/{subspace_id}/merge`

### 6.4 Search
- `GET /search`

### 6.5 Analytics
- `GET /analytics/global`
- `GET /spaces/{space_id}/analytics`
- `GET /spaces/{space_id}/topology`
- `GET /spaces/{space_id}/analytics/drift`
- `GET /spaces/{space_id}/analytics/velocity`
- `GET /spaces/{space_id}/analytics/confidence`
- `GET /spaces/{space_id}/analytics/margin_distribution`
- `GET /spaces/{space_id}/analytics/alerts`

### 6.6 Profile + Insights
- `GET /profile`
- `PATCH /profile`
- `POST /profile/onboard`
- `PATCH /profile/metadata`
- `GET /insights/`
- `POST /insights/generate`

### 6.7 Internal dashboard
- `GET /dashboard`
- `GET /dashboard/api`

---

## 7. Frontend Architecture

## 7.1 Stack

- Next.js 16 App Router
- React 19
- TypeScript
- TanStack Query
- Tailwind + shadcn/ui
- Recharts + Pixi.js for visualization

## 7.2 Route map (`frontend/app`)

Public:
- `/`
- `/login`
- `/signup`
- `/confirm-email`
- `/onboarding`

Dashboard:
- `/dashboard`
- `/dashboard/spaces`
- `/dashboard/spaces/[id]`
- `/dashboard/spaces/[id]/configuration`
- `/dashboard/artifacts`
- `/dashboard/artifacts/[id]`
- `/dashboard/analytics`
- `/dashboard/search`
- `/dashboard/report`
- `/settings`

## 7.3 Frontend data layer

Core file: `frontend/lib/api/client.ts`

Design:
- Shared `ApiClient` with typed namespaces
- Structured API problem logging
- Network retry for fetch failures
- Supabase token sync from `useAuth` hook

Main integration points:
- `frontend/hooks/use-auth.ts`: token -> API client
- `frontend/lib/api/*.ts`: query hooks
- `frontend/lib/stores/search.ts`: search UI state
- `frontend/scripts/verify-api-contract.mjs`: route parity checker

## 7.4 AI space generation (frontend)

Primary files:
- `frontend/lib/ai/groq.ts`
- `frontend/lib/ai/groq-prompts.ts`
- `frontend/lib/ai/validation.ts`
- `frontend/lib/services/space-generation.ts`

Prompt mode selection:
- Modes: `advanced`, `standard`, `fast`
- Classifier: deterministic semantic TF-IDF centroid classifier
- Confidence gate with optional LLM fallback classifier
- Low-confidence fallback defaults to `standard`

Marker hardening:
- Mode-specific marker min/max constraints
- Repair pass for underfilled marker sets
- Dedup + quality validation before output accepted

## 7.5 Focus threshold normalization

Shared constants file:
- `frontend/lib/focus-thresholds.ts`

Current values:
- High focus threshold: `0.55`
- Medium threshold: `0.35`

Used by:
- analytics coloring
- coverage analysis buckets
- knowledge map coloring
- formatters and UI labels

---

## 8. Extension Architecture

## 8.1 Build/runtime

- Manifest V3 extension
- Background service worker module entry: `extension/src/background/worker.ts`
- Worker loads globals guard then imports `extension/src/background/index.ts`

Build script:
- `npm run build` -> Vite build + `scripts/patch-service-worker.js`

## 8.2 Main extension modules

- `src/content/`: scraping and metrics tracking
- `src/background/`: orchestration + message bus
- `src/api/`: backend and Supabase API clients
- `src/storage/queue.ts`: IndexedDB offline queue
- `src/popup/`: user popup UI
- `src/settings/`: options/settings page

## 8.3 Background message contract

Messages handled in `extension/src/background/index.ts`:
- `GET_CONFIG`, `SET_CONFIG`
- `FETCH_SPACES`, `CAPTURE`
- `HEALTH_CHECK`, `GET_RECENT`
- `GET_NLP_STATUS`, `CLASSIFY_CONTENT`
- `GET_QUEUE`, `PROCESS_QUEUE`, `CLEAR_QUEUE`
- `SIGN_IN`, `SIGN_OUT`, `GET_AUTH_STATE`, `REFRESH_SESSION`
- `FETCH_SPACES_SUPABASE`, `FETCH_SUBSPACES_SUPABASE`, `FETCH_MARKERS_SUPABASE`

## 8.4 Offline queue algorithm

File: `extension/src/storage/queue.ts`

Mechanics:
- IndexedDB store: `misir-queue/captures`
- Each item stores payload + retries + next retry time
- Exponential backoff:
  - 1s, 2s, 4s, ... capped at 60s
- Duplicate processing guard with `activeQueueProcess`
- Queue processed on install/startup/alarm and manual trigger

## 8.5 Auto-capture logic

Implemented in `runAutoCaptureCycle` (`extension/src/background/index.ts`):

Gate sequence:
1. Extension enabled + auto-capture enabled
2. Resolved target space
3. Active HTTP tab and successful scrape
4. `wordCount >= minWordCount`
5. `dwellTime >= minDwellTimeMs`
6. URL cooldown check (dedup window)
7. Backend classification
8. `confidence >= autoCaptureConfidenceThreshold` (default `0.55`)
9. Engagement not `latent`
10. Capture call or queue on failure

---

## 9. Core Product Flows

## 9.1 Manual capture flow

1. User opens popup and chooses space.
2. Popup sends `CAPTURE` message.
3. Background classifies and sends `/artifacts/capture`.
4. Backend writes artifact/signal and resolves assignment.
5. Popup receives success and updates recent list.
6. Frontend dashboard reflects new item through API polling/query refresh.

## 9.2 Auto-capture flow

1. Alarm/startup triggers queue processing + auto-capture cycle.
2. If relevance and confidence pass gates, payload sent to backend.
3. On failure, payload queued and retried later.

## 9.3 Search flow

1. Frontend search page uses default threshold `0.55`.
2. Backend embeds query and routes semantic search.
3. DB Matryoshka coarse-to-fine RPC may be used for candidate retrieval and rerank.

## 9.4 Analytics flow

1. Capture updates artifacts/signals/subspace state.
2. Analytics endpoints aggregate drift/velocity/confidence/margins.
3. Frontend renders topology, trend lines, coverage analysis, alerts.

---

## 10. Configuration and Environment

## 10.1 Backend env (`backend/.env`)

Required:
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `SUPABASE_SERVICE_KEY`

Optional common:
- `CORS_ORIGINS`
- `EMBEDDING_MODEL`
- `LOG_LEVEL`
- rate-limit config

Template:
- `backend/.env.example`

## 10.2 Frontend env (`frontend/.env.local`)

Required for full functionality:
- `NEXT_PUBLIC_API_URL` (default in code fallback)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_GROQ_API_KEY` (AI space generation)

Template:
- `frontend/.env.local.example`

## 10.3 Extension config

Stored in `chrome.storage.local` via `getConfig()/setConfig()`.

Important defaults:
- API URL normalized to `/api/v1`
- `autoCaptureConfidenceThreshold`: `0.55`
- `autoCaptureCooldownMs`: `1800000` (30 min)

---

## 11. Local Runbook

## 11.1 Backend

```powershell
cd backend
..\.venv\Scripts\python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Health:
- `GET http://127.0.0.1:8000/health`

## 11.2 Frontend

```powershell
cd frontend
npm install
npm run dev
```

App:
- `http://localhost:3000`

## 11.3 Extension

```powershell
cd extension
npm install
npm run build
```

Load unpacked:
- `chrome://extensions` -> Developer mode -> Load unpacked -> `extension/dist`

---

## 12. Testing and Validation

## 12.1 Frontend

```powershell
cd frontend
npm run build
npm run verify:api-contract
npm run test:intent-classifier
```

## 12.2 Backend

```powershell
cd backend
..\.venv\Scripts\python -m pytest -m "not slow"
```

## 12.3 Extension

```powershell
cd extension
npm run build
```

## 12.4 DB smoke checks (v1.5)

1) Backfill coverage:
```sql
select
  count(*) filter (where vector is not null) as signal_total,
  count(*) filter (where vector_384 is not null) as signal_with_384,
  count(*) filter (where centroid_embedding is not null) as subspace_with_768_centroid,
  count(*) filter (where centroid_embedding_384 is not null) as subspace_with_384_centroid
from misir.signal s
cross join misir.subspace ss;
```

2) Matryoshka search RPC (use a real user id / query vectors):
- `misir.search_signals_by_vector_matryoshka(...)` should return rows.

3) Assignment margin RPC:
- `misir.calculate_assignment_margin_matryoshka(...)` should return a row with margin and updates flag.

---

## 13. Sensitivity and Tuning Knobs

Primary knobs:
- `assignment_margin_threshold` in `misir.system_config` (currently `0.05`)
- frontend search threshold default `0.55`
- extension auto-capture confidence threshold default `0.55`

Where to tune:
- DB: `database/v1.5/sensitivity-tuning.sql`
- Backend fallback: `backend/infrastructure/services/margin_service.py`
- Frontend search defaults: `frontend/lib/stores/search.ts`
- Extension threshold defaults: `extension/src/types.ts`, `extension/src/background/index.ts`, `extension/src/api/client.ts`

---

## 14. Troubleshooting Map

Common symptoms and first checks:

1. Capture queued repeatedly:
- Check backend logs for enum/RLS/RPC errors.
- Validate DB migrations (`v1.5` + sensitivity) applied.

2. Space/topic counts not updating:
- Confirm capture has resolved `subspace_id`.
- Check margin and marker hint paths in `capture.py`.

3. Search too strict/too loose:
- Tune threshold (API/UI default currently `0.55`).

4. Hydration mismatch in frontend:
- Check browser extensions mutating DOM.
- Root layout already uses `suppressHydrationWarning`.

5. Extension "Cannot read this page":
- Expected for browser internal pages (`chrome://`, `chrome-extension://`).

---

## 15. Code Navigation by Task

If you need to...

Capture pipeline behavior:
- `extension/src/background/index.ts`
- `backend/interfaces/api/capture.py`
- `backend/application/handlers/capture_handler.py`
- `backend/infrastructure/repositories/artifact_repo.py`

Search quality/tuning:
- `frontend/app/(dashboard)/dashboard/search/page.tsx`
- `frontend/lib/stores/search.ts`
- `backend/interfaces/api/search.py`
- `database/v1.5/matryoshka-search-migration.sql`

Analytics visualization:
- `frontend/components/space/knowledge-map.tsx`
- `frontend/components/space/space-insights.tsx`
- `backend/interfaces/api/analytics.py`
- `backend/infrastructure/services/subspace_analytics.py`

AI prompt routing and marker generation:
- `frontend/lib/ai/groq-prompts.ts`
- `frontend/lib/ai/groq.ts`
- `frontend/lib/ai/validation.ts`
- `frontend/lib/services/space-generation.ts`

Offline queue/retry behavior:
- `extension/src/storage/queue.ts`
- `extension/src/background/index.ts`
- `extension/src/api/client.ts`

---

## 16. Operational Notes

- Keep backend/frontend/extension threshold constants synchronized after tuning changes.
- Keep migrations idempotent and executed in order.
- Run API contract check after modifying backend routes or frontend client paths.
- Prefer updating this document when system behavior changes.
