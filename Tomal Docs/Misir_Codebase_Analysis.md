# Misir Codebase Analysis

**Date:** February 11, 2026  
**Scope:** `d:\misir` (Archive excluded per request)

**Summary**
The repo is a three-part product: a FastAPI backend in a DDD layout, a Next.js App Router frontend, and a Chrome extension for capture. The backend is the most complete and includes analytics, profiles, insights, and RFC 9457 error handling. The frontend is feature-rich and wired to the backend with TanStack Query, but a few type mismatches and env hygiene issues remain. The extension is scaffolded with Vite and contains capture logic, but has not been fully validated end-to-end in this branch.

**Repo Map**
- `backend/` FastAPI service with DDD layers, handlers, repositories, analytics, profile, and insights.
- `frontend/` Next.js 16 App Router UI with dashboard, analytics, search, settings, and AI-assisted space creation.
- `extension/` Chrome extension for capture, built with Vite and MV3 manifest.
- `database/` schema and migrations (`v1.0`, `v1.1`, `latest`).
- `Docs/` internal docs (implementation TODOs, deployment checklists).
- Root docs: `MISIR_DASHBOARD_SPECIFICATION.md`, `IMPLEMENTATION_STATUS.md`, `FRONTEND_READINESS_REPORT.md`.

**Backend**
- Architecture: DDD with `domain/`, `application/`, `infrastructure/`, `interfaces/` boundaries. Entry point at `backend/main.py`.
- API surface (v1): capture, artifacts CRUD, spaces, subspaces, search, analytics (space and global), insights, profile. Routers in `backend/interfaces/api/`.
- Analytics: drift, velocity, confidence, margin distribution endpoints implemented; global analytics exists but uses placeholder values for some fields. See `backend/interfaces/api/analytics.py`.
- Error handling: RFC 9457 Problem Details and centralized error handlers in `backend/main.py` and `backend/core/error_handlers.py`.
- Tests: backend test suite under `backend/tests/` covers embeddings, CRUD, search, enums, and error handling.

**Frontend**
- Stack: Next.js 16 App Router, TypeScript, Tailwind, shadcn/ui, Framer Motion, TanStack Query, Zustand, Recharts.
- Key routes: `/dashboard`, `/dashboard/spaces/[id]`, `/dashboard/analytics`, `/dashboard/search`, `/dashboard/settings`.
- Data layer: `frontend/lib/api/client.ts` implements typed fetch and API namespaces. Hooks in `frontend/lib/api/` map to backend endpoints. React Query provider in `frontend/lib/providers/query-provider.tsx`.
- UI utilities: `frontend/lib/colors.ts`, `frontend/lib/formatters.ts`, `frontend/lib/alerts.ts`, `frontend/lib/animation.ts`.
- AI space generation: Groq integration in `frontend/lib/ai/` with prompt templates and validation. Orchestrated in `frontend/lib/services/space-generation.ts` and used by `frontend/components/spaces/create-space-modal.tsx`.
- Prompt selector logic: `frontend/lib/ai/groq-prompts.ts` now uses a hybrid classifier for `advanced | standard | fast` mode selection:
  - Semantic local classifier (deterministic TF-IDF/centroid scoring) with confidence + margin gating.
  - Keyword regex is used only as a light tie-break boost, not as the primary router.
  - Low-confidence cases can call an LLM fallback classifier; if still uncertain, default is `standard`.

**Extension**
- MV3 manifest at `extension/manifest.json` with Vite build setup.
- Source code in `extension/src/` with capture pipeline and UI. Test notes in `extension/TESTING.md`.

**Database**
- Schemas stored in `database/v1.0/`, `database/v1.1/`, and `database/latest/`.
- Uses pgvector and structured tables for spaces, subspaces, artifacts, signals, profile, and analytics tables.

**What’s Done**
- Backend endpoints for capture, spaces, artifacts, search, analytics (space + global), insights, profile are implemented.
- Frontend dashboard, space detail, search, analytics, settings pages are implemented and wired to API hooks.
- AI generation uses Groq and has prompt/validation logic.
- AI prompt-mode routing is no longer regex-only; it is semantic-first with low-confidence fallback to LLM and deterministic default.
- Backend tests are present and cover critical logic.

**What’s Pending**
- Replace placeholder global analytics values with real computations in `backend/interfaces/api/analytics.py`.
- Validate frontend build on this branch after recent changes (TypeScript gaps noted below).
- End-to-end validation of extension → backend → frontend flows.

**Issues and Risks**
- Groq integration is active; ensure all AI copy and pricing notes stay Groq-aligned as the model/plan evolves.
- Secrets hygiene: local env files are sanitized, but keys should still be rotated in Supabase/Groq to be safe.
- Analytics placeholders: `GET /api/v1/analytics/global` uses dummy values for overall focus, system health, time allocation, and pace by space.
- Space artifacts payloads from `/spaces/{id}/artifacts` omit some fields used by the UI (e.g., `content_source`, `reading_time_min`); frontend currently tolerates missing fields but should be aligned or enriched.

**Notes**
- The `Archive/` directory was excluded from analysis as requested.
- The spec in `MISIR_DASHBOARD_SPECIFICATION.md` aligns with most frontend implementations, but a final spec-to-UI audit is still needed.
