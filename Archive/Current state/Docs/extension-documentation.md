# Misir Sensor Extension - Technical Documentation

> **Version:** 0.1.0  
> **Manifest:** Chrome Extension MV3  
> **Last Updated:** January 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Data Flow](#data-flow)
5. [NLP Pipeline](#nlp-pipeline)
6. [Storage System](#storage-system)
7. [Sync & Sessions](#sync--sessions)
8. [Engagement Metrics](#engagement-metrics)
9. [URL Filtering](#url-filtering)
10. [API Integration](#api-integration)
11. [Configuration](#configuration)
12. [File Structure](#file-structure)

---

## Overview

The Misir Sensor is a lightweight Chrome extension that **passively captures relevant web content** based on the user's cognitive Spaces. Unlike traditional bookmark managers, it uses semantic matching to automatically identify and save pages that align with the user's learning interests.

### Design Philosophy: "Sensor, Not Product"

- **Invisible**: No interruptions during browsing
- **Local-First**: Works offline, syncs when ready
- **Battery-Friendly**: Custom tokenizer, no heavy AI models
- **Privacy-Aware**: NLP runs locally, only syncs with user consent

### Key Features

| Feature | Description |
|---------|-------------|
| **Automatic Capture** | Saves relevant pages after 5s dwell time |
| **Reading Metrics** | Tracks dwell time, scroll depth, reading depth |
| **Semantic Matching** | Cosine similarity against user's Space centroids |
| **Session Tracking** | Groups related artifacts (30-min timeout) |
| **Offline Queue** | Batched sync every 30 minutes |
| **Final Pulse** | Updates metrics on page exit |
| **SPA Support** | Detects client-side navigation (React, Next.js, etc.) |
| **URL Normalization** | Strips tracking params to deduplicate artifacts |

---

## Architecture

### Split Brain Design

The extension follows a **Split Brain architecture** that separates concerns between DOM-access content scripts and DOM-free service workers:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MISIR SENSOR ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐              ┌─────────────┐              ┌─────────────┐  │
│  │   POPUP     │              │  CONTENT    │              │ BACKGROUND  │  │
│  │   (React)   │◄────────────►│  SCRIPT     │◄────────────►│  (Service   │  │
│  │             │   Messages   │  "The Eyes" │   Messages   │   Worker)   │  │
│  └─────────────┘              └─────────────┘              │ "The Brain" │  │
│        │                            │                       └──────┬──────┘  │
│        │                            │                              │        │
│        │                      ┌─────┴─────┐                        │        │
│        │                      │PageTracker│                        │        │
│        │                      │ Scraper   │                        │        │
│        │                      │ Readability│                       │        │
│        │                      └───────────┘                        │        │
│        │                                                           │        │
│        └─────────────────────────┬─────────────────────────────────┘        │
│                                  │                                          │
│                         ┌────────┴────────┐                                 │
│                         │   IndexedDB     │                                 │
│                         │  "The Vault"    │                                 │
│                         │ ┌─────────────┐ │                                 │
│                         │ │  artifacts  │ │                                 │
│                         │ │ sync_queue  │ │                                 │
│                         │ └─────────────┘ │                                 │
│                         └────────┬────────┘                                 │
│                                  │ Pulse (30 min)                           │
│                                  ▼                                          │
│                         ┌─────────────────┐                                 │
│                         │    SUPABASE     │                                 │
│                         │    + Backend    │                                 │
│                         └─────────────────┘                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | File | Context | Responsibilities |
|-----------|------|---------|------------------|
| **Content Script** | `src/content/index.ts` | Page DOM | Extract content, track engagement, send to Background |
| **PageTracker** | `src/content/tracker.ts` | Page DOM | Calculate reading metrics using 200 WPM formula |
| **Scraper** | `src/content/scrape.ts` | Page DOM | Readability-based content extraction |
| **Background** | `src/background/index.ts` | Service Worker | NLP analysis, storage, sync coordination |
| **NLP Engine** | `src/classify/nlp-engine.ts` | Service Worker | Tokenization, cosine similarity matching |
| **Storage** | `src/storage/db.ts` | Both | IndexedDB operations, queue management |
| **Sync Manager** | `src/background/sync.ts` | Service Worker | Batched uploads with exponential backoff |
| **Session Manager** | `src/background/session.ts` | Service Worker | Group artifacts by research session |
| **Popup** | `src/popup/` | Extension Popup | Quick status display, manual save |

---

## Core Components

### 1. Content Script ("The Eyes")

**File:** `src/content/index.ts`

The content script runs in every web page and handles:

```typescript
// Lifecycle
init()                    // Start tracker, schedule capture
attemptCapture()          // Entry gate after 5s dwell
sendFinalMetrics()        // Final pulse on beforeunload/visibilitychange

// Message Handlers
'getContext'              // Quick metadata
'validateSemantics'       // Content quality check
'extract' / 'SCRAPE_CONTENT' // Full Readability extraction
'getMetrics'              // Current PageTracker state
```

**SPA Navigation Detection:**

Single Page Applications (React, Next.js, YouTube, Twitter) change URLs without full page reloads. We detect this via MutationObserver:

```typescript
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    sendFinalMetrics();   // Close out previous page
    lastUrl = location.href;
    init();               // Start fresh for new page
  }
}).observe(document, { subtree: true, childList: true });
```

**Entry Gate Flow:**

```
Page Load
    │
    ▼
Start PageTracker
    │
    ▼
Wait 5 seconds ───────────────────────┐
    │                                  │
    ▼                                  │ User activity
Check: hasCaptured?                    │ resets timer
    │                                  │
    │ No                               │
    ▼                                  │
scrapePageContent(metrics) ◄───────────┘
    │
    ▼
Send ANALYZE_CONTENT → Background
    │
    ▼
If relevant: hasCaptured = true
    │
    ▼
On page exit: sendFinalMetrics()
```

### 2. PageTracker (Reading Metrics)

**File:** `src/content/tracker.ts`

Tracks engagement using the **200 WPM Formula**:

```typescript
interface EngagementMetrics {
  dwellTimeMs: number;
  scrollDepth: number;   // 0.0 to 1.0
  readingDepth: number;  // 0.0 to ~1.5
  wordCount: number;
  engagementLevel: 'ambient' | 'engaged' | 'committed';
}
```

**Reading Depth Calculation:**

```
ReadingDepth = (TimeRatio × 0.6) + (ScrollRatio × 0.4)

Where:
  TimeRatio = min(dwellTime / expectedReadTime, 1.5)
  ScrollRatio = maxScrollY / totalScrollHeight
  ExpectedReadTime = wordCount / 200 WPM
```

**Engagement Level Thresholds:**

| Level | Reading Depth | Base Weight | Decay Rate |
|-------|---------------|-------------|------------|
| `ambient` | < 0.4 | 0.2 | high |
| `engaged` | 0.4 - 0.7 | 1.0 | medium |
| `committed` | ≥ 0.7 | 2.0 | low |

### 3. Scraper (Content Extraction)

**File:** `src/content/scrape.ts`

Uses Mozilla Readability to extract clean article text:

```typescript
interface ScrapedContent {
  url: string;
  domain: string;
  title: string;
  contentText: string;     // Clean text for NLP
  rawLength: number;
  excerpt?: string;
  byline?: string;
  // Attached metrics
  dwellTimeMs?: number;
  scrollDepth?: number;
  readingDepth?: number;
  wordCount?: number;
  engagementLevel?: 'ambient' | 'engaged' | 'committed';
}
```

**Why Readability?**

- Strips ads, nav bars, footers automatically
- Battle-tested (used by Firefox Reader View)
- Fast and reliable DOM parsing

**URL Normalization:**

URLs are normalized before storage to prevent duplicates from tracking links:

```typescript
// These all become the same artifact:
// https://example.com/article?utm_source=twitter
// https://example.com/article?fbclid=abc123
// https://example.com/article

const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign',
  'ref', 'fbclid', 'gclid', 'msclkid', ...
];

function normalizeUrl(url: string): string {
  const u = new URL(url);
  TRACKING_PARAMS.forEach(p => u.searchParams.delete(p));
  return u.toString();
}
```

### 4. Background Service Worker ("The Brain")

**File:** `src/background/index.ts`

Central coordinator that:

1. Receives content from Content Script
2. Runs NLP matching against user's Spaces
3. Saves relevant artifacts to IndexedDB
4. Manages sync queue and sessions
5. Handles the Pulse (30-minute sync)

**Message API:**

| Message Type | Source | Action |
|-------------|--------|--------|
| `ANALYZE_CONTENT` | Content Script | Full NLP analysis + save |
| `UPDATE_METRICS` | Content Script | Final pulse update |
| `getTabAnalysis` | Popup | Get cached result |
| `getUserMap` | Popup | Get spaces/markers |
| `forceSync` | Popup | Trigger immediate sync |
| `refreshUserMap` | Settings | Re-download from backend |

---

## Data Flow

### Capture Flow (Automatic)

```
┌─────────────────┐
│   Page Load     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Start Tracker   │──────────────────────┐
│ Wait 5 seconds  │                      │
└────────┬────────┘                      │
         │                               │
         ▼                               │
┌─────────────────┐                      │
│ Scrape Content  │◄─────────────────────┤
│ + Get Metrics   │     User scrolls/    │
└────────┬────────┘     clicks resets    │
         │              the 5s timer     │
         ▼                               │
┌─────────────────┐                      │
│ ANALYZE_CONTENT │                      │
│ → Background    │                      │
└────────┬────────┘                      │
         │                               │
         ▼                               │
┌─────────────────┐                      │
│ NLP Analysis    │                      │
│ vs Centroids    │                      │
└────────┬────────┘                      │
         │                               │
    ┌────┴────┐                          │
    │         │                          │
    ▼         ▼                          │
┌───────┐ ┌───────┐                      │
│ Pass  │ │ Fail  │                      │
│ ≥5%   │ │ <5%   │                      │
└───┬───┘ └───────┘                      │
    │                                    │
    ▼                                    │
┌─────────────────┐                      │
│ Save to Vault   │                      │
│ Add to Queue    │                      │
└────────┬────────┘                      │
         │                               │
         ▼                               │
┌─────────────────┐                      │
│ User closes tab │◄─────────────────────┘
│ (beforeunload)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ UPDATE_METRICS  │
│ Final reading   │
│ depth/time      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Re-queue for    │
│ sync if needed  │
└─────────────────┘
```

### Sync Flow (The Pulse)

```
┌─────────────────┐
│ Alarm Fires     │  (every 30 minutes)
│ or Manual Sync  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Check Backoff   │
│ (if failed)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Get Queue Items │  (up to 50)
│ from IndexedDB  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ POST /sync      │
│ to Backend      │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌───────┐
│Success│ │ Fail  │
└───┬───┘ └───┬───┘
    │         │
    ▼         ▼
┌───────┐ ┌───────────┐
│Remove │ │ Increment │
│from Q │ │ Backoff   │
└───────┘ └───────────┘
```

---

## NLP Pipeline

### Custom Tokenizer (Service Worker Safe)

**File:** `src/classify/nlp-engine.ts`

The NLP engine runs entirely in the service worker without DOM access:

```typescript
// Tokenization Pipeline
tokenize(text: string, maxTokens = 2000): string[]
  │
  ├── toLowerCase()
  ├── Remove special chars (keep apostrophes/hyphens)
  ├── Split on whitespace
  ├── Filter: length > 2, not in STOP_WORDS
  ├── Apply simpleStem()
  └── Limit to maxTokens
```

**Stop Words:** ~100 common English words filtered out

**Simple Stemmer:** Handles common suffixes:
- `-ing`, `-tion`, `-sion`, `-ness`, `-ment`
- `-ence`, `-ance`, `-ous`, `-ive`, `-ful`, `-ly`
- `-es`, `-ed`, `-s`

### Cosine Similarity Matching

```typescript
function cosineSimilarity(
  vecA: Record<string, number>,  // Page term-frequency vector
  vecB: Record<string, number>   // Space centroid vector
): number {
  // dot(A, B) / (||A|| × ||B||)
}
```

**Thresholds:**

| Analysis Type | Threshold | Use Case |
|--------------|-----------|----------|
| Full Content | 5% | ANALYZE_CONTENT from content script |
| Quick Context | 3% | Popup display (title + URL only) |

### Space Centroids

The extension downloads pre-computed centroids from the backend:

```typescript
interface SpaceCentroid {
  spaceId: string;
  spaceName: string;
  vector: Record<string, number>;  // Term-frequency centroid
  threshold: number;               // Ignored, always use 5%
}
```

Centroids are computed from Space markers and existing artifacts.

---

## Storage System

### IndexedDB Schema

**Database:** `MisirStorage` (version 1)

**Store 1: `artifacts`** (The Vault)

| Key | Type | Description |
|-----|------|-------------|
| `url` | string | Primary key |
| `title` | string | Page title |
| `domain` | string | For grouping |
| `captured_at` | ISO string | Capture timestamp |
| `artifact_type` | enum | 'ambient' \| 'engaged' \| 'committed' |
| `content_source` | enum | 'web' \| 'ai' \| 'video' \| 'pdf' |
| `base_weight` | number | 0.2 \| 1.0 \| 2.0 |
| `decay_rate` | enum | 'high' \| 'medium' \| 'low' |
| `dwell_time_ms` | number | Total time on page |
| `scroll_depth` | number | 0-1 |
| `reading_depth` | number | 0-1.5 |
| `relevance` | number | 0-1, similarity score |
| `extracted_text` | string | First 5000 chars |
| `word_count` | number | Estimated |
| `session_id` | string | Research session |

**Indexes:** `domain`, `captured_at`, `content_type`

**Store 2: `sync_queue`** (The Outbox)

| Key | Type | Description |
|-----|------|-------------|
| `id` | auto-increment | FIFO order |
| `url` | string | Reference to artifact |
| `added_at` | number | Queue timestamp |
| `attempts` | number | Retry count |
| `last_error` | string | Last failure reason |

**Index:** `url` (unique - no duplicates)

### Key Operations

```typescript
class LocalStore {
  // Save
  saveArtifact(payload)           // Save + queue
  updateArtifactMetrics(url, m)   // Update + re-queue
  
  // Queue
  getPendingSyncItems(limit)      // Hydrated payloads
  markSynced(urls)                // Remove from queue
  recordSyncFailure(url, error)   // Increment attempts
  
  // Query
  getArtifact(url)
  getAllArtifacts()
  getRecentArtifacts(limit)
  getArtifactsByDomain(domain)
  
  // User Map
  getUserMap()
  saveUserMap(map)
}
```

### Re-Queue on Update (Race Condition Fix)

When `updateArtifactMetrics` is called (final pulse), the artifact is **re-added to the sync queue** even if it was already synced:

```typescript
// If already synced (not in queue), re-add
if (!checkRequest.result) {
  queueStore.add({ url, added_at: Date.now(), attempts: 0 });
}
```

This ensures the server gets the final engagement level even if an earlier "ambient" version was already uploaded.

---

## Sync & Sessions

### SyncManager (The Pulse)

**File:** `src/background/sync.ts`

Features:
- **Periodic Heartbeat:** Every 30 minutes via Chrome Alarm
- **Exponential Backoff:** 2^n seconds after failures (max 1 hour)
- **Batch Uploads:** Up to 50 items per sync
- **Silent Failures:** Failed items stay in queue

```typescript
class SyncManager {
  beat(force = false)      // Main sync trigger
  forceSync()              // UI-triggered sync
  getStatus()              // For popup display
  resetBackoff()           // Manual intervention
}
```

### SessionManager

**File:** `src/background/session.ts`

Groups related artifacts into research sessions:

```typescript
interface Session {
  id: string;              // YYYYMMDD-HHMMSS-random
  startedAt: number;       // Unix ms
  lastActivityAt: number;  // Unix ms
  artifactCount: number;
  tabIds: Set<number>;
}
```

**Session Rules:**
- New session starts on first artifact after 30 min inactivity
- Session ID persists in `chrome.storage.local`
- Tab tracking for multi-tab research sessions

---

## Engagement Metrics

### The 200 WPM Formula

Reading engagement is calculated using expected reading time:

```
Expected Read Time (ms) = (word_count / 200) × 60000

Time Ratio = min(actual_dwell / expected_read, 1.5)
Scroll Ratio = max_scroll_y / scrollable_height

Reading Depth = (Time Ratio × 0.6) + (Scroll Ratio × 0.4)
```

**Why cap at 1.5?** Prevents gaming by leaving tabs open overnight.

### Engagement Level → Weight Mapping

| Engagement | Reading Depth | Weight | Decay | Meaning |
|------------|---------------|--------|-------|---------|
| `ambient` | < 0.4 | 0.2 | high | Skimmed/bounced |
| `engaged` | 0.4 - 0.7 | 1.0 | medium | Read with interest |
| `committed` | ≥ 0.7 | 2.0 | low | Deep study |

### Content Type Multipliers

**File:** `src/classify/heuristics.ts`

Different content types have different "credit rates":

```typescript
const MULTIPLIERS = {
  video: 0.3,          // Passive consumption
  documentation: 1.2,  // Dense, high intent
  chat: 0.5,           // Variable quality
  code: 1.5,           // High effort
  forum: 0.8,          // Noise potential
  article: 1.0,        // Baseline
  social: 0.5,         // Anti-doomscroll
  unknown: 1.0,
};
```

---

## URL Filtering

### Blocklist System

**File:** `src/classify/blocklist.ts`

**98 URL patterns** that are never captured:

| Category | Examples |
|----------|----------|
| Browser internals | `chrome://`, `about:` |
| Dev dashboards | `supabase.com/dashboard`, `vercel.com/dashboard` |
| Email | `mail.google.com`, `outlook.live.com` |
| Messaging | `slack.com`, `discord.com/channels` |
| Social feeds | `twitter.com/home`, `linkedin.com/feed` |
| Search results | `google.com/search` |
| Commerce | `/cart`, `/checkout`, `/billing` |
| Auth | `/login`, `/signin`, `/auth/` |
| Streaming | `netflix.com`, `twitch.tv` |

### URL Classification

```typescript
function classifyUrl(url: string): 'block' | 'prioritize' | 'normal'
```

**Prioritized URLs** (learning content):
- `/docs/`, `/tutorial/`, `/guide/`
- `medium.com/`, `dev.to/`, `stackoverflow.com/questions/`
- `developer.mozilla.org/`, `reactjs.org/`
- `wikipedia.org/wiki/`

---

## API Integration

### Hybrid Approach

**File:** `src/api/client.ts`

| Operation | Method | Why |
|-----------|--------|-----|
| **Reads** | Supabase Direct | Fast, no backend latency |
| **Writes** | Backend API | Needs embedding generation |

### Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/extension/usermap` | GET | Download spaces + centroids |
| `/api/v1/extension/sync` | POST | Batch artifact upload |

### Backend Upsert

The backend uses `upsert` instead of `insert` to handle re-synced artifacts:

```python
supabase.table("artifacts").upsert(
    artifact_data,
    on_conflict="url,user_id"
).execute()
```

This allows the "final pulse" metrics to update existing records.

---

## Configuration

### manifest.json

```json
{
  "manifest_version": 3,
  "name": "Misir Sensor",
  "version": "0.1.0",
  
  "permissions": [
    "activeTab",
    "storage",
    "scripting",
    "alarms"
  ],
  
  "host_permissions": ["<all_urls>"],
  
  "background": {
    "service_worker": "src/background/index.ts",
    "type": "module"
  },
  
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["src/content/index.ts"],
    "run_at": "document_idle"
  }]
}
```

### Timing Constants

| Constant | Value | Location |
|----------|-------|----------|
| Dwell threshold | 5 seconds | `content/index.ts` |
| Session timeout | 30 minutes | `background/session.ts` |
| Sync interval | 30 minutes | `background/index.ts` |
| Max sync backoff | 1 hour | `background/sync.ts` |
| Batch size | 50 items | `background/sync.ts` |
| Map stale time | 24 hours | `background/boot.ts` |

### Thresholds

| Threshold | Value | Purpose |
|-----------|-------|---------|
| NLP similarity | 5% | Full content match |
| Quick context | 3% | Title/URL match |
| Min word count | 100 | Skip thin pages |
| Min content length | 500 chars | Skip nav pages |

---

## File Structure

```
extension/
├── manifest.json               # Chrome MV3 manifest
├── package.json                # Dependencies
├── vite.config.ts              # Vite + CRXJS build
├── tsconfig.json               # TypeScript config
│
├── src/
│   ├── types.ts                # Global type definitions
│   │
│   ├── background/
│   │   ├── index.ts            # Service worker entry (538 lines)
│   │   ├── boot.ts             # Initialization (161 lines)
│   │   ├── sync.ts             # SyncManager (130 lines)
│   │   └── session.ts          # SessionManager (235 lines)
│   │
│   ├── content/
│   │   ├── index.ts            # Content script entry (422 lines)
│   │   ├── tracker.ts          # PageTracker (161 lines)
│   │   └── scrape.ts           # Readability wrapper
│   │
│   ├── classify/
│   │   ├── index.ts            # Exports
│   │   ├── types.ts            # Classification types (240 lines)
│   │   ├── pipeline.ts         # Orchestrator (256 lines)
│   │   ├── nlp-engine.ts       # Tokenizer + cosine (247 lines)
│   │   ├── heuristics.ts       # Time assessment
│   │   ├── semantics.ts        # Content validation
│   │   ├── blocklist.ts        # URL filtering (185 lines)
│   │   └── stages/             # Pipeline stages
│   │
│   ├── storage/
│   │   └── db.ts               # IndexedDB LocalStore (661 lines)
│   │
│   ├── api/
│   │   ├── client.ts           # Hybrid API client (262 lines)
│   │   └── supabase.ts         # Supabase auth client
│   │
│   ├── popup/                  # React popup UI
│   ├── settings/               # Options page
│   ├── components/             # Shared UI components
│   └── ui/                     # shadcn/ui components
│
├── icons/                      # Extension icons
└── dist/                       # Built output
```

---

## Dependencies

### Runtime

| Package | Version | Purpose |
|---------|---------|---------|
| `@mozilla/readability` | ^0.6.0 | Article extraction |
| `@supabase/supabase-js` | ^2.93.1 | Database client |
| `react` | ^18.2.0 | UI framework |
| `lucide-react` | ^0.563.0 | Icons |
| `tailwind-merge` | ^3.4.0 | CSS utilities |

### Dev

| Package | Version | Purpose |
|---------|---------|---------|
| `@crxjs/vite-plugin` | ^2.0.0-beta.21 | Chrome extension builds |
| `vite` | ^5.0.8 | Build tool |
| `typescript` | ^5.3.3 | Type checking |
| `tailwindcss` | ^3.4.0 | Styling |

---

## Future Considerations

### Potential Improvements

1. **PDF Support**: Add `pdfjs-dist` for local PDF extraction
2. **Offline Queue UI**: Show pending sync count in popup
3. **Error Telemetry**: Track and report failures
4. **Smart Prioritization**: Use `isLearningUrl()` to boost doc sites
5. **Multi-browser**: Firefox/Edge manifest adaptations
6. **Space Drift**: Currently, centroids are static for 24 hours. If a user creates a new space on the dashboard, they must click "Refresh Map" in the extension or wait 24h. v0.2.0 could implement a silent "Map Invalidated" push notification to trigger an immediate config pull.

### Known Limitations

1. **No AI Embeddings**: Uses TF-IDF, not BERT (trade-off for battery)
2. **Single User**: No multi-profile support yet
3. **English Only**: Tokenizer/stopwords are English
4. **URL as Key**: Revisiting same URL overwrites (by design)
5. **SPA Detection**: MutationObserver-based, may have edge cases on highly dynamic apps

---

## Changelog

### 0.1.0 (January 2026)

- Initial implementation
- Split Brain architecture
- PageTracker with 200 WPM formula
- Custom NLP tokenizer (service worker safe)
- IndexedDB local-first storage
- Session tracking (30-min timeout)
- Sync queue with exponential backoff
- Final pulse metrics update
- Comprehensive URL blocklist
- Backend upsert support

**Hardening (v0.1.0-patch):**

- SPA navigation detection via MutationObserver
- URL normalization (strips 15+ tracking params)
- `visibilitychange` listener for reliable tab backgrounding
- Proper tracker cleanup on navigation
