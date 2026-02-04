# API Documentation

> **Version:** 1.4 (Shiro)  
> **Base URL:** `http://localhost:8000`  
> **Authentication:** JWT Bearer Token (Supabase)

## Quick Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/artifacts/capture` | Capture single artifact |
| `POST` | `/api/v1/artifacts/batch` | Batch capture (max 100) |
| `PATCH` | `/api/v1/artifacts/{id}` | Update artifact metadata |
| `DELETE` | `/api/v1/artifacts/{id}` | Soft-delete artifact |
| `GET` | `/api/v1/spaces` | List user's spaces |
| `POST` | `/api/v1/spaces` | Create new space |
| `GET` | `/api/v1/search` | Semantic search |
| `GET` | `/metrics` | Prometheus metrics |

## Authentication

All API endpoints (except health checks) require JWT authentication:

```bash
Authorization: Bearer <jwt_token>
```

User ID is securely extracted from JWT claims.

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `/api/v1/artifacts/capture` | 100/minute |
| `/api/v1/artifacts/batch` | 20/minute |
| `/api/v1/search` | 20/minute |
| All others | 50/minute |

---

## Artifact Endpoints

### Capture Single
`POST /api/v1/artifacts/capture`

Ingest a single artifact with engagement signals.

**Request Body:**
```json
{
  "space_id": 1,
  "url": "https://example.com/article",
  "title": "Article Title",
  "content": "Full text content...",
  
  // Engagement (Required)
  "reading_depth": 0.8,
  "scroll_depth": 0.9,
  "dwell_time_ms": 45000,
  "word_count": 500,
  "engagement_level": "engaged", // latent|discovered|engaged|saturated
  "content_source": "web",       // web|pdf|video|chat|note
  
  // Optional
  "embedding": [0.1, ...],       // 384-dim (Matryoshka) or 768-dim
  "margin": 0.15,                // Assignment margin
  "updates_centroid": true
}
```

### Batch Capture
`POST /api/v1/artifacts/batch`

Ingest up to 100 artifacts in one request.

**Request Body:**
```json
{
  "items": [
    { "url": "...", "space_id": 1, ... },
    { "url": "...", "space_id": 1, ... }
  ]
}
```

### Update Artifact
`PATCH /api/v1/artifacts/{id}`

Partial update of mutable fields.

**Request Body:**
```json
{
  "title": "New Title",
  "engagement_level": "saturated"
}
```

### Delete Artifact
`DELETE /api/v1/artifacts/{id}`

Soft-deletes the artifact. It will no longer appear in search results but remains in the database for history.

---

## Search & Spaces

### Semantic Search
`GET /api/v1/search`

**Parameters:**
- `q`: Query string
- `space_id`: Filter by space
- `threshold`: Min similarity (0.0-1.0)

### Spaces
- `GET /api/v1/spaces`: List all spaces
- `POST /api/v1/spaces`: Create space (`{ "name": "...", "description": "..." }`)

---

## Webhooks

Misir sends signed webhooks for key events.

**Events:**
- `artifact.created`
- `artifact.updated`

**Headers:**
- `X-Misir-Signature`: HMAC-SHA256 signature
- `X-Misir-Event`: Event type
- `X-Misir-Delivery-Attempt`: Attempt number (1-5)

**Signature Verification (Python):**
```python
import hmac, hashlib

def verify_signature(secret: str, payload: bytes, signature: str) -> bool:
    computed = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed, signature)
```

---

## SDK Example (Python)

```python
import httpx

API_URL = "http://localhost:8000"
TOKEN = "ey..."

async def capture():
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{API_URL}/api/v1/artifacts/capture",
            headers={"Authorization": f"Bearer {TOKEN}"},
            json={
                "url": "https://example.com",
                "space_id": 1,
                "engagement_level": "discovered",
                "content_source": "web",
                "reading_depth": 0.5,
                "scroll_depth": 0.5,
                "dwell_time_ms": 10000,
                "word_count": 500
            }
        )
        print(resp.json())
```