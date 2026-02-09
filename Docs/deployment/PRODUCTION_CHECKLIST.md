# Misir Backend — Production Deployment Checklist

> **Version**: 1.0.0  
> **Last Updated**: 2026-02-04  
> **Codename**: shiro.exe

This document outlines the configuration changes and steps required to deploy the Misir backend to production.

---

## 🔐 1. Authentication Configuration

### Current State (Development)
Authentication is mocked via environment configuration for local development.

### Production Setup

**Environment Variables:**
```env
# Disable mock authentication
MOCK_AUTH=False

# Remove or leave empty (only used when MOCK_AUTH=True)
MOCK_USER_ID=
```

**Files Affected:**
- `backend/core/config.py` — Configuration settings
- `backend/interfaces/api/capture.py` — Capture endpoint auth
- `backend/interfaces/api/search.py` — Search endpoint auth

**How It Works:**
When `MOCK_AUTH=False`, the `get_current_user()` dependency will:
1. Require `Authorization: Bearer <token>` header
2. Validate JWT token with Supabase Auth
3. Extract and return `user.id` from the token
4. Return 401 Unauthorized for invalid/missing tokens

**Testing Authentication:**
```bash
# Test with valid Supabase JWT
curl -H "Authorization: Bearer YOUR_SUPABASE_JWT" \
     http://localhost:8002/api/v1/capture

# Should return 401 without token
curl http://localhost:8002/api/v1/capture
```

---

## ⚡ 2. Rate Limiter Configuration

### Current State (Development)
Uses in-memory storage, suitable for single-instance deployment only.

### Production Setup (Horizontal Scaling)

**Environment Variables:**
```env
# Switch to Redis for distributed rate limiting
RATE_LIMIT_STORAGE=redis
REDIS_URL=redis://username:password@redis-host:6379/0
```

**Files Affected:**
- `backend/core/config.py` — Configuration settings
- `backend/core/limiter.py` — Rate limiter initialization

**Redis URL Formats:**
```
# Basic
redis://localhost:6379

# With password
redis://:password@localhost:6379

# With username and password (Redis 6+)
redis://username:password@localhost:6379

# With database selection
redis://localhost:6379/0

# TLS/SSL
rediss://localhost:6379
```

**Dependencies:**
Redis support requires the `redis` Python package:
```bash
pip install redis
```

Add to `requirements.txt`:
```
redis>=4.0.0
```

**Fallback Behavior:**
If Redis connection fails, the limiter automatically falls back to in-memory storage with a warning log.

---

## 🎫 3. Artifacts API — User ID from Auth Token

### Current State
The artifacts endpoints accept `user_id` as a path/query parameter for flexibility during development.

### Production Recommendation

**Option A: Keep Current Design (Recommended for Admin APIs)**
- Useful for admin operations where one user manages another's artifacts
- Ensure proper authorization checks (is requester allowed to access this user's data?)

**Option B: Extract from Token**
Modify `backend/interfaces/api/artifacts.py`:

```python
# Before (current)
@router.patch("/artifacts/{artifact_id}")
async def update_artifact(
    artifact_id: int,
    user_id: str,  # TODO: Extract from auth token in production
    ...
):

# After (production)
@router.patch("/artifacts/{artifact_id}")
async def update_artifact(
    artifact_id: int,
    user_id: str = Depends(get_current_user),  # From JWT
    ...
):
```

**Files to Update:**
- `backend/interfaces/api/artifacts.py` — Lines 42, 75

---

## 📦 4. Batch API — Embedding Generation Performance

### Current State
Embeddings are generated one at a time in the batch endpoint.

### Production Optimization

**Location:** `backend/interfaces/api/batch.py` — Line 58

**Current Implementation:**
```python
for artifact in request.artifacts:
    # Generate embedding (TODO: Batch embedding generation for performance)
    embedding = embedding_service.embed_text(artifact.content)
```

**Optimized Implementation:**
```python
# Batch encode all texts at once (much faster)
texts = [a.content for a in request.artifacts if a.content]
embeddings = embedding_service.embed_texts_batch(texts)  # New method needed

# Map back to artifacts
for artifact, embedding in zip(request.artifacts, embeddings):
    ...
```

**Required Changes:**
1. Add `embed_texts_batch()` method to `EmbeddingService`
2. Update batch endpoint to use batch encoding
3. Consider chunking for very large batches (>100 items)

**Performance Impact:**
- Current: O(n) model loads, ~100ms per item
- Optimized: O(1) model load, ~10ms per item (10x improvement)

---

## 🔑 5. Rate Limiter — User ID Keying

### Current State
Rate limiting is keyed by IP address (`get_remote_address`).

### Production Enhancement

**Location:** `backend/core/limiter.py`

**Current:**
```python
limiter = Limiter(key_func=get_remote_address)
```

**With User ID Keying:**
```python
from fastapi import Request

def get_user_or_ip(request: Request) -> str:
    """
    Rate limit by user_id if authenticated, otherwise by IP.
    """
    # Check if user_id was set by auth middleware
    user_id = getattr(request.state, 'user_id', None)
    if user_id:
        return f"user:{user_id}"
    return get_remote_address(request)

limiter = Limiter(key_func=get_user_or_ip)
```

**Benefits:**
- Authenticated users get per-account limits
- Prevents abuse from shared IPs (corporate networks, VPNs)
- Anonymous users still rate-limited by IP

---

## 📋 Production Environment Template

Create a `.env.production` file:

```env
# ===========================================
# Misir Backend — Production Configuration
# ===========================================

# API
PROJECT_NAME=Misir Orientation Engine
VERSION=1.0.0
LOG_LEVEL=WARNING

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key

# Authentication (CRITICAL: Set to False for production)
MOCK_AUTH=False

# Rate Limiting
RATE_LIMIT_STORAGE=redis
REDIS_URL=redis://:password@your-redis-host:6379/0

# CORS (update with your production domains)
CORS_ORIGINS=["https://your-app.com","https://api.your-app.com"]

# Embedding Model
EMBEDDING_MODEL=nomic-ai/nomic-embed-text-v1.5
```

---

## ✅ Pre-Deployment Checklist

| Task | Status | Notes |
|------|--------|-------|
| Set `MOCK_AUTH=False` | ⬜ | Critical for security |
| Configure Redis for rate limiting | ⬜ | Required for multi-instance |
| Update CORS origins | ⬜ | Remove localhost entries |
| Set `LOG_LEVEL=WARNING` or `ERROR` | ⬜ | Reduce log volume |
| Configure Supabase service key | ⬜ | For admin operations |
| Run full test suite | ⬜ | `pytest -v` |
| Load test rate limiter | ⬜ | Verify limits work |
| Test JWT authentication flow | ⬜ | End-to-end with real tokens |

---

## 🚀 Deployment Commands

```bash
# Install production dependencies
pip install -r requirements.txt

# Run with production settings
export $(cat .env.production | xargs)
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4

# Or with gunicorn (recommended)
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

---

## 📊 Monitoring Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Health check, version info |
| `GET /health` | Simple health probe |
| `GET /metrics` | Prometheus metrics |
| `GET /dashboard` | Internal metrics UI |

---

## 🔗 Related Documentation

- [Backend Architecture](../architecture/backend.md)
- [API Reference](../api/README.md)
- [Database Schema](../database/README.md)
