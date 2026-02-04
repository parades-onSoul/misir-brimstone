# Misir Developer Handoff Document

**Date:** January 27, 2026  
**Status:** Architecture restructured, frontend connected to backend

---

## Project Overview

Misir is a **semantic attention tracking system** that helps users understand where they're investing their mental energy across different life areas ("spaces"). It consists of:

1. **Chrome Extension** - Captures browsing artifacts passively
2. **FastAPI Backend** - Processes artifacts, generates embeddings, handles sync
3. **Next.js Frontend** - Dashboard for viewing spaces, evidence, insights

---

## Recent Changes (This Session)

### Architecture Restructure
The frontend was doing too much backend work. We separated concerns:

| Component | Responsibility |
|-----------|---------------|
| **Frontend (Next.js)** | UI, embeddings for spaces/subspaces/markers only |
| **Backend (FastAPI)** | Artifacts, sync, evidence calculation, insights, reports |
| **Extension** | Capture artifacts, local matching, sync to backend |

### Key Changes Made

1. **Deleted 12 API routes** from Next.js that duplicated backend functionality:
   - `artifacts/`, `baselines/`, `connections/`, `cron/`, `deltas/`
   - `insights/`, `intelligence/`, `match/`, `reports/`, `snapshots/`
   - `stats/`, `test-validation/`

2. **Upgraded embeddings to Nomic 768-dim** (from BGE-small 384-dim):
   - `lib/ai/embeddings.ts` - Now uses `nomic-ai/nomic-embed-text-v1.5`
   - Supports Matryoshka dimensions: 768, 512, 384, 256, 128, 64
   - Migration created: `lib/db/migrations/011_upgrade_to_nomic_768.sql`

3. **Created backend client** (`lib/api/backend.ts`):
   - Connects frontend to FastAPI at `http://localhost:8000`
   - Endpoints for health check, user map, artifacts, sessions

4. **Updated hooks to use Supabase directly**:
   - `use-artifacts.ts` - Fetches synced artifacts
   - `use-insights.ts` - Fetches insights from DB
   - `use-stats.ts` - Computes stats from artifacts
   - `use-backend.ts` - NEW: Backend status monitoring

5. **Deleted orphaned files**:
   - `lib/ai/intelligence.ts` (moved to backend)

---

## Jobs To Be Done

### 🔴 Critical - Must Do First

#### 1. Run Database Migration
The embedding dimension upgrade migration needs to be run on Supabase.

```sql
-- File: misir-app/lib/db/migrations/011_upgrade_to_nomic_768.sql
-- This will:
--   1. Drop existing vector indexes
--   2. Upgrade vector columns from 384 to 768 dimensions
--   3. Recreate HNSW indexes
--   4. Update embedding_model metadata
```

**Steps:**
1. Open Supabase SQL Editor
2. Run the migration
3. Delete all existing spaces/subspaces/markers (they have 384-dim embeddings)

#### 2. Test Frontend-Backend Connection
```bash
# Terminal 1: Start backend
cd backend
uvicorn app.main:app --reload --port 8000

# Terminal 2: Start frontend
cd misir-app
npm run dev
```

Verify:
- `http://localhost:8000/health` returns `{"status": "healthy"}`
- Frontend shows green "Backend connected" indicator (if BackendStatus component is added to layout)

---

### 🟡 High Priority

#### 3. Update Backend Embeddings to 768-dim
The backend still uses 384-dim embeddings. Update:

**File:** `backend/intelligence/embeddings.py`
```python
# Change from:
MODEL_NAME = "BAAI/bge-small-en-v1.5"  # 384-dim

# To:
MODEL_NAME = "nomic-ai/nomic-embed-text-v1.5"  # 768-dim
```

Also update the dimension check in `backend/app/api/v1/endpoints/extension.py`:
```python
# Line ~80: Change 384 to 768
if len(payload.vector) != 768:
```

#### 4. Add Backend Endpoints for Dashboard
The frontend needs these endpoints from the backend (currently reading Supabase directly):

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/artifacts` | List user's artifacts |
| `GET /api/v1/stats` | Dashboard statistics |
| `GET /api/v1/evidence` | Space evidence levels |
| `POST /api/v1/insights/generate` | Trigger insight generation |

#### 5. Implement Insight Generation in Backend
Currently insights table exists but nothing generates insights. Need to:
1. Create `backend/app/api/v1/endpoints/insights.py`
2. Port logic from deleted `lib/engine/insights.ts`
3. Add cron job or trigger for insight generation

---

### 🟢 Medium Priority

#### 6. Add BackendStatus to Dashboard Layout
The component exists but isn't added to the UI yet.

**File:** `misir-app/app/dashboard/layout.tsx`
```tsx
import { BackendStatus } from '@/components/backend-status';

// Add somewhere in the layout:
<BackendStatus showUrl={process.env.NODE_ENV === 'development'} />
```

#### 7. Clean Up Orphaned Frontend Files
These lib/engine files may be orphaned (check if used):
- `lib/engine/baseline-orchestrator.ts`
- `lib/engine/deltas.ts`
- `lib/engine/evidence.ts`
- `lib/engine/insights.ts`
- `lib/engine/snapshots.ts`

Some are used by `lib/hooks/use-report.ts` for report generation - verify before deleting.

#### 8. Update Extension to Use 768-dim Embeddings
If extension does local embeddings, update to match:
```typescript
// misir-extension/src/services/embeddings.ts
// Update model and dimension
```

---

### 🔵 Low Priority / Future

#### 9. Add Error Boundaries for Backend Failures
When backend is offline, the frontend should gracefully degrade.

#### 10. Implement Cron Jobs in Backend
The deleted Next.js cron routes need to be reimplemented:
- Daily decay calculation
- Snapshot generation
- Intelligence report generation

#### 11. Production Backend URL
Update for production deployment:
```env
# misir-app/.env.production
NEXT_PUBLIC_BACKEND_URL=https://api.misir.app
```

---

## File Reference

### Frontend (misir-app)

| Path | Purpose |
|------|---------|
| `lib/api/backend.ts` | FastAPI client |
| `lib/ai/embeddings.ts` | Nomic 768-dim embeddings |
| `lib/hooks/use-backend.ts` | Backend status hook |
| `lib/hooks/use-artifacts.ts` | Artifact fetching |
| `lib/hooks/use-insights.ts` | Insight fetching |
| `lib/db/migrations/011_*.sql` | Vector upgrade migration |
| `components/backend-status.tsx` | Connection indicator |
| `.env` | Backend URL config |

### Backend (backend)

| Path | Purpose |
|------|---------|
| `app/main.py` | FastAPI app, auth |
| `app/api/v1/endpoints/extension.py` | Extension sync endpoints |
| `intelligence/embeddings.py` | Embedding service |
| `app/core/config.py` | Settings |

### Remaining Frontend API Routes

| Route | Purpose |
|-------|---------|
| `/api/auth/status` | Auth status check |
| `/api/spaces` | CRUD spaces with embeddings |
| `/api/onboarding/seed` | Seed initial spaces |
| `/api/generate-markers` | Gemini marker generation |
| `/api/warmup` | Warm up embedding model |

---

## Environment Variables

### Frontend (.env)
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
GEMINI_API_KEY=xxx
```

### Backend (.env)
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=xxx  # Service role key
```

---

## Testing Checklist

- [ ] Backend starts without errors
- [ ] Frontend connects to backend (green status)
- [ ] Migration runs successfully
- [ ] New space creation works (768-dim embeddings)
- [ ] Extension syncs artifacts to backend
- [ ] Dashboard shows synced artifacts
- [ ] Stats compute correctly

---

## Questions for Product/Design

1. Should we show backend connection status to users in production?
2. What happens when backend is down? Graceful degradation strategy?
3. Insight generation frequency - real-time vs batch?

---

## Contact

Previous developer session ended January 27, 2026.
All changes committed to git with descriptive messages.
