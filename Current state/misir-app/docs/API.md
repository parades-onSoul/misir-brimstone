# Misir API Documentation

## Authentication

All API endpoints (except public pages) require authentication via Supabase Auth. The user's session is validated through cookies.

### Headers
```
Cookie: sb-access-token=<token>; sb-refresh-token=<token>
```

Authentication is handled automatically when using the Supabase client.

---

## Intents

### Create Intent

**Endpoint:** `POST /api/intents`

**Description:** Creates a new intent for the authenticated user with initial state.

**Request Body:**
```json
{
  "name": "Machine Learning",
  "description": "Learning ML fundamentals and neural networks"
}
```

**Fields:**
- `name` (required): String - The intent name
- `description` (optional): String - Detailed description

**Response:** `201 Created`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Machine Learning",
  "description": "Learning ML fundamentals and neural networks",
  "state_vector": [10, 0, 0, 0],
  "evidence": 0,
  "last_updated_at": "2025-12-17T10:30:00.000Z",
  "created_at": "2025-12-17T10:30:00.000Z"
}
```

**Error Responses:**
- `401 Unauthorized`: User not authenticated
- `400 Bad Request`: Invalid request body
- `500 Internal Server Error`: Database error

---

### List Intents

**Endpoint:** `GET /api/intents`

**Description:** Retrieves all intents for the authenticated user.

**Query Parameters:** None

**Response:** `200 OK`
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Machine Learning",
    "description": "Learning ML fundamentals",
    "state_vector": [5, 5, 0, 0],
    "evidence": 7.5,
    "last_updated_at": "2025-12-17T10:35:00.000Z",
    "created_at": "2025-12-17T10:30:00.000Z"
  },
  {
    "id": "660f9511-f3ac-52e5-b827-557766551111",
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Web Development",
    "description": "Modern web technologies",
    "state_vector": [0, 3, 7, 0],
    "evidence": 18.2,
    "last_updated_at": "2025-12-17T11:00:00.000Z",
    "created_at": "2025-12-16T09:00:00.000Z"
  }
]
```

**Error Responses:**
- `401 Unauthorized`: User not authenticated
- `500 Internal Server Error`: Database error

---

## Artifacts

### Create Artifact

**Endpoint:** `POST /api/artifacts`

**Description:** Records a new artifact interaction, updates evidence, and triggers state transitions.

**Request Body:**
```json
{
  "intent_id": "550e8400-e29b-41d4-a716-446655440000",
  "url": "https://example.com/neural-networks-intro",
  "title": "Introduction to Neural Networks",
  "artifact_type": "save",
  "relevance_score": 0.85
}
```

**Fields:**
- `intent_id` (required): UUID - The intent this artifact belongs to
- `url` (required): String - The artifact URL
- `title` (optional): String - Artifact title/description
- `artifact_type` (required): Enum - One of: `view`, `save`, `highlight`, `annotate`
- `relevance_score` (optional): Number 0-1 - How relevant to intent (default: 1.0)

**Artifact Type Weights:**
- `view`: 1 point
- `save`: 3 points
- `highlight`: 5 points
- `annotate`: 7 points

**Response:** `201 Created`
```json
{
  "artifact": {
    "id": "770g0622-g4bd-63f6-c938-668877662222",
    "intent_id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "url": "https://example.com/neural-networks-intro",
    "title": "Introduction to Neural Networks",
    "artifact_type": "save",
    "relevance_score": 0.85,
    "weight": 3,
    "delta_evidence": 2.55,
    "created_at": "2025-12-17T10:35:00.000Z"
  },
  "updated_intent": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "state_vector": [5, 5, 0, 0],
    "evidence": 10.05,
    "last_updated_at": "2025-12-17T10:35:00.000Z"
  }
}
```

**State Transition Notes:**
- Evidence accumulation: `E_new = E_old * e^(-λΔt) + (weight * relevance)`
- State transitions occur when evidence crosses thresholds (5, 15, 30)
- Mass conservation is maintained: `Σ s_i = 10`

**Error Responses:**
- `401 Unauthorized`: User not authenticated
- `400 Bad Request`: Invalid request body or intent not found
- `403 Forbidden`: Intent belongs to different user
- `500 Internal Server Error`: Database error

---

## Snapshots

### Get Latest Snapshot

**Endpoint:** `GET /api/snapshots/latest`

**Description:** Retrieves the most recent snapshot for all user's intents.

**Query Parameters:** None

**Response:** `200 OK`
```json
[
  {
    "id": "880h1733-h5ce-74g7-d049-779988773333",
    "intent_id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "state_vector": [5, 5, 0, 0],
    "evidence": 10.05,
    "timestamp": "2025-12-17T10:35:00.000Z",
    "intent_name": "Machine Learning"
  },
  {
    "id": "991i2844-i6df-85h8-e15a-88a099884444",
    "intent_id": "660f9511-f3ac-52e5-b827-557766551111",
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "state_vector": [0, 3, 7, 0],
    "evidence": 18.2,
    "timestamp": "2025-12-17T11:00:00.000Z",
    "intent_name": "Web Development"
  }
]
```

**Notes:**
- Returns one snapshot per intent (the latest)
- Snapshots are automatically created when artifacts are added
- Useful for visualizing all intents at once

**Error Responses:**
- `401 Unauthorized`: User not authenticated
- `500 Internal Server Error`: Database error

---

## State Vector Reference

All intents have a 4-dimensional state vector `[s₀, s₁, s₂, s₃]`:

### States
- **s₀ (Undiscovered)**: Evidence < 5 - Aware but unexplored
- **s₁ (Discovered)**: 5 ≤ Evidence < 15 - Initial exploration
- **s₂ (Engaged)**: 15 ≤ Evidence < 30 - Active involvement
- **s₃ (Saturated)**: Evidence ≥ 30 - Deep understanding

### Invariants
- **Mass Conservation**: `s₀ + s₁ + s₂ + s₃ = 10` (always)
- **Non-Negativity**: All `s_i ≥ 0`

### Transitions
- Evidence increases → Mass flows forward (s₀ → s₁ → s₂ → s₃)
- Evidence decreases (decay) → Mass flows backward
- Transitions preserve total mass

---

## Error Response Format

All errors follow this format:

```json
{
  "error": "Error message describing what went wrong"
}
```

**Common Status Codes:**
- `200 OK`: Success
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid input
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Access denied
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

---

## Rate Limiting

Currently no rate limiting is enforced. This may change in production.

---

## Webhook Events (Future)

Future versions may support webhooks for:
- Intent state transitions
- Evidence threshold crossing
- Daily decay notifications

---

## Example Workflows

### Creating and Tracking an Intent

```javascript
// 1. Create intent
const intent = await fetch('/api/intents', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Learn React',
    description: 'Master React 19 features'
  })
});

// 2. Add artifacts as you learn
await fetch('/api/artifacts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    intent_id: intent.id,
    url: 'https://react.dev/learn',
    title: 'React Documentation',
    artifact_type: 'save',
    relevance_score: 1.0
  })
});

// 3. View all intents
const intents = await fetch('/api/intents').then(r => r.json());

// 4. Get latest snapshot for visualization
const snapshots = await fetch('/api/snapshots/latest').then(r => r.json());
```

---

## Database Schema

For complete database schema including RLS policies, see `lib/db/schema.sql`.
