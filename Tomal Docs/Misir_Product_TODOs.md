# Misir Product TODOs

**Date:** February 12, 2026  
**Scope:** Consolidated TODO after full repo sweeps and session fixes across `backend/`, `frontend/`, `extension/`, and `database/`.

## Session Merge Note
- Merged from `Tomal Docs/Misir_Session_Update_2026-02-12.md`.
- This file now reflects:
- completed fixes from this session,
- currently verified status,
- remaining tasks only.

## Verification Snapshot
- `frontend`: `npm run build` passed.
- `frontend`: `npm run test:intent-classifier` passed.
- `extension`: `npm run build` passed.
- API contract script (`frontend/scripts/verify-api-contract.mjs`) passed (`26` routes matched).
- Backend full/targeted tests were previously green in this cycle (`69 passed` + targeted regressions).

## P0 - Active Blockers (Do First)
- End-to-end live validation pass with extension capture:
- Verify captures appear immediately in space library after click.
- Verify no new offline-queue retry loops or stuck items in worker logs.
- Verify Topic Areas (`items`, `last active`) updates after fresh captures.
- Verify Insights charts (`Focus Over Time`, `Reading Pace`) populate after enough fresh signal history.
- Backfill old spaces created before marker-hardening:
- Regenerate/repair underfilled subspace markers so legacy spaces follow new marker minimums.
- Eliminate residual weekly report runtime/API errors (if still reproducible in current branch) and confirm problem responses are rendered cleanly in UI.

## P1 - High Priority
- Strengthen integration test coverage:
- `POST /api/v1/artifacts/capture` success path with realistic payloads.
- Space analytics population tests for non-empty confidence/velocity history.
- Topic-area activity update tests after artifact ingest.
- Add operational diagnostics:
- marker-repair invocation count,
- strict marker-validation failure count,
- prompt-mode fallback count (`semantic` -> `llm`/`fallback`).
- Optimize analytics endpoints to reduce per-subspace history N+1 reads where still present.

## P2 - Medium Priority
- Continue extension startup/perf profiling after bundle reduction:
- measure cold-start time,
- verify content-script injection timing remains stable.
- Improve marker quality beyond minimum count (semantic diversity / near-synonym suppression).
- Remove remaining placeholder UX paths and mock-auth fallback guardrails where still active.
- Resolve remaining Pydantic v2 deprecations and warning cleanup.
- Add better observability:
- structured error IDs in Problem responses,
- dashboard-level queue health/retry visibility.

## P3 - Nice to Have
- Add realtime updates (Supabase subscriptions) for new artifacts/alerts to reduce polling load.
- Add i18n scaffolding.
- Add performance profiling and caching strategy for large knowledge maps and analytics pages.

## Completed Recently (This Session + Prior)
- Capture pipeline reliability and schema alignment fixes:
- queue retries, enum normalization, RPC alignment, and ingest-path hardening.
- Backend error-handling fixes:
- eliminated non-exception raise path in capture endpoint.
- Analytics resilience fixes:
- handled `signal` object/list payload differences in alerts path.
- Frontend robustness updates:
- knowledge map canvas lifecycle null-guard and related runtime stability fixes.
- Extension enum normalization completed to backend-native values (`latent/discovered/engaged/saturated`, `web/pdf/video/chat/note/other`).
- Capture queue stability improved (missing-item update handled gracefully instead of hard failure).
- Backend capture endpoint now returns Problem responses correctly instead of raising non-exception response objects.
- Space alerts endpoint now handles `signal` as both object and array to prevent runtime crashes.
- AI prompt selector upgraded from regex-only routing to hybrid semantic classification with confidence gating, low-confidence LLM fallback, and deterministic `standard` fallback.
- Added frontend intent-classifier tests and runner (`npm run test:intent-classifier`) to lock selector behavior.
- Implemented marker-generation hardening:
- strict mode marker minimums (`standard 4-6`, `advanced 5-6`, `fast 3-4`),
- two-phase validation (relaxed -> repair -> strict),
- added marker repair merge logic and unit tests.
- Validation/build checks re-run successfully after AI hardening patch.

## Archived: Blockers Already Verified as Fixed
- Backend test regression (`SearchResult` constructor mismatch) fixed.
- Batch capture auth/user wiring fixed (derive user from JWT flow).
- Space configuration page mock data removed in favor of real API data.
- Dashboard space status placeholder logic replaced with real analytics signals.
- Report page mock analytics replaced with real global/per-space analytics.
