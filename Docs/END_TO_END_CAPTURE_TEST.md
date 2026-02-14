# End-to-End Capture Test

**Date:** February 11, 2026  
**Scope:** Extension → Backend → Frontend visibility

## Summary
- Backend health check: ✅ `GET /health` returned 200.
- Extension capture + frontend visibility: ⚠️ Requires manual browser actions (see steps below).

## Environment
- Backend: `uvicorn main:app --host 127.0.0.1 --port 8000`
- Frontend: `npm run dev` (Next.js)
- Extension: `npm run dev` or `npm run build` and load `extension/dist` in Chrome

## Steps (Manual)
1. Start backend:
   - From `backend/`:
     - `..\.venv\Scripts\python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000`
2. Start frontend:
   - From `frontend/`:
     - `npm run dev`
3. Start extension:
   - From `extension/`:
     - `npm run build`
   - In Chrome: `chrome://extensions` → Load unpacked → select `extension/dist`.
4. Sign in / Sign up in the frontend app.
5. Visit a test URL and use the extension to capture.
6. Verify in frontend:
   - `Dashboard` → “Recently Saved” shows the item.
   - `Spaces` → open space → `Library` tab shows the artifact.
   - `Analytics` pages reflect updated counts.

## Validation Notes
- **Backend health**: Verified `http://127.0.0.1:8000/health` returned 200.
- **Supabase auth**: Sign-up flow works after updating `NEXT_PUBLIC_SUPABASE_*`.
- **Extension + UI**: Pending manual confirmation.

## Expected Outputs
- Capture endpoint returns success with `artifact_id` and `signal_id`.
- Artifact appears within 5–10 seconds in frontend lists.
- Activity heatmap updates once new artifacts exist.
