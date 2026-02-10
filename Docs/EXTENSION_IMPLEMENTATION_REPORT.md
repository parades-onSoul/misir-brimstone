# Misir Chrome Extension Implementation Review

**Date:** 2026-02-09

**Scope reviewed**
- Manifest/build pipeline: `extension/manifest.json`, `extension/vite.config.ts`, `extension/scripts/patch-service-worker.js`
- Background/service worker: `extension/src/background/*.ts`
- Content scripts: `extension/src/content/*.ts`
- Popup/settings UI: `extension/src/popup/*`, `extension/src/settings/*`
- API/auth/storage: `extension/src/api/*`, `extension/src/storage/queue.ts`
- Debug tooling: `extension/debug-storage.html`, `extension/TESTING.md`

## Overall verdict
The extension is **mostly complete** and likely works when built and loaded from `dist`, but there are **four correctness issues** that will cause real runtime failures or missing functionality in common flows. Fixing the issues below will make the implementation reliable and aligned with MV3 constraints.

---

## Finding 1 — Mock auth flow cannot fetch spaces
**Problem**
The “mock auth” path is intended to use a stored `userId` from config, but `fetchSpaces()` always calls `getAuthUserId()` which **throws if not authenticated**. This breaks the fallback flow when a user skips Supabase login.

**Impact**
- Users who choose “Continue with Mock Auth” will not see any spaces.
- Capture can’t proceed because `selectedSpaceId` is never populated.

**Evidence**
- `fetchSpaces()` only uses `getAuthUserId()` and never falls back to config. `extension/src/api/client.ts:119-129`
- `getAuthUserId()` throws when not authenticated. `extension/src/api/supabase.ts:232-236`
- Popup calls `FETCH_SPACES` when unauthenticated. `extension/src/popup/App.tsx:360-372`

**Solution**
Update `fetchSpaces()` to use config userId when Supabase auth is absent. Two options:
- Preferred: change `fetchSpaces()` to call `getConfig()` first, and only call `getAuthUserId()` if authenticated.
- Alternative: update `getAuthUserId()` to read `chrome.storage.local.userId` as a fallback.

**Why this solution**
This preserves the intended “mock auth” behavior already used in the UI while keeping Supabase auth as the primary path. It aligns with the app’s own UX logic and avoids hard failures for non-authenticated users.

---

## Finding 2 — Offline queue auto-retry never triggers in MV3
**Problem**
The service worker listens for `window.addEventListener('online'/'offline')`, but in an MV3 service worker there is no `window` and those events do not fire. The stubs defined in the worker make the calls no-ops, so the queue never automatically drains.

**Impact**
- Captures queued while offline are never retried automatically.
- The “automatic retry on network restoration” behavior in `queue.ts` is effectively disabled.

**Evidence**
- Online/offline listeners are registered on `window`. `extension/src/background/index.ts:311-323`
- `window` is stubbed in the service worker (no real events). `extension/src/background/worker.ts:15-49`

**Solution**
Move retry logic to MV3-supported events:
- Add queue processing to the existing alarm tick (or create a dedicated alarm) and check `navigator.onLine` before retrying.
- Optionally call `processQueue()` on `chrome.runtime.onStartup` and `chrome.runtime.onInstalled` to catch restarts.

**Why this solution**
`chrome.alarms` and runtime lifecycle events are reliable in MV3 service workers and do not depend on DOM events. This restores the intended “automatic retry” behavior in an environment that lacks `window`.

---

## Finding 3 — NLP service worker detection is broken by stubs
**Problem**
The NLP engine checks `typeof document === 'undefined'` to detect service worker context. But the service worker bootstrap **creates a fake `document`**, so this check fails and the code attempts to load `wink-nlp` in the service worker, which it explicitly tries to avoid.

**Impact**
- Unnecessary (and potentially failing) `wink-nlp` load attempts in the service worker.
- Higher memory and startup cost in the background worker.

**Evidence**
- `document` is stubbed in the worker. `extension/src/background/worker.ts:52-68`
- NLP checks for `document` to detect SW and decide fallback. `extension/src/classify/nlp.ts:26-35`
- The post-build loader also stubs `document` before loading the worker. `extension/scripts/patch-service-worker.js`

**Solution**
Use a robust service-worker detection signal that is not affected by DOM stubs, for example:
- `const isSW = typeof ServiceWorkerGlobalScope !== 'undefined' && self instanceof ServiceWorkerGlobalScope;`
- Or set a global flag in the loader: `globalThis.__MISIR_IS_SW = true` and check that in `nlp.ts`.

**Why this solution**
It preserves the intended fallback behavior without depending on `document`, which is now artificial. The check becomes accurate in both real DOM pages and service workers.

---

## Finding 4 — `debug-storage.html` violates MV3 CSP
**Problem**
The debug page uses inline `<script>...</script>`, but MV3’s default CSP blocks inline scripts. The TESTING guide recommends using this page, but it will not run as written.

**Impact**
- Storage debug tool won’t function when opened as an extension page.

**Evidence**
- Inline script in `debug-storage.html`. `extension/debug-storage.html:47-65`
- No custom CSP defined in `manifest.json` (default MV3 CSP forbids inline scripts). `extension/manifest.json`

**Solution**
Move the inline script into a separate JS file, e.g. `extension/debug-storage.js`, and reference it with `<script src="debug-storage.js"></script>`.

**Why this solution**
External scripts are allowed by MV3 CSP, while inline scripts are not. This keeps the debug tool functional without weakening CSP.

---

## Summary
The extension architecture is solid (MV3 service worker, content script, popup/options, queueing), but the four items above will cause real failures in common use. Fixing them will make the implementation reliable in both authenticated and mock-auth modes and ensure the offline queue and debug tooling work as intended.
