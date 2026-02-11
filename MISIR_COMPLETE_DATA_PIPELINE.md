# Misir Complete Data Pipeline & JTD Mapping
**Version:** 2.0  
**Date:** February 11, 2026  
**Purpose:** End-to-end data flow from Database → Backend → Frontend with Jobs-to-be-Done mapping

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Database Schema → Backend Mapping](#database-schema--backend-mapping)
3. [Backend → Frontend API Contracts](#backend--frontend-api-contracts)
4. [Frontend Components → Data Dependencies](#frontend-components--data-dependencies)
5. [Complete Data Flows by Feature](#complete-data-flows-by-feature)
6. [Jobs-to-be-Done: Data Pipeline Edition](#jobs-to-be-done-data-pipeline-edition)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                       │
│  Components → React Query Hooks → API Client → FastAPI Backend  │
└─────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Python/FastAPI)                      │
│  Routers → Handlers → Services → Repositories → Database        │
└─────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────┐
│                  DATABASE (PostgreSQL + pgvector)                │
│  Tables: space, subspace, artifact, signal, insight, drift, etc. │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema → Backend Mapping

### 1. Core Entities

#### **User (auth.users)**
**Purpose:** Authentication and user identity  
**Backend Access:** Via Supabase Auth, referenced as `user_id` UUID  
**Not Exposed:** User passwords/credentials stay in Supabase  

---

#### **Profile (misir.profile)**

**Schema:**
```sql
CREATE TABLE misir.profile (
  id uuid PRIMARY KEY,                        -- FK to auth.users
  display_name text,
  avatar_url text,
  timezone text DEFAULT 'UTC',
  onboarding_completed boolean DEFAULT false,
  onboarded_at timestamp with time zone,
  settings jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

**Backend Repository:** `profile_repo.py` (likely exists)

**Methods Needed:**
- `get_by_user_id(user_id)` → Profile
- `update_settings(user_id, settings)` → Profile
- `mark_onboarded(user_id)` → Profile

**Frontend Usage:**
- **Job 11 (Onboarding):** Check `onboarding_completed`, set to true after first space created
- **Job 39 (Settings):** Read/write `settings` JSONB (theme, density, etc.)

**API Endpoints Required:**
- `GET /profile` → Current user's profile
- `PATCH /profile` → Update settings
- `POST /profile/onboard` → Mark onboarding complete

---

#### **Space (misir.space)**

**Schema:**
```sql
CREATE TABLE misir.space (
  id bigint PRIMARY KEY,
  user_id uuid NOT NULL,                      -- FK to auth.users
  name text NOT NULL,
  description text,
  embedding vector(768),                       -- Space-level semantic vector
  evidence double precision DEFAULT 0.0,       -- 0-100%, unused in v1
  layout jsonb DEFAULT '{"state": [0,0,0,0]}', -- UI state (zoom, pan, etc.)
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

**Backend Repository:** `space_repo.py` (exists)

**Methods Needed:**
- `get_by_user_id(user_id)` → List[Space]
- `get_by_id(space_id)` → Space
- `create(user_id, name, description)` → Space
- `update(space_id, name, description)` → Space
- `delete(space_id)` → void

**Computed Fields (not in DB, calculated on read):**
- `artifact_count` → COUNT from `artifact` table
- `subspace_count` → COUNT from `subspace` table
- `last_activity_at` → MAX(artifact.captured_at)
- `confidence_avg` → AVG(subspace.confidence) weighted by artifact_count

**Frontend Usage:**
- **Job 8 (Space Cards):** Display all spaces with computed metrics
- **Job 13 (Space Header):** Display name, description, created_at
- **Job 11 (Onboarding):** Create first space

**API Endpoints Required:**
- `GET /spaces` → List of spaces with computed fields
- `GET /spaces/{id}` → Single space with computed fields
- `POST /spaces` → Create new space
- `PATCH /spaces/{id}` → Update name/description
- `DELETE /spaces/{id}` → Soft delete

**Data Flow Example (Job 8: Space Cards):**
```
Database Query:
  SELECT s.*, 
         COUNT(DISTINCT a.id) as artifact_count,
         COUNT(DISTINCT ss.id) as subspace_count,
         MAX(a.captured_at) as last_activity_at,
         AVG(ss.confidence) as confidence_avg
  FROM misir.space s
  LEFT JOIN misir.artifact a ON a.space_id = s.id
  LEFT JOIN misir.subspace ss ON ss.space_id = s.id
  WHERE s.user_id = ?
  GROUP BY s.id

Backend Handler:
  spaces = space_repo.get_by_user_id_with_stats(user_id)
  return [
    {
      "id": s.id,
      "name": s.name,
      "description": s.description,
      "artifact_count": s.artifact_count,
      "subspace_count": s.subspace_count,
      "last_activity_at": s.last_activity_at,
      "confidence": s.confidence_avg,
      "created_at": s.created_at
    }
    for s in spaces
  ]

Frontend (Job 8):
  const { data: spaces } = useSpaces();
  
  spaces.map(space => (
    <SpaceCard
      name={space.name}
      goal={space.description}
      status={getSpaceStatus({
        confidence: space.confidence,
        drift: getDriftForSpace(space.id),  // separate query
        margin: getAvgMarginForSpace(space.id)  // separate query
      })}
      lastActive={formatRelativeTime(space.last_activity_at)}
      focusDots={getFocusDots(space.confidence)}
    />
  ))
```

---

#### **Subspace (misir.subspace)**

**Schema:**
```sql
CREATE TABLE misir.subspace (
  id bigint PRIMARY KEY,
  space_id bigint NOT NULL,                   -- FK to space
  user_id uuid NOT NULL,
  name text NOT NULL,                         -- Auto-generated or user-edited
  description text,
  centroid_embedding vector(768),             -- The semantic "center" of this topic
  centroid_updated_at timestamp with time zone,
  learning_rate double precision DEFAULT 0.1, -- EMA alpha for centroid updates
  artifact_count integer DEFAULT 0,           -- Cached count
  confidence double precision DEFAULT 0.0,    -- 0.0-1.0, batch coherence
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

**Backend Repository:** `subspace_repo.py` (exists)

**Methods Needed:**
- `get_by_space_id(space_id)` → List[Subspace]
- `get_by_id(subspace_id)` → Subspace
- `create(space_id, name)` → Subspace
- `update_centroid(subspace_id, new_centroid, learning_rate)` → Subspace
- `update_confidence(subspace_id, confidence)` → Subspace
- `rename(subspace_id, name)` → Subspace

**Frontend Usage:**
- **Job 16 (Knowledge Map):** Visual bubbles sized by artifact_count, colored by confidence
- **Job 17 (Coverage Analysis):** Group by confidence/artifact_count to show "strong" vs "emerging" topics
- **Job 18 (Topic Areas):** List of expandable topics

**API Endpoints Required:**
- `GET /spaces/{space_id}/subspaces` → List of subspaces
- `POST /spaces/{space_id}/subspaces` → Create new subspace
- `PATCH /subspaces/{id}` → Rename subspace
- `DELETE /subspaces/{id}` → Delete subspace

---

#### **Artifact (misir.artifact)**

**Schema:**
```sql
CREATE TABLE misir.artifact (
  id bigint PRIMARY KEY,
  user_id uuid NOT NULL,
  space_id bigint NOT NULL,                   -- FK to space
  subspace_id bigint,                         -- FK to subspace (nullable if unassigned)
  session_id bigint,                          -- FK to session (optional)
  
  -- Content
  title text,
  url text NOT NULL,
  normalized_url text NOT NULL,               -- Canonical URL (no query params)
  domain text NOT NULL,                       -- Extracted domain
  extracted_text text,                        -- Full text content
  content_hash text,                          -- For deduplication
  word_count integer,
  content_embedding vector(768),              -- Semantic embedding
  content_source content_source DEFAULT 'web', -- web|upload|manual
  
  -- Engagement Metrics
  engagement_level engagement_level DEFAULT 'latent', -- latent|discovered|engaged|saturated
  dwell_time_ms integer DEFAULT 0,            -- Actual time spent (if tracked)
  scroll_depth double precision DEFAULT 0.0,  -- 0.0-1.0
  reading_depth double precision DEFAULT 0.0, -- 0.0-1.5 (200 WPM model)
  
  -- Weight Calculation (WESA)
  base_weight double precision DEFAULT 0.2,   -- 0.2 (latent) | 1.0 (discovered) | 2.0 (engaged)
  decay_rate decay_rate DEFAULT 'high',       -- high|medium|low
  relevance double precision DEFAULT 0.0,     -- 0.0-1.0 (marker matching)
  matched_marker_ids bigint[],                -- Array of marker IDs that matched
  effective_weight double precision,          -- Computed: base_weight * relevance * decay_factor
  
  -- Timestamps
  captured_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  metadata jsonb                              -- Extensible
);
```

**Backend Repository:** `artifact_repo.py` (exists)

**Methods Needed:**
- `get_by_space_id(space_id, limit, offset)` → List[Artifact] (for pagination)
- `get_by_id(artifact_id)` → Artifact
- `create(user_id, space_id, url, title, text, ...)` → Artifact
- `get_recent(space_id, limit)` → List[Artifact] (for alert detection)
- `get_by_subspace_id(subspace_id)` → List[Artifact]

**Frontend Usage:**
- **Job 10 (Recently Saved):** Show last 10 artifacts across all spaces
- **Job 22 (Library Table):** Full table with all columns
- **Job 15 (Smart Alerts):** Query recent items with low margin

**API Endpoints Required:**
- ✅ **Job 42:** `GET /spaces/{space_id}/artifacts?page=1&limit=50`
- `GET /artifacts/{id}` → Single artifact detail
- `POST /artifacts` → Create new artifact (capture endpoint)
- `PATCH /artifacts/{id}` → Update engagement metrics
- `DELETE /artifacts/{id}` → Soft delete

**Data Flow Example (Job 22: Library Table):**
```
Database Query:
  SELECT a.id, a.title, a.url, a.subspace_id, a.engagement_level,
         a.word_count, a.captured_at, s.margin
  FROM misir.artifact a
  LEFT JOIN misir.signal s ON s.artifact_id = a.id
  WHERE a.space_id = ? AND a.deleted_at IS NULL
  ORDER BY a.captured_at DESC
  LIMIT 50 OFFSET ?

Backend Handler (Job 42):
  artifacts = artifact_repo.get_by_space_id(space_id, limit=50, offset=page*50)
  return {
    "items": [
      {
        "id": a.id,
        "title": a.title,
        "url": a.url,
        "subspace_id": a.subspace_id,
        "engagement_level": a.engagement_level,
        "word_count": a.word_count,
        "reading_time_minutes": a.word_count / 200,
        "margin": a.signal.margin if a.signal else None,
        "captured_at": a.captured_at.isoformat()
      }
      for a in artifacts
    ],
    "page": page,
    "total": total_count
  }

Frontend (Job 22):
  const { data } = useArtifacts(spaceId, page);
  
  data.items.map(item => (
    <TableRow
      title={item.title}
      topic={getSubspaceName(item.subspace_id)}
      fit={<FitGauge dots={getFitDots(item.margin)} color={getFitColor(item.margin)} />}
      readingDepth={getReadingDepth(item.engagement_level)}
      timeSpent={`${item.reading_time_minutes} min`}
      saved={formatRelativeTime(item.captured_at)}
    />
  ))
```

---

#### **Signal (misir.signal)**

**Schema:**
```sql
CREATE TABLE misir.signal (
  id bigint PRIMARY KEY,
  artifact_id bigint NOT NULL,                -- FK to artifact (1:1 relationship)
  space_id bigint NOT NULL,
  subspace_id bigint,                         -- FK to assigned subspace
  user_id uuid NOT NULL,
  
  vector vector(768) NOT NULL,                -- Normalized embedding
  magnitude double precision DEFAULT 1.0,     -- ||vector||
  signal_type signal_type NOT NULL,           -- content|marker|hybrid
  
  embedding_model text DEFAULT 'nomic-ai/nomic-embed-text-v1.5',
  embedding_dimension integer DEFAULT 768,
  
  margin double precision,                    -- Assignment margin (d2 - d1)
  updates_centroid boolean DEFAULT true,      -- If false, signal doesn't move centroid
  
  deleted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);
```

**Backend Repository:** `signal_repo.py` (likely exists)

**Methods Needed:**
- `create(artifact_id, space_id, vector, margin, ...)` → Signal
- `get_by_artifact_id(artifact_id)` → Signal
- `get_by_space_id(space_id)` → List[Signal] (for margin distribution)

**Frontend Usage:**
- **Job 28 (Margin Distribution):** Histogram of margin values
- **Job 15 (Low Margin Alert):** Query signals with margin < 0.3

**API Endpoints Required:**
- Exposed indirectly via artifact endpoints (signal data embedded)
- ✅ **Job 45:** `GET /spaces/{space_id}/analytics/margin_distribution`

**Data Flow Example (Job 28: Margin Distribution):**
```
Database Query:
  SELECT 
    CASE 
      WHEN margin < 0.3 THEN 'weak'
      WHEN margin < 0.5 THEN 'moderate'
      ELSE 'strong'
    END as fit_level,
    COUNT(*) as count
  FROM misir.signal
  WHERE space_id = ? AND margin IS NOT NULL
  GROUP BY fit_level

Backend Handler (Job 45):
  distribution = signal_repo.get_margin_distribution(space_id)
  return {
    "weak": distribution.get("weak", 0),      # margin < 0.3
    "moderate": distribution.get("moderate", 0),  # 0.3-0.5
    "strong": distribution.get("strong", 0)   # > 0.5
  }

Frontend (Job 28):
  const { data } = useMarginDistribution(spaceId);
  
  <Histogram
    data={[
      { label: "Weak fit", count: data.weak, color: "red" },
      { label: "Moderate", count: data.moderate, color: "yellow" },
      { label: "Strong fit", count: data.strong, color: "green" }
    ]}
  />
  
  {data.weak > 0 && (
    <Alert>
      ⚠️ {data.weak} items have weak connections (margin &lt;0.3)
    </Alert>
  )}
```

---

#### **Insight (misir.insight)**

**Schema:**
```sql
CREATE TABLE misir.insight (
  id bigint PRIMARY KEY,
  user_id uuid NOT NULL,
  space_id bigint,                            -- Null if global insight
  subspace_id bigint,                         -- Null if space-level
  
  headline text NOT NULL,                     -- Short title for alert
  description text,                           -- Longer explanation
  insight_data jsonb DEFAULT '{}',            -- Structured data (affected_artifacts, etc.)
  
  severity insight_severity DEFAULT 'low',    -- low|medium|high
  status insight_status DEFAULT 'active',     -- active|dismissed|acted
  
  dismissed_at timestamp with time zone,
  acted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);
```

**Backend Repository:** `insight_repo.py` (might exist)

**Methods Needed:**
- `get_active_by_space_id(space_id)` → List[Insight]
- `get_active_by_user_id(user_id)` → List[Insight] (for alert banner)
- `create(user_id, space_id, headline, description, severity, data)` → Insight
- `dismiss(insight_id)` → Insight
- `mark_acted(insight_id)` → Insight

**Frontend Usage:**
- **Job 7 (Alert Banner):** Count of active insights across all spaces
- **Job 15 (Smart Alerts):** Display active insights for current space

**API Endpoints Required:**
- ✅ **Job 43:** `GET /spaces/{space_id}/alerts` (queries insight table)
- `GET /insights` → All active insights for user
- `POST /insights/{id}/dismiss` → Dismiss insight
- `POST /insights/{id}/act` → Mark as acted upon

**CRITICAL VERIFICATION NEEDED:**
```sql
-- Run this to check if backend is populating insights
SELECT COUNT(*), severity, headline 
FROM misir.insight 
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY severity, headline;
```

**If count > 0:** Backend is already generating insights automatically  
**If count = 0:** Need to build insight generation logic (Job 43 becomes 4h instead of 1h)

**Data Flow Example (Job 15: Smart Alerts):**
```
Database Query (if insights exist):
  SELECT headline, description, severity, insight_data
  FROM misir.insight
  WHERE space_id = ? AND status = 'active'
  ORDER BY severity DESC, created_at DESC

Backend Handler (Job 43):
  # Option A: If insights are auto-generated
  insights = insight_repo.get_active_by_space_id(space_id)
  
  # Option B: If insights need to be generated on-demand
  insights = []
  
  # Low margin check
  recent = artifact_repo.get_recent(space_id, limit=5)
  avg_margin = sum(a.signal.margin for a in recent) / len(recent)
  if avg_margin < 0.3:
    insights.append({
      "type": "low_margin",
      "severity": "warning",
      "headline": "Exploring new territory",
      "description": "Your last 5 items don't fit neatly into existing topics...",
      "affected_artifacts": [a.id for a in recent],
      "suggested_actions": [
        "Create a new topic area",
        "Review these items together"
      ]
    })
  
  # Similar for drift, velocity, confidence...
  
  return {"alerts": insights}

Frontend (Job 15):
  const { data: alerts } = useSpaceAlerts(spaceId);
  
  alerts.map(alert => (
    <AlertCard
      icon={alert.type === 'low_margin' ? '💡' : '🔄'}
      severity={alert.severity}
      headline={alert.headline}
      description={alert.description}
      actions={alert.suggested_actions}
    />
  ))
```

---

#### **Subspace Drift (misir.subspace_drift)**

**Schema:**
```sql
CREATE TABLE misir.subspace_drift (
  id bigint PRIMARY KEY,
  subspace_id bigint NOT NULL,
  drift_magnitude double precision NOT NULL,  -- 1 - cosine_similarity(C_t, C_{t-1})
  previous_centroid double precision[],       -- C_{t-1} as array
  new_centroid double precision[],            -- C_t as array
  trigger_signal_id bigint,                   -- The signal that caused the drift
  occurred_at timestamp with time zone DEFAULT now()
);
```

**Backend Repository:** `subspace_analytics.py` or `drift_repo.py`

**Methods Needed:**
- `get_by_space_id(space_id, start_date, end_date)` → List[DriftEvent]
- `create(subspace_id, drift_mag, prev_centroid, new_centroid, signal_id)` → DriftEvent

**Frontend Usage:**
- **Job 21 (Drift Timeline):** List of significant drift events
- **Job 25 (Focus Over Time):** Annotate chart with drift events

**API Endpoints Required:**
- ✅ **Job 45:** `GET /spaces/{space_id}/analytics/drift?start_date=X&end_date=Y`

**Data Flow Example (Job 21: Drift Timeline):**
```
Database Query:
  SELECT sd.drift_magnitude, sd.occurred_at, sd.trigger_signal_id,
         ss.name as subspace_name,
         a.title as trigger_title, a.url as trigger_url
  FROM misir.subspace_drift sd
  JOIN misir.subspace ss ON ss.id = sd.subspace_id
  LEFT JOIN misir.signal s ON s.id = sd.trigger_signal_id
  LEFT JOIN misir.artifact a ON a.id = s.artifact_id
  WHERE ss.space_id = ?
    AND sd.drift_magnitude > 0.25
    AND sd.occurred_at BETWEEN ? AND ?
  ORDER BY sd.occurred_at DESC

Backend Handler (Job 45):
  events = drift_repo.get_by_space_id(
    space_id, 
    start_date=start_date, 
    end_date=end_date,
    min_magnitude=0.25
  )
  
  return {
    "events": [
      {
        "date": e.occurred_at.isoformat(),
        "subspace_name": e.subspace_name,
        "drift_magnitude": e.drift_magnitude,
        "trigger_artifact": {
          "id": e.trigger_artifact_id,
          "title": e.trigger_title,
          "url": e.trigger_url
        } if e.trigger_signal_id else None,
        "description": generate_drift_description(e)  # From alerts.ts logic
      }
      for e in events
    ]
  }

Frontend (Job 21):
  const { data } = useDriftTimeline(spaceId);
  
  data.events.map(event => (
    <TimelineItem>
      <Date>{formatDate(event.date)}</Date>
      <Topic>{event.subspace_name} shifted significantly</Topic>
      <Trigger>
        Triggered by: <a href={event.trigger_artifact.url}>
          {event.trigger_artifact.title}
        </a>
      </Trigger>
      <Description>{event.description}</Description>
    </TimelineItem>
  ))
```

---

#### **Subspace Velocity (misir.subspace_velocity)**

**Schema:**
```sql
CREATE TABLE misir.subspace_velocity (
  id bigint PRIMARY KEY,
  subspace_id bigint NOT NULL,
  velocity double precision NOT NULL,         -- Scalar velocity (items/week or semantic distance/week)
  displacement double precision[] NOT NULL,   -- Vector displacement in embedding space
  measured_at timestamp with time zone DEFAULT now()
);
```

**Backend Repository:** `subspace_analytics.py` or `velocity_repo.py`

**Methods Needed:**
- `get_by_space_id(space_id, start_date, end_date)` → List[VelocityMeasurement]

**Frontend Usage:**
- **Job 26 (Reading Pace):** Line chart of items/week over time
- **Job 14 (Progress metric):** Current velocity vs average

**API Endpoints Required:**
- ✅ **Job 45:** `GET /spaces/{space_id}/analytics/velocity?start_date=X&end_date=Y`

**Data Flow Example (Job 26: Reading Pace):**
```
Database Query:
  SELECT DATE_TRUNC('week', measured_at) as week,
         AVG(velocity) as avg_velocity
  FROM misir.subspace_velocity
  WHERE subspace_id IN (
    SELECT id FROM misir.subspace WHERE space_id = ?
  )
  AND measured_at BETWEEN ? AND ?
  GROUP BY week
  ORDER BY week

Backend Handler (Job 45):
  velocity_data = velocity_repo.get_by_space_id(
    space_id,
    start_date=start_date,
    end_date=end_date,
    group_by='week'
  )
  
  return {
    "timeseries": [
      {
        "week": v.week.isoformat(),
        "items_per_week": v.avg_velocity
      }
      for v in velocity_data
    ],
    "current": velocity_data[-1].avg_velocity if velocity_data else 0,
    "average": sum(v.avg_velocity for v in velocity_data) / len(velocity_data)
  }

Frontend (Job 26):
  const { data } = useVelocity(spaceId);
  
  <LineChart data={data.timeseries} />
  
  <Stats>
    Current pace: {data.current} items/week
    Average: {data.average} items/week
    Trend: {data.current > data.average ? '↑ Accelerating' : '↓ Slowing'}
  </Stats>
```

---

#### **Subspace Centroid History (misir.subspace_centroid_history)**

**Schema:**
```sql
CREATE TABLE misir.subspace_centroid_history (
  id bigint PRIMARY KEY,
  subspace_id bigint NOT NULL,
  centroid_embedding vector(768) NOT NULL,    -- Historical centroid position
  artifact_count integer DEFAULT 0,
  signal_count integer DEFAULT 0,
  confidence double precision DEFAULT 0.0,
  computed_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

**Backend Repository:** `centroid_history_repo.py` (might not exist yet)

**Methods Needed:**
- `get_by_subspace_id(subspace_id, start_date, end_date)` → List[CentroidSnapshot]

**Frontend Usage:**
- **Job 20 (Time Slider):** Animate centroid movement over time
- **Job 25 (Focus Over Time):** Show confidence evolution

**API Endpoints Required:**
- ✅ **Job 45:** `GET /spaces/{space_id}/analytics/confidence?start_date=X&end_date=Y`
- `GET /subspaces/{id}/centroid_history` (for Job 20)

**CRITICAL VERIFICATION NEEDED:**
```sql
-- Check if centroid history is being logged
SELECT COUNT(*) FROM misir.subspace_centroid_history;
```

**If count > 0:** Backend is logging centroid updates → Job 20 backend is done  
**If count = 0:** Need to add trigger to log centroids on update

**Data Flow Example (Job 25: Focus Over Time):**
```
Database Query:
  SELECT DATE_TRUNC('day', computed_at) as date,
         AVG(confidence) as avg_confidence
  FROM misir.subspace_centroid_history
  WHERE subspace_id IN (
    SELECT id FROM misir.subspace WHERE space_id = ?
  )
  AND computed_at BETWEEN ? AND ?
  GROUP BY date
  ORDER BY date

Backend Handler (Job 45):
  confidence_data = centroid_history_repo.get_confidence_timeseries(
    space_id,
    start_date=start_date,
    end_date=end_date
  )
  
  return {
    "timeseries": [
      {
        "date": c.date.isoformat(),
        "confidence": c.avg_confidence
      }
      for c in confidence_data
    ]
  }

Frontend (Job 25):
  const { data: confidence } = useConfidenceTimeseries(spaceId);
  const { data: driftEvents } = useDriftTimeline(spaceId);
  
  <LineChart
    data={confidence.timeseries}
    xKey="date"
    yKey="confidence"
    annotations={driftEvents.map(e => ({
      x: e.date,
      label: `Drift: ${e.subspace_name}`,
      color: 'orange'
    }))}
  />
```

---

### 2. Session & Tracking Tables (Lower Priority for v1)

#### **Session (misir.session)**
- Used for grouping artifacts by browsing session
- **Frontend Usage:** None in Phase 1
- **Can be ignored for beta**

#### **Marker (misir.marker) & Subspace Marker (misir.subspace_marker)**
- User-defined semantic anchors for topics
- **Frontend Usage:** Advanced feature, Phase 3+
- **Can be ignored for beta**

#### **Webhook Tables (misir.webhook_subscription, misir.webhook_event)**
- External integrations
- **Frontend Usage:** None
- **Can be ignored for beta**

#### **System Config (misir.system_config)**
- Stores thresholds (margin < 0.3, drift > 0.25, etc.)
- **Frontend Usage:** Read-only in Settings (Job 41)
- **Low priority**

---

## Backend → Frontend API Contracts

### Design Principles

1. **RESTful endpoints** where possible
2. **Pagination** for lists (default 50 items, max 200)
3. **Consistent error format:**
   ```json
   {
     "error": "ResourceNotFound",
     "message": "Space with id 123 not found",
     "details": {}
   }
   ```
4. **ISO 8601 timestamps** for all dates
5. **Embedded relations** when needed (e.g., artifact includes signal.margin)

---

### API Endpoint Specification

#### **Authentication**
All endpoints require `Authorization: Bearer <supabase_jwt>` header

---

#### **Spaces**

**GET /spaces**  
Returns all spaces for current user

**Response:**
```json
{
  "spaces": [
    {
      "id": 123,
      "name": "Machine Learning",
      "description": "Understanding deep learning fundamentals",
      "artifact_count": 47,
      "subspace_count": 8,
      "last_activity_at": "2026-02-11T10:30:00Z",
      "confidence": 0.74,
      "created_at": "2026-01-15T08:00:00Z"
    }
  ]
}
```

**Used by:** Jobs 7, 8, 46

---

**GET /spaces/{id}**  
Returns single space with detailed stats

**Response:**
```json
{
  "id": 123,
  "name": "Machine Learning",
  "description": "Understanding deep learning fundamentals",
  "artifact_count": 47,
  "subspace_count": 8,
  "last_activity_at": "2026-02-11T10:30:00Z",
  "confidence": 0.74,
  "recent_drift": 0.21,
  "avg_margin": 0.45,
  "velocity": 3.2,
  "created_at": "2026-01-15T08:00:00Z",
  "updated_at": "2026-02-11T10:30:00Z"
}
```

**Used by:** Jobs 12, 13, 14

---

**POST /spaces**  
Create new space

**Request:**
```json
{
  "name": "Quantum Computing",
  "description": "Learn quantum error correction"
}
```

**Response:**
```json
{
  "id": 124,
  "name": "Quantum Computing",
  "description": "Learn quantum error correction",
  "created_at": "2026-02-11T11:00:00Z"
}
```

**Used by:** Job 11 (Onboarding)

---

**PATCH /spaces/{id}**  
Update space

**Request:**
```json
{
  "name": "Quantum Computing & Cryptography",
  "description": "Expanded scope to include post-quantum crypto"
}
```

**Used by:** Job 13 (Space Header edit)

---

**DELETE /spaces/{id}**  
Soft delete space (sets deleted_at)

**Used by:** Job 13 (Archive action)

---

#### **Subspaces**

**GET /spaces/{space_id}/subspaces**  
Returns all subspaces for a space

**Response:**
```json
{
  "subspaces": [
    {
      "id": 456,
      "space_id": 123,
      "name": "Neural Networks",
      "artifact_count": 23,
      "confidence": 0.85,
      "last_activity_at": "2026-02-10T14:20:00Z",
      "created_at": "2026-01-20T09:00:00Z"
    }
  ]
}
```

**Used by:** Jobs 16, 17, 18

---

**POST /spaces/{space_id}/subspaces**  
Create new subspace manually

**Request:**
```json
{
  "name": "Transformer Architecture"
}
```

**Used by:** Job 18 ("+ Create new topic area" button)

---

**PATCH /subspaces/{id}**  
Rename subspace

**Request:**
```json
{
  "name": "Attention Mechanisms & Transformers"
}
```

**Used by:** Job 18 (Rename action)

---

#### **Artifacts**

**✅ Job 42: GET /spaces/{space_id}/artifacts**  
Returns paginated artifacts

**Query Params:**
- `page` (default: 1)
- `limit` (default: 50, max: 200)
- `subspace_id` (optional filter)
- `sort` (recent|oldest|margin_asc|margin_desc)
- `min_margin`, `max_margin` (optional filters)
- `engagement_level` (optional filter: latent|discovered|engaged|saturated)

**Response:**
```json
{
  "items": [
    {
      "id": 789,
      "title": "Attention Is All You Need",
      "url": "https://arxiv.org/abs/1706.03762",
      "domain": "arxiv.org",
      "subspace_id": 456,
      "subspace_name": "Neural Networks",
      "engagement_level": "engaged",
      "word_count": 5847,
      "reading_time_minutes": 29,
      "margin": 0.62,
      "dwell_time_ms": 1740000,
      "scroll_depth": 0.92,
      "captured_at": "2026-02-09T16:45:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 47,
    "total_pages": 1
  }
}
```

**Used by:** Jobs 10, 22, 23

---

**POST /artifacts**  
Capture new artifact (from extension or manual)

**Request:**
```json
{
  "space_id": 123,
  "url": "https://arxiv.org/abs/1706.03762",
  "title": "Attention Is All You Need",
  "extracted_text": "...",
  "word_count": 5847,
  "dwell_time_ms": 120000,
  "scroll_depth": 0.8
}
```

**Response:**
```json
{
  "id": 789,
  "title": "Attention Is All You Need",
  "subspace_id": 456,
  "margin": 0.62,
  "engagement_level": "discovered",
  "captured_at": "2026-02-11T11:30:00Z"
}
```

**Used by:** Extension, not directly by dashboard

---

#### **Alerts / Insights**

**✅ Job 43: GET /spaces/{space_id}/alerts**  
Returns active alerts/insights for a space

**Response:**
```json
{
  "alerts": [
    {
      "id": 101,
      "type": "low_margin",
      "severity": "warning",
      "headline": "Exploring new territory",
      "description": "Your last 5 items don't fit neatly into your existing topics. This usually means you're discovering something new.",
      "affected_artifacts": [789, 788, 787, 786, 785],
      "suggested_actions": [
        "Create a new topic area",
        "Review these items together",
        "Keep exploring - we'll keep tracking"
      ],
      "created_at": "2026-02-11T10:00:00Z"
    },
    {
      "id": 102,
      "type": "high_drift",
      "severity": "info",
      "headline": "Your focus is shifting",
      "description": "After reading 'Attention Is All You Need', your understanding of Neural Networks evolved significantly.",
      "subspace_id": 456,
      "trigger_artifact_id": 789,
      "created_at": "2026-02-11T09:30:00Z"
    }
  ]
}
```

**Alert Types:**
- `low_margin` (avg margin < 0.3 for recent items)
- `high_drift` (drift > 0.3 in subspace)
- `velocity_drop` (velocity < 50% of 30d avg)
- `confidence_drop` (confidence drops > 0.2 in one week)

**Used by:** Jobs 7, 15

---

**GET /insights**  
Returns all active insights for user (across all spaces)

**Response:**
```json
{
  "insights": [
    {
      "id": 101,
      "space_id": 123,
      "space_name": "Machine Learning",
      "type": "low_margin",
      "severity": "warning",
      "headline": "Exploring new territory",
      "created_at": "2026-02-11T10:00:00Z"
    }
  ],
  "count": 1
}
```

**Used by:** Job 7 (Alert Banner count)

---

**POST /insights/{id}/dismiss**  
Dismiss an insight

**Used by:** Job 15 (user can dismiss alerts)

---

#### **Analytics**

**✅ Job 44: GET /spaces/{space_id}/topology**  
Returns 2D projection of subspace centroids for visualization

**Response:**
```json
{
  "nodes": [
    {
      "subspace_id": 456,
      "name": "Neural Networks",
      "artifact_count": 23,
      "confidence": 0.85,
      "x": 12.5,
      "y": -8.3
    },
    {
      "subspace_id": 457,
      "name": "Optimization",
      "artifact_count": 15,
      "confidence": 0.72,
      "x": -5.2,
      "y": 14.7
    }
  ]
}
```

**Note:** Backend uses t-SNE or UMAP to reduce 768-dim centroids to 2D  
**Used by:** Jobs 16, 19

---

**✅ Job 45a: GET /spaces/{space_id}/analytics/drift**  
Returns drift events over time

**Query Params:**
- `start_date` (ISO 8601)
- `end_date` (ISO 8601)
- `min_magnitude` (default: 0.25)

**Response:**
```json
{
  "events": [
    {
      "id": 301,
      "date": "2026-02-09T16:45:00Z",
      "subspace_id": 456,
      "subspace_name": "Neural Networks",
      "drift_magnitude": 0.34,
      "trigger_artifact": {
        "id": 789,
        "title": "Attention Is All You Need",
        "url": "https://arxiv.org/abs/1706.03762"
      }
    }
  ]
}
```

**Used by:** Jobs 21, 25

---

**✅ Job 45b: GET /spaces/{space_id}/analytics/velocity**  
Returns velocity time series

**Query Params:**
- `start_date`, `end_date`
- `granularity` (day|week|month, default: week)

**Response:**
```json
{
  "timeseries": [
    {
      "period": "2026-02-03",
      "items_per_week": 4.2
    },
    {
      "period": "2026-02-10",
      "items_per_week": 2.8
    }
  ],
  "current": 2.8,
  "average": 3.5,
  "trend": "declining"
}
```

**Used by:** Jobs 14, 26, 36

---

**✅ Job 45c: GET /spaces/{space_id}/analytics/confidence**  
Returns confidence time series

**Query Params:**
- `start_date`, `end_date`
- `granularity` (day|week, default: day)

**Response:**
```json
{
  "timeseries": [
    {
      "date": "2026-02-09",
      "confidence": 0.76
    },
    {
      "date": "2026-02-10",
      "confidence": 0.74
    }
  ]
}
```

**Used by:** Jobs 25, 27

---

**✅ Job 45d: GET /spaces/{space_id}/analytics/margin_distribution**  
Returns histogram of margin scores

**Response:**
```json
{
  "distribution": {
    "weak": 6,       // margin < 0.3
    "moderate": 18,  // 0.3 <= margin < 0.5
    "strong": 23     // margin >= 0.5
  },
  "total": 47
}
```

**Used by:** Job 28

---

**GET /analytics/global**  
Returns cross-space analytics

**Response:**
```json
{
  "overview": {
    "total_artifacts": 128,
    "active_spaces": 3,
    "overall_confidence": 0.71,
    "system_health": "stable"
  },
  "time_allocation": [
    {
      "space_id": 123,
      "space_name": "Machine Learning",
      "reading_minutes": 720,
      "percentage": 45
    }
  ],
  "activity_heatmap": [
    {
      "date": "2026-02-11",
      "count": 5
    }
  ]
}
```

**Used by:** Jobs 32, 33, 34

---

#### **Profile**

**GET /profile**  
Returns current user's profile

**Response:**
```json
{
  "id": "uuid-...",
  "display_name": "Jamil Ahmed",
  "avatar_url": "https://...",
  "timezone": "Asia/Dhaka",
  "onboarding_completed": true,
  "settings": {
    "theme": "dark",
    "density": "compact"
  }
}
```

**Used by:** Jobs 11, 39

---

**PATCH /profile**  
Update profile settings

**Request:**
```json
{
  "settings": {
    "theme": "light",
    "density": "comfortable"
  }
}
```

**Used by:** Job 39

---

**POST /profile/onboard**  
Mark onboarding as complete

**Used by:** Job 11

---

## Frontend Components → Data Dependencies

### Component Dependency Matrix

| Component | Data Source | API Endpoint | Jobs |
|-----------|-------------|--------------|------|
| **Home Page** | | | |
| AlertBanner | Insights (all spaces) | `GET /insights` | 7 |
| SpaceCard | Spaces with stats | `GET /spaces` | 8 |
| ActivityChart | Artifact counts | `GET /spaces` + aggregate | 9 |
| RecentlySaved | Recent artifacts | `GET /artifacts?sort=recent&limit=10` | 10 |
| | | | |
| **Space Detail - Overview** | | | |
| SpaceHeader | Space metadata | `GET /spaces/{id}` | 13 |
| DiagnosticsPanel | Space stats | `GET /spaces/{id}` | 14 |
| SmartAlerts | Space insights | `GET /spaces/{id}/alerts` | 15 |
| KnowledgeMap | Subspace topology | `GET /spaces/{id}/topology` | 16 |
| CoverageAnalysis | Subspaces grouped | `GET /spaces/{id}/subspaces` | 17 |
| TopicsList | Subspaces with items | `GET /spaces/{id}/subspaces` | 18 |
| | | | |
| **Space Detail - Library** | | | |
| ItemsTable | Artifacts paginated | `GET /spaces/{id}/artifacts` | 22 |
| SearchBar | Semantic search | `POST /search` (future) | 23 |
| FilterPanel | Filters | Client-side on artifacts | 23 |
| | | | |
| **Space Detail - Insights** | | | |
| FocusChart | Confidence over time | `GET /spaces/{id}/analytics/confidence` | 25 |
| VelocityChart | Items/week over time | `GET /spaces/{id}/analytics/velocity` | 26 |
| MarginHistogram | Margin distribution | `GET /spaces/{id}/analytics/margin_distribution` | 28 |
| EngagementDonut | Engagement levels | Client-side aggregate | 29 |
| SourcesChart | Top domains | Client-side aggregate | 30 |
| | | | |
| **Global Analytics** | | | |
| SystemOverview | Global stats | `GET /analytics/global` | 32 |
| TimeAllocationPie | Reading time by space | `GET /analytics/global` | 33 |
| ActivityHeatmap | Daily artifact counts | `GET /analytics/global` | 34 |
| | | | |
| **Search** | | | |
| SearchResults | Semantic search | `POST /search` | 37 |
| | | | |
| **Settings** | | | |
| AppearanceSettings | Profile settings | `GET /profile`, `PATCH /profile` | 39 |
| DataExport | Export functionality | `GET /export` (future) | 40 |

---

## Complete Data Flows by Feature

### Flow 1: Home Page Load

**User Action:** Navigate to `/dashboard`

**Frontend:**
```typescript
// app/(dashboard)/dashboard/page.tsx
export default function DashboardPage() {
  const { data: spaces } = useSpaces();           // GET /spaces
  const { data: insights } = useInsights();       // GET /insights
  const { data: recentItems } = useRecentItems(); // GET /artifacts?limit=10&sort=recent
  
  return (
    <>
      <AlertBanner insights={insights} />
      <SpaceCards spaces={spaces} />
      <ActivityChart spaces={spaces} />
      <RecentlySaved items={recentItems} />
    </>
  );
}
```

**Backend Flow:**
```
1. GET /spaces
   → space_repo.get_by_user_id_with_stats(user_id)
   → SQL: SELECT s.*, COUNT(a.id) as artifact_count, ...
          FROM misir.space s
          LEFT JOIN misir.artifact a ON a.space_id = s.id
          WHERE s.user_id = ?
          GROUP BY s.id
   → Return: [Space with computed fields]

2. GET /insights
   → insight_repo.get_active_by_user_id(user_id)
   → SQL: SELECT * FROM misir.insight
          WHERE user_id = ? AND status = 'active'
   → Return: [Insight objects]

3. GET /artifacts?limit=10&sort=recent
   → artifact_repo.get_recent_global(user_id, limit=10)
   → SQL: SELECT a.*, s.margin
          FROM misir.artifact a
          LEFT JOIN misir.signal s ON s.artifact_id = a.id
          WHERE a.user_id = ? AND a.deleted_at IS NULL
          ORDER BY a.captured_at DESC
          LIMIT 10
   → Return: [Recent artifacts]
```

**Data Transformation (Frontend):**
```typescript
// lib/formatters.ts applied
spaces.map(space => ({
  ...space,
  status: getSpaceStatus({
    confidence: space.confidence,
    drift: space.recent_drift,
    margin: space.avg_margin
  }),
  focusLabel: getFocusLabel(space.confidence),
  focusDots: getFocusDots(space.confidence)
}))
```

---

### Flow 2: Space Detail Page Load

**User Action:** Click on a Space Card → Navigate to `/spaces/123`

**Frontend:**
```typescript
// app/(dashboard)/spaces/[id]/page.tsx
export default function SpaceDetailPage({ params }) {
  const spaceId = params.id;
  
  const { data: space } = useSpace(spaceId);           // GET /spaces/{id}
  const { data: subspaces } = useSubspaces(spaceId);   // GET /spaces/{id}/subspaces
  const { data: alerts } = useSpaceAlerts(spaceId);    // GET /spaces/{id}/alerts
  const { data: topology } = useTopology(spaceId);     // GET /spaces/{id}/topology
  
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="map">Map</TabsTrigger>
        <TabsTrigger value="library">Library</TabsTrigger>
        <TabsTrigger value="insights">Insights</TabsTrigger>
      </TabsList>
      
      <TabsContent value="overview">
        <SpaceHeader space={space} />
        <DiagnosticsPanel space={space} />
        <SmartAlerts alerts={alerts} />
        <KnowledgeMap topology={topology} />
        <CoverageAnalysis subspaces={subspaces} />
        <TopicsList subspaces={subspaces} />
      </TabsContent>
      
      {/* Other tabs... */}
    </Tabs>
  );
}
```

**Backend Flow:**
```
1. GET /spaces/{id}
   → space_repo.get_by_id_with_stats(space_id, user_id)
   → SQL: Complex join with computed fields
   → Return: Space with confidence, drift, velocity, margin stats

2. GET /spaces/{id}/subspaces
   → subspace_repo.get_by_space_id(space_id)
   → SQL: SELECT * FROM misir.subspace WHERE space_id = ?
   → Return: [Subspace objects]

3. GET /spaces/{id}/alerts (Job 43)
   → Check if misir.insight has rows for this space
   → If yes: insight_repo.get_active_by_space_id(space_id)
   → If no: Generate on-demand:
      - Query recent artifacts for low margin
      - Query drift events for high drift
      - Calculate velocity for drop detection
      - Check confidence history for drops
   → Return: [Alert objects]

4. GET /spaces/{id}/topology (Job 44)
   → subspace_repo.get_by_space_id(space_id)
   → Extract centroid_embeddings (768-dim vectors)
   → Apply t-SNE dimensionality reduction to 2D
   → Return: [{subspace_id, name, x, y, confidence, artifact_count}]
```

---

### Flow 3: Library Table Load

**User Action:** Click "Library" tab in Space Detail

**Frontend:**
```typescript
// app/(dashboard)/spaces/[id]/library.tsx
export default function LibraryTab({ spaceId }) {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    subspace_id: null,
    engagement_level: null,
    min_margin: null
  });
  
  const { data } = useArtifacts(spaceId, page, filters); // GET /spaces/{id}/artifacts
  
  return (
    <>
      <SearchAndFilters filters={filters} setFilters={setFilters} />
      <ItemsTable
        items={data.items}
        onSort={handleSort}
        onRowClick={openSourceUrl}
      />
      <Pagination page={page} total={data.pagination.total_pages} />
    </>
  );
}
```

**Backend Flow (Job 42):**
```python
@router.get("/spaces/{space_id}/artifacts")
def get_artifacts(
    space_id: int,
    page: int = 1,
    limit: int = 50,
    subspace_id: Optional[int] = None,
    engagement_level: Optional[str] = None,
    min_margin: Optional[float] = None,
    sort: str = "recent"
):
    offset = (page - 1) * limit
    
    # Build query with filters
    query = """
        SELECT a.id, a.title, a.url, a.domain,
               a.subspace_id, ss.name as subspace_name,
               a.engagement_level, a.word_count,
               a.dwell_time_ms, a.scroll_depth,
               a.captured_at, s.margin
        FROM misir.artifact a
        LEFT JOIN misir.signal s ON s.artifact_id = a.id
        LEFT JOIN misir.subspace ss ON ss.id = a.subspace_id
        WHERE a.space_id = %(space_id)s
          AND a.deleted_at IS NULL
    """
    
    params = {"space_id": space_id}
    
    if subspace_id:
        query += " AND a.subspace_id = %(subspace_id)s"
        params["subspace_id"] = subspace_id
    
    if engagement_level:
        query += " AND a.engagement_level = %(engagement_level)s"
        params["engagement_level"] = engagement_level
    
    if min_margin:
        query += " AND s.margin >= %(min_margin)s"
        params["min_margin"] = min_margin
    
    # Sorting
    if sort == "recent":
        query += " ORDER BY a.captured_at DESC"
    elif sort == "oldest":
        query += " ORDER BY a.captured_at ASC"
    elif sort == "margin_desc":
        query += " ORDER BY s.margin DESC NULLS LAST"
    elif sort == "margin_asc":
        query += " ORDER BY s.margin ASC NULLS LAST"
    
    query += " LIMIT %(limit)s OFFSET %(offset)s"
    params["limit"] = limit
    params["offset"] = offset
    
    artifacts = db.execute(query, params).fetchall()
    total = db.execute(count_query, {"space_id": space_id}).fetchone()[0]
    
    return {
        "items": [
            {
                "id": a.id,
                "title": a.title,
                "url": a.url,
                "domain": a.domain,
                "subspace_id": a.subspace_id,
                "subspace_name": a.subspace_name,
                "engagement_level": a.engagement_level,
                "word_count": a.word_count,
                "reading_time_minutes": a.word_count / 200 if a.word_count else 0,
                "margin": a.margin,
                "dwell_time_ms": a.dwell_time_ms,
                "scroll_depth": a.scroll_depth,
                "captured_at": a.captured_at.isoformat()
            }
            for a in artifacts
        ],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit
        }
    }
```

**Frontend Data Transformation:**
```typescript
// Applied in ItemsTable component
data.items.map(item => ({
  ...item,
  fitLabel: getFitLabel(item.margin),
  fitDots: getFitDots(item.margin),
  fitColor: getFitColor(item.margin),
  readingDepth: getReadingDepth(item.engagement_level),
  savedRelative: formatRelativeTime(item.captured_at)
}))
```

---

### Flow 4: Knowledge Map Visualization

**User Action:** View Overview tab with Knowledge Map

**Frontend:**
```typescript
// components/KnowledgeMap.tsx
export function KnowledgeMap({ spaceId }) {
  const { data: topology } = useTopology(spaceId);  // GET /spaces/{id}/topology
  const { data: subspaces } = useSubspaces(spaceId);
  
  // Combine topology coords with subspace metadata
  const nodes = topology?.nodes.map(node => {
    const subspace = subspaces.find(s => s.id === node.subspace_id);
    return {
      id: node.subspace_id,
      name: node.name,
      x: node.x,
      y: node.y,
      size: node.artifact_count,
      color: getFocusColor(node.confidence),
      borderWidth: getActivityBorder(subspace?.last_activity_at)
    };
  });
  
  return (
    <ForceGraph2D
      graphData={{ nodes, links: [] }}
      nodeCanvasObject={(node, ctx) => {
        // Draw bubble with size, color, border
        drawBubble(ctx, node);
      }}
      onNodeClick={node => {
        // Filter library to this topic
        router.push(`/spaces/${spaceId}?tab=library&subspace=${node.id}`);
      }}
      onNodeHover={node => {
        setTooltip({
          name: node.name,
          count: node.size,
          focus: getFocusLabel(node.confidence),
          lastActive: formatRelativeTime(node.last_activity_at)
        });
      }}
    />
  );
}
```

**Backend Flow (Job 44):**
```python
from sklearn.manifold import TSNE
import numpy as np

@router.get("/spaces/{space_id}/topology")
def get_topology(space_id: int, user_id: str):
    # Get all subspaces with centroids
    subspaces = db.execute("""
        SELECT id, name, artifact_count, confidence, centroid_embedding
        FROM misir.subspace
        WHERE space_id = %(space_id)s
          AND centroid_embedding IS NOT NULL
    """, {"space_id": space_id}).fetchall()
    
    if len(subspaces) < 2:
        # Can't do dimensionality reduction with < 2 points
        return {"nodes": []}
    
    # Extract 768-dim centroid vectors
    centroids = np.array([s.centroid_embedding for s in subspaces])
    
    # Reduce to 2D using t-SNE
    # Note: Cache this result, t-SNE is expensive (~2-5 seconds)
    coords_2d = TSNE(
        n_components=2,
        random_state=42,
        perplexity=min(30, len(subspaces) - 1)
    ).fit_transform(centroids)
    
    # Return nodes with 2D coordinates
    return {
        "nodes": [
            {
                "subspace_id": s.id,
                "name": s.name,
                "artifact_count": s.artifact_count,
                "confidence": s.confidence,
                "x": float(coords_2d[i][0]),
                "y": float(coords_2d[i][1])
            }
            for i, s in enumerate(subspaces)
        ]
    }
```

**Optimization Note:**
- t-SNE is expensive (2-5 seconds for 10-20 subspaces)
- **Cache the result** with TTL of 1 hour
- Invalidate cache when new subspace created or centroid updated
- Consider pre-computing overnight for large spaces

---

### Flow 5: Smart Alerts Generation

**User Action:** View Overview tab, see Smart Alerts

**Frontend:**
```typescript
// components/SmartAlerts.tsx
export function SmartAlerts({ spaceId }) {
  const { data: alerts } = useSpaceAlerts(spaceId);  // GET /spaces/{id}/alerts
  
  if (!alerts || alerts.length === 0) return null;
  
  return (
    <div className="space-y-4">
      {alerts.map(alert => (
        <AlertCard
          key={alert.id}
          type={alert.type}
          severity={alert.severity}
          icon={getAlertIcon(alert.type)}
          headline={alert.headline}
          description={alert.description}
          actions={alert.suggested_actions}
          onDismiss={() => dismissAlert(alert.id)}
          onAction={() => handleAlertAction(alert)}
        />
      ))}
    </div>
  );
}
```

**Backend Flow (Job 43):**

**Option A: If `misir.insight` table is populated (best case):**
```python
@router.get("/spaces/{space_id}/alerts")
def get_alerts(space_id: int, user_id: str):
    # Simply query existing insights
    insights = db.execute("""
        SELECT id, headline, description, severity, insight_data, created_at
        FROM misir.insight
        WHERE space_id = %(space_id)s
          AND status = 'active'
        ORDER BY severity DESC, created_at DESC
    """, {"space_id": space_id}).fetchall()
    
    return {
        "alerts": [
            {
                "id": i.id,
                "type": i.insight_data.get("type"),
                "severity": i.severity,
                "headline": i.headline,
                "description": i.description,
                "affected_artifacts": i.insight_data.get("artifact_ids", []),
                "suggested_actions": i.insight_data.get("actions", []),
                "created_at": i.created_at.isoformat()
            }
            for i in insights
        ]
    }
```

**Option B: If `misir.insight` is empty (need to generate on-demand):**
```python
@router.get("/spaces/{space_id}/alerts")
def get_alerts(space_id: int, user_id: str):
    alerts = []
    
    # 1. Low Margin Alert
    recent_artifacts = db.execute("""
        SELECT a.id, a.title, s.margin
        FROM misir.artifact a
        JOIN misir.signal s ON s.artifact_id = a.id
        WHERE a.space_id = %(space_id)s
          AND a.deleted_at IS NULL
        ORDER BY a.captured_at DESC
        LIMIT 5
    """, {"space_id": space_id}).fetchall()
    
    if len(recent_artifacts) >= 5:
        avg_margin = sum(a.margin for a in recent_artifacts if a.margin) / len(recent_artifacts)
        if avg_margin < 0.3:
            alerts.append({
                "type": "low_margin",
                "severity": "warning",
                "headline": "Exploring new territory",
                "description": "Your last 5 items don't fit neatly into your existing topics. This usually means you're discovering something new.",
                "affected_artifacts": [a.id for a in recent_artifacts],
                "suggested_actions": [
                    "Create a new topic area",
                    "Review these items together",
                    "Keep exploring - we'll keep tracking"
                ]
            })
    
    # 2. High Drift Alert
    recent_drift = db.execute("""
        SELECT sd.drift_magnitude, sd.occurred_at,
               ss.id as subspace_id, ss.name as subspace_name,
               a.id as artifact_id, a.title as artifact_title
        FROM misir.subspace_drift sd
        JOIN misir.subspace ss ON ss.id = sd.subspace_id
        LEFT JOIN misir.signal s ON s.id = sd.trigger_signal_id
        LEFT JOIN misir.artifact a ON a.id = s.artifact_id
        WHERE ss.space_id = %(space_id)s
          AND sd.drift_magnitude > 0.3
          AND sd.occurred_at > NOW() - INTERVAL '7 days'
        ORDER BY sd.occurred_at DESC
        LIMIT 1
    """, {"space_id": space_id}).fetchone()
    
    if recent_drift:
        alerts.append({
            "type": "high_drift",
            "severity": "info",
            "headline": "Your focus is shifting",
            "description": f"After reading '{recent_drift.artifact_title}', your understanding of {recent_drift.subspace_name} evolved significantly. This is normal when exploring new perspectives.",
            "subspace_id": recent_drift.subspace_id,
            "trigger_artifact_id": recent_drift.artifact_id
        })
    
    # 3. Velocity Drop Alert
    velocity_data = db.execute("""
        SELECT AVG(velocity) as avg_velocity
        FROM misir.subspace_velocity
        WHERE subspace_id IN (
            SELECT id FROM misir.subspace WHERE space_id = %(space_id)s
        )
        AND measured_at > NOW() - INTERVAL '30 days'
    """, {"space_id": space_id}).fetchone()
    
    current_velocity = db.execute("""
        SELECT AVG(velocity) as current_velocity
        FROM misir.subspace_velocity
        WHERE subspace_id IN (
            SELECT id FROM misir.subspace WHERE space_id = %(space_id)s
        )
        AND measured_at > NOW() - INTERVAL '7 days'
    """, {"space_id": space_id}).fetchone()
    
    if velocity_data and current_velocity:
        if current_velocity.current_velocity < (velocity_data.avg_velocity * 0.5):
            alerts.append({
                "type": "velocity_drop",
                "severity": "info",
                "headline": "You've slowed down",
                "description": f"You're saving {current_velocity.current_velocity:.1f} items per week, down from your usual {velocity_data.avg_velocity:.1f}. Busy week, or losing momentum?"
            })
    
    # 4. Confidence Drop Alert
    confidence_drop = db.execute("""
        SELECT ss.id, ss.name, ss.confidence,
               h.confidence as prev_confidence
        FROM misir.subspace ss
        LEFT JOIN LATERAL (
            SELECT confidence
            FROM misir.subspace_centroid_history
            WHERE subspace_id = ss.id
              AND computed_at < NOW() - INTERVAL '7 days'
            ORDER BY computed_at DESC
            LIMIT 1
        ) h ON true
        WHERE ss.space_id = %(space_id)s
          AND ss.confidence < h.confidence - 0.2
    """, {"space_id": space_id}).fetchone()
    
    if confidence_drop:
        alerts.append({
            "type": "confidence_drop",
            "severity": "warning",
            "headline": "This topic is getting messy",
            "description": f"Your recent reads in '{confidence_drop.name}' cover very different angles. You might want to split this into separate topic areas.",
            "subspace_id": confidence_drop.id
        })
    
    return {"alerts": alerts}
```

**Which Option to Use:**
1. Check if `misir.insight` has rows: `SELECT COUNT(*) FROM misir.insight WHERE created_at > NOW() - INTERVAL '7 days'`
2. If count > 0 → Use Option A (1 hour effort)
3. If count = 0 → Use Option B (4 hour effort), then consider adding background job to populate `misir.insight` table

---

### Flow 6: Analytics Time-Series

**User Action:** View Insights tab → See Focus Over Time chart

**Frontend:**
```typescript
// components/charts/FocusOverTime.tsx
export function FocusOverTime({ spaceId }) {
  const { data: confidence } = useConfidenceTimeseries(spaceId, {
    start_date: subDays(new Date(), 30),
    end_date: new Date()
  });
  
  const { data: driftEvents } = useDriftTimeline(spaceId, {
    min_magnitude: 0.25
  });
  
  return (
    <LineChart
      data={confidence?.timeseries || []}
      xKey="date"
      yKey="confidence"
      xAxis={{ label: "Date" }}
      yAxis={{ label: "Focus", domain: [0, 1] }}
      annotations={driftEvents?.events.map(e => ({
        x: e.date,
        label: `${e.subspace_name} shifted`,
        color: "orange"
      }))}
    />
  );
}
```

**Backend Flow (Job 45c):**
```python
@router.get("/spaces/{space_id}/analytics/confidence")
def get_confidence_timeseries(
    space_id: int,
    start_date: date,
    end_date: date,
    granularity: str = "day"
):
    # Query centroid history for confidence over time
    query = """
        SELECT DATE_TRUNC(%(granularity)s, computed_at) as period,
               AVG(confidence) as avg_confidence
        FROM misir.subspace_centroid_history
        WHERE subspace_id IN (
            SELECT id FROM misir.subspace WHERE space_id = %(space_id)s
        )
        AND computed_at BETWEEN %(start_date)s AND %(end_date)s
        GROUP BY period
        ORDER BY period
    """
    
    results = db.execute(query, {
        "space_id": space_id,
        "start_date": start_date,
        "end_date": end_date,
        "granularity": granularity
    }).fetchall()
    
    return {
        "timeseries": [
            {
                "date": r.period.isoformat(),
                "confidence": r.avg_confidence
            }
            for r in results
        ]
    }
```

**Note:** If `misir.subspace_centroid_history` is empty, this endpoint returns empty array. Need to verify table is being populated.

---

## Jobs-to-be-Done: Data Pipeline Edition

### Phase 1 Backend Jobs (Week 1)

#### **Job 42: Artifacts Endpoint**
**Effort:** 2 hours  
**Status:** ✅ Repository exists, just add FastAPI route

**Implementation:**
```python
# backend/interfaces/api/artifacts_router.py
from fastapi import APIRouter, Depends
from backend.application.handlers.artifact_handler import ArtifactHandler

router = APIRouter(prefix="/spaces/{space_id}/artifacts", tags=["artifacts"])

@router.get("")
async def get_artifacts(
    space_id: int,
    page: int = 1,
    limit: int = 50,
    subspace_id: Optional[int] = None,
    sort: str = "recent",
    handler: ArtifactHandler = Depends()
):
    return handler.get_paginated(
        space_id=space_id,
        page=page,
        limit=limit,
        filters={"subspace_id": subspace_id},
        sort=sort
    )
```

**Database Query:**
```sql
SELECT a.id, a.title, a.url, a.domain, a.subspace_id,
       ss.name as subspace_name, a.engagement_level,
       a.word_count, a.captured_at, s.margin
FROM misir.artifact a
LEFT JOIN misir.signal s ON s.artifact_id = a.id
LEFT JOIN misir.subspace ss ON ss.id = a.subspace_id
WHERE a.space_id = ? AND a.deleted_at IS NULL
ORDER BY a.captured_at DESC
LIMIT ? OFFSET ?
```

**Frontend Usage:**
- Job 10: Recently Saved
- Job 22: Library Table
- Job 23: Filters

---

#### **Job 43: Alerts Endpoint**
**Effort:** 1-4 hours (depends on if insights table is populated)  
**Status:** ⚠️ Verify if `misir.insight` has data

**Critical First Step:**
```sql
-- Run this query to check
SELECT COUNT(*), severity, headline
FROM misir.insight
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY severity, headline;
```

**If count > 0:** Insights are auto-generated (1h effort)
```python
@router.get("/spaces/{space_id}/alerts")
def get_alerts(space_id: int, handler: InsightHandler = Depends()):
    return handler.get_active_by_space(space_id)
```

**If count = 0:** Generate on-demand (4h effort)
- Implement low margin detection
- Implement high drift detection  
- Implement velocity drop detection
- Implement confidence drop detection

**Frontend Usage:**
- Job 7: Alert Banner
- Job 15: Smart Alerts

---

### Phase 2 Backend Jobs (Week 2)

#### **Job 44: Topology Endpoint**
**Effort:** 6 hours (including t-SNE implementation + caching)

**Implementation:**
```python
# backend/interfaces/api/analytics_router.py
from sklearn.manifold import TSNE
import numpy as np
from functools import lru_cache

@router.get("/spaces/{space_id}/topology")
async def get_topology(
    space_id: int,
    handler: TopologyHandler = Depends()
):
    # Check cache first (1 hour TTL)
    cached = cache.get(f"topology:{space_id}")
    if cached:
        return cached
    
    # Get subspaces with centroids
    subspaces = handler.get_subspaces_with_centroids(space_id)
    
    if len(subspaces) < 2:
        return {"nodes": []}
    
    # Extract 768-dim vectors
    centroids = np.array([s.centroid_embedding for s in subspaces])
    
    # Reduce to 2D
    coords_2d = TSNE(
        n_components=2,
        random_state=42,
        perplexity=min(30, len(subspaces) - 1)
    ).fit_transform(centroids)
    
    result = {
        "nodes": [
            {
                "subspace_id": s.id,
                "name": s.name,
                "artifact_count": s.artifact_count,
                "confidence": s.confidence,
                "x": float(coords_2d[i][0]),
                "y": float(coords_2d[i][1])
            }
            for i, s in enumerate(subspaces)
        ]
    }
    
    # Cache for 1 hour
    cache.set(f"topology:{space_id}", result, ttl=3600)
    
    return result
```

**Optimization:**
- Cache result for 1 hour
- Invalidate on subspace create/update
- Consider pre-computing overnight for large spaces

**Frontend Usage:**
- Job 16: Knowledge Map (Overview tab)
- Job 19: Full-screen Map (Map tab)

---

#### **Job 45a: Drift Time-Series**
**Effort:** 1 hour  
**Status:** ✅ Table exists, just query it

**Implementation:**
```python
@router.get("/spaces/{space_id}/analytics/drift")
async def get_drift_timeseries(
    space_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    min_magnitude: float = 0.25,
    handler: DriftHandler = Depends()
):
    events = handler.get_by_space_id(
        space_id=space_id,
        start_date=start_date,
        end_date=end_date,
        min_magnitude=min_magnitude
    )
    
    return {
        "events": [
            {
                "id": e.id,
                "date": e.occurred_at.isoformat(),
                "subspace_id": e.subspace_id,
                "subspace_name": e.subspace_name,
                "drift_magnitude": e.drift_magnitude,
                "trigger_artifact": {
                    "id": e.trigger_artifact_id,
                    "title": e.trigger_title,
                    "url": e.trigger_url
                } if e.trigger_artifact_id else None
            }
            for e in events
        ]
    }
```

**Database Query:**
```sql
SELECT sd.id, sd.drift_magnitude, sd.occurred_at,
       sd.subspace_id, ss.name as subspace_name,
       a.id as trigger_artifact_id,
       a.title as trigger_title,
       a.url as trigger_url
FROM misir.subspace_drift sd
JOIN misir.subspace ss ON ss.id = sd.subspace_id
LEFT JOIN misir.signal s ON s.id = sd.trigger_signal_id
LEFT JOIN misir.artifact a ON a.id = s.artifact_id
WHERE ss.space_id = ?
  AND sd.drift_magnitude >= ?
  AND sd.occurred_at BETWEEN ? AND ?
ORDER BY sd.occurred_at DESC
```

**Frontend Usage:**
- Job 21: Drift Timeline
- Job 25: Focus Over Time (annotations)

---

#### **Job 45b: Velocity Time-Series**
**Effort:** 1 hour  
**Status:** ✅ Table exists, just query it

**Implementation:**
```python
@router.get("/spaces/{space_id}/analytics/velocity")
async def get_velocity_timeseries(
    space_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    granularity: str = "week",
    handler: VelocityHandler = Depends()
):
    timeseries = handler.get_by_space_id(
        space_id=space_id,
        start_date=start_date,
        end_date=end_date,
        granularity=granularity
    )
    
    current = timeseries[-1].velocity if timeseries else 0
    average = sum(t.velocity for t in timeseries) / len(timeseries) if timeseries else 0
    
    return {
        "timeseries": [
            {
                "period": t.period.isoformat(),
                "items_per_week": t.velocity
            }
            for t in timeseries
        ],
        "current": current,
        "average": average,
        "trend": "increasing" if current > average else "declining"
    }
```

**Database Query:**
```sql
SELECT DATE_TRUNC(?, measured_at) as period,
       AVG(velocity) as avg_velocity
FROM misir.subspace_velocity
WHERE subspace_id IN (
    SELECT id FROM misir.subspace WHERE space_id = ?
)
AND measured_at BETWEEN ? AND ?
GROUP BY period
ORDER BY period
```

**Frontend Usage:**
- Job 14: Progress metric (current vs average)
- Job 26: Reading Pace chart
- Job 36: Pace by Space

---

#### **Job 45c: Confidence Time-Series**
**Effort:** 1 hour  
**Status:** ⚠️ Verify `misir.subspace_centroid_history` is populated

**Verification:**
```sql
SELECT COUNT(*) FROM misir.subspace_centroid_history;
```

**If count > 0:** Table is populated (1h effort)  
**If count = 0:** Need to add trigger to log centroids (3h effort)

**Implementation:**
```python
@router.get("/spaces/{space_id}/analytics/confidence")
async def get_confidence_timeseries(
    space_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    granularity: str = "day",
    handler: CentroidHistoryHandler = Depends()
):
    timeseries = handler.get_confidence_timeseries(
        space_id=space_id,
        start_date=start_date,
        end_date=end_date,
        granularity=granularity
    )
    
    return {
        "timeseries": [
            {
                "date": t.date.isoformat(),
                "confidence": t.avg_confidence
            }
            for t in timeseries
        ]
    }
```

**Database Query:**
```sql
SELECT DATE_TRUNC(?, computed_at) as date,
       AVG(confidence) as avg_confidence
FROM misir.subspace_centroid_history
WHERE subspace_id IN (
    SELECT id FROM misir.subspace WHERE space_id = ?
)
AND computed_at BETWEEN ? AND ?
GROUP BY date
ORDER BY date
```

**Frontend Usage:**
- Job 25: Focus Over Time chart
- Job 27: Focus Clarity (stacked area)

---

#### **Job 45d: Margin Distribution**
**Effort:** 1 hour  
**Status:** ✅ `misir.signal.margin` exists

**Implementation:**
```python
@router.get("/spaces/{space_id}/analytics/margin_distribution")
async def get_margin_distribution(
    space_id: int,
    handler: SignalHandler = Depends()
):
    distribution = handler.get_margin_distribution(space_id)
    
    return {
        "distribution": {
            "weak": distribution.get("weak", 0),      # < 0.3
            "moderate": distribution.get("moderate", 0),  # 0.3-0.5
            "strong": distribution.get("strong", 0)   # >= 0.5
        },
        "total": sum(distribution.values())
    }
```

**Database Query:**
```sql
SELECT 
    CASE 
        WHEN margin < 0.3 THEN 'weak'
        WHEN margin < 0.5 THEN 'moderate'
        ELSE 'strong'
    END as fit_level,
    COUNT(*) as count
FROM misir.signal
WHERE space_id = ? AND margin IS NOT NULL
GROUP BY fit_level
```

**Frontend Usage:**
- Job 28: Margin Distribution histogram

---

### Frontend Jobs Requiring Backend Data

| Job | Component | Backend Dependency | Priority |
|-----|-----------|-------------------|----------|
| 7 | Alert Banner | `GET /insights` | 🟡 P1 |
| 8 | Space Cards | `GET /spaces` | 🟡 P1 |
| 10 | Recently Saved | `GET /artifacts?limit=10` | 🟡 P1 |
| 13 | Space Header | `GET /spaces/{id}` | 🟡 P1 |
| 14 | Diagnostics Panel | `GET /spaces/{id}` + `GET /analytics/velocity` | 🟡 P1 |
| 15 | Smart Alerts | `GET /spaces/{id}/alerts` | 🟡 P1 |
| 16 | Knowledge Map | `GET /spaces/{id}/topology` | 🟡 P1 |
| 17 | Coverage Analysis | `GET /spaces/{id}/subspaces` | 🟡 P1 |
| 18 | Topic Areas | `GET /spaces/{id}/subspaces` | 🟡 P1 |
| 21 | Drift Timeline | `GET /analytics/drift` | 🔵 P2 |
| 22 | Items Table | `GET /spaces/{id}/artifacts` | 🟡 P1 |
| 25 | Focus Over Time | `GET /analytics/confidence` + `/drift` | 🔵 P2 |
| 26 | Reading Pace | `GET /analytics/velocity` | 🔵 P2 |
| 28 | Margin Distribution | `GET /analytics/margin_distribution` | 🔵 P2 |

---

## Critical Verification Checklist

Before starting implementation, verify these database states:

### ✅ **Verification 1: Insights Table**
```sql
SELECT COUNT(*), severity, headline
FROM misir.insight
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY severity, headline;
```

**If count > 0:** Backend is auto-generating insights → Job 43 is 1h  
**If count = 0:** Need to build alert generation → Job 43 is 4h

---

### ✅ **Verification 2: Centroid History**
```sql
SELECT COUNT(*) FROM misir.subspace_centroid_history;
```

**If count > 0:** Centroid updates are being logged → Job 45c is 1h, Job 20 backend done  
**If count = 0:** Need to add logging trigger → Job 45c is 3h, Job 20 needs backend work

---

### ✅ **Verification 3: Engagement Level Enum**
```sql
SELECT DISTINCT engagement_level FROM misir.artifact;
```

**Expected:** `latent`, `discovered`, `engaged`, `saturated`  
**Update Job 3 (formatters.ts) to match actual values**

---

### ✅ **Verification 4: Drift Events**
```sql
SELECT COUNT(*) FROM misir.subspace_drift
WHERE occurred_at > NOW() - INTERVAL '30 days';
```

**If count > 0:** Drift detection is working → Job 45a is 1h  
**If count = 0:** Drift isn't being logged → Need to investigate backend

---

### ✅ **Verification 5: Velocity Measurements**
```sql
SELECT COUNT(*) FROM misir.subspace_velocity
WHERE measured_at > NOW() - INTERVAL '30 days';
```

**If count > 0:** Velocity tracking is working → Job 45b is 1h  
**If count = 0:** Velocity isn't being logged → Need to investigate backend

---

## Estimated Total Backend Work

**Best Case (all tables populated):**
- Job 42: 2h
- Job 43: 1h (insights exist)
- Job 44: 6h (t-SNE)
- Job 45a-d: 4h (just queries)
- **Total: 13 hours (1.5 days)**

**Worst Case (tables empty):**
- Job 42: 2h
- Job 43: 4h (build alert generation)
- Job 44: 6h (t-SNE)
- Job 45a-d: 8h (4h queries + 4h fixing logging)
- **Total: 20 hours (2.5 days)**

**Most Likely Case:**
- Some tables populated, some need work
- **Total: 15-16 hours (2 days)**

---

## Next Steps

1. **Run all 5 verification queries** (5 minutes)
2. **Update effort estimates** based on results (10 minutes)
3. **Start with Job 42** (easiest, 2 hours)
4. **Then Job 43** (1-4 hours depending on insights)
5. **Then Jobs 3-6** (frontend utilities, 13 hours)
6. **Then remaining jobs** in priority order

**You're closer than you think. Most of the hard work is already done in the database.**

🚀 **Launch target: Feb 23-25, 2026**

---

**Document Version:** 2.0  
**Last Updated:** February 11, 2026  
**Maintainers:** Jamil & Tomal
