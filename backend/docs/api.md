# API Reference

> **Base URL:** `http://localhost:8000`  
> **API Version:** v1

---

## Endpoints

### Health Check

#### `GET /`

Returns system info and status.

**Response:**
```json
{
  "name": "Misir Orientation Engine",
  "version": "1.0.0",
  "codename": "shiro.exe",
  "status": "online",
  "architecture": "Domain-Driven Design",
  "algorithms": ["OSCL", "WESA", "SDD", "ISS"]
}
```

#### `GET /health`

Simple health check.

**Response:**
```json
{
  "status": "healthy"
}
```

---

### Artifacts

#### `POST /api/v1/artifacts/capture`

Capture an artifact with its signal.

**Request Body:**
```json
{
  "user_id": "uuid-string",
  "space_id": 1,
  "url": "https://example.com/article",
  "embedding": [0.1, 0.2, ...],      // 768 floats
  
  "reading_depth": 0.75,              // 0.0 - 1.5
  "scroll_depth": 0.8,                // 0.0 - 1.0
  "dwell_time_ms": 30000,
  "word_count": 1500,
  "engagement_level": "engaged",      // latent|discovered|engaged|saturated
  "content_source": "web",            // web|pdf|video|ebook|other
  
  "subspace_id": null,                // optional
  "session_id": null,                 // optional
  "title": "Article Title",           // optional
  "content": "Article content...",    // optional
  "signal_magnitude": 1.0,            // optional, default 1.0
  "signal_type": "semantic",          // optional, default "semantic"
  "matched_marker_ids": []            // optional
}
```

**Response (200):**
```json
{
  "artifact_id": 123,
  "signal_id": 456,
  "is_new": true,
  "message": "Artifact captured successfully"
}
```

**Response (400):**
```json
{
  "detail": "reading_depth must be 0-1.5, got 2.0"
}
```

---

## Enums

### `engagement_level`

| Value | Description | Weight |
|-------|-------------|--------|
| `latent` | Passive exposure | 0.25 |
| `discovered` | Active awareness | 0.50 |
| `engaged` | Intentional interaction | 0.75 |
| `saturated` | Deep immersion | 1.00 |

### `content_source`

| Value | Description |
|-------|-------------|
| `web` | Web page |
| `pdf` | PDF document |
| `video` | Video content |
| `ebook` | E-book |
| `other` | Other source |

### `signal_type`

| Value | Description |
|-------|-------------|
| `semantic` | Pure embedding signal |
| `marker` | User-defined marker match |
| `hybrid` | Both semantic and marker |

---

## Error Codes

| Code | Meaning |
|------|---------|
| `400` | Validation error (bad request) |
| `401` | Unauthorized (future) |
| `404` | Resource not found |
| `500` | Internal server error |

---

## CORS

The API accepts requests from:
- `http://localhost:3000`
- `http://localhost:5173`
- Browser extensions (`chrome-extension://*`, `moz-extension://*`)

Configure via `CORS_ORIGINS` environment variable.
