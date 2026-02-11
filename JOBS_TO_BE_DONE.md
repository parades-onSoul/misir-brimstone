# Misir Dashboard — Jobs to be Done (REVISED)
**Source:** `MISIR_DASHBOARD_SPECIFICATION.md` v1.1  
**Date:** February 11, 2026  
**Total Jobs:** 47  
**Revision:** Updated based on actual backend architecture review

---

## ⚠️ Critical Update: Backend Is More Complete Than Expected

After reviewing `Misir Data Pipeline & Architecture Documentation`, the backend intelligence layer is **already built**:

✅ Embedding generation (768-dim via `embedding_service.py`)  
✅ Assignment margin calculation (d2 - d1 via `margin_service.py`)  
✅ Centroid updates (EMA-based via PostgreSQL RPC)  
✅ Engagement tracking (ambient/active/flow)  
✅ Reading depth metrics (0.0-1.5)  
✅ Analytics aggregation (`analytics_handler.py`)  

**Jobs 42-45 are NOT new features — they're thin API wrappers around existing logic.**

**Total backend work: ~16 hours (2 days)**

---

## Legend

| Symbol | Meaning |
|--------|---------|
| 🔴 | Critical bug / build-breaking |
| 🟡 | Phase 1 (Beta — Week 1-2) |
| 🔵 | Phase 2 (Week 3-4) |
| ⚪ | Phase 3 (Week 5-8) |

---

## 0. Critical Bugs (Fix First)

| # | Job | Reason | Effort | Status |
|---|-----|--------|--------|--------|
| 1 | 🔴 **Fix `artifacts.ts` broken import** | Imports from `@/lib/api/config` (doesn't exist). Uses `api.get()` (axios-style) but `ApiClient` uses raw fetch. **Build-breaking.** | 1h | ⬜ |
| 2 | 🔴 **Fix duplicate `Artifact` interface** | Declared twice in `types/api.ts`. Second declaration has more fields. Needs consolidation into one canonical interface. | 1h | ⬜ |

---

## 1. Foundation Layer (Utilities)

**CRITICAL:** Everything downstream depends on these. Without formatters/alerts/colors, every component will hardcode translation logic.

| # | Job | Spec Reference | Effort | Status |
|---|-----|---------------|--------|--------|
| 3 | 🟡 **Create `lib/formatters.ts`** | Appendix: Metric Calculation | 4h | ⬜ |
|   | **Purpose:** Translate backend data into user-friendly labels | | | |
|   | — `getFocusLabel(confidence)` → "Very strong" / "Strong" / "Moderate" / "Developing" / "Just starting" | | | |
|   | — `getFocusDots(confidence)` → 0-8 integer for visual gauge | | | |
|   | — `getFitLabel(margin)` → "Clear match" / "Somewhat related" / "Doesn't fit well" | | | |
|   | — `getFitColor(margin)` → green / yellow / red | | | |
|   | — `getFitDots(margin)` → 3/2/1 dots (●●● / ●●○ / ●○○) | | | |
|   | — `getReadingDepth(engagement_level)` → "Skimmed" / "Read" / "Studied" / "Deep dive" | | | |
|   | — `getSpaceStatus(metrics)` → "Looking good ✅" / "Exploring new territory ⚠️" / "Focus shifting 🔄" / "Building understanding 📊" | | | |
|   | — `formatRelativeTime(date)` → "2 hours ago" / "1 day ago" | | | |
|   | — `formatReadingTime(word_count)` → "5 min read" (based on 200 WPM) | | | |
|   | **Example:** | | | |
|   | ```typescript | | | |
|   | // Backend: { margin: 0.18, engagement_level: "ambient" } | | | |
|   | // Frontend: "Doesn't fit well ●○○, Skimmed" | | | |
|   | getFitLabel(0.18) // → "Doesn't fit well" | | | |
|   | getFitDots(0.18) // → 1 | | | |
|   | getReadingDepth("ambient") // → "Skimmed" | | | |
|   | ``` | | | |
| 4 | 🟡 **Create `lib/alerts.ts`** | Alert Writing Formula | 3h | ⬜ |
|   | **Purpose:** Generate conversational alert messages from metrics | | | |
|   | — `generateLowMarginAlert(items)` → message + suggested actions | | | |
|   | — `generateHighDriftAlert(artifact, topic)` → message | | | |
|   | — `generateVelocityDropAlert(current, average)` → message | | | |
|   | — `generateConfidenceDropAlert(topic)` → message | | | |
|   | **Example:** | | | |
|   | ```typescript | | | |
|   | generateLowMarginAlert([...items]) | | | |
|   | // Returns: | | | |
|   | // "💡 Your last 5 items don't fit neatly into your existing | | | |
|   | //  topics. This usually means you're discovering something new. | | | |
|   | //  | | | |
|   | //  What you can do: | | | |
|   | //  □ Create a new topic area | | | |
|   | //  □ Review these items together | | | |
|   | //  □ Keep exploring - we'll keep tracking" | | | |
|   | ``` | | | |
| 5 | 🟡 **Create `lib/colors.ts`** | Appendix: Color Palette | 2h | ⬜ |
|   | — `SPACE_COLORS[]` — 8 auto-assigned colors (Blue, Green, Amber, Red, Purple, Pink, Cyan, Orange) | | | |
|   | — `FOCUS_COLORS` — high (green), medium (yellow), low (red) | | | |
|   | — `FIT_COLORS` — clear (green), moderate (yellow), weak (red) | | | |
|   | — `ALERT_COLORS` — info (blue), warning (amber), success (green), danger (red) | | | |
|   | — `getSpaceColor(index)` → returns color for space at index (cycles through palette) | | | |
| 6 | 🟡 **Terminology rename (global)** | Terminology Translation Table | 4h | ⬜ |
|   | **Purpose:** Find/replace across entire frontend codebase | | | |
|   | — All UI labels: "Artifact" → "Item" / "Resource" (keep "Artifact" in API types, backend code) | | | |
|   | — "Subspace" → "Topic" / "Topic area" | | | |
|   | — "Confidence score" → "Focus" | | | |
|   | — "Drift magnitude" → "Focus shifted / is shifting" | | | |
|   | — "Assignment margin" → "How well it fits" / "Fit" | | | |
|   | — Engagement levels: Latent→"Skimmed", Discovered→"Read", Engaged→"Studied", Saturated→"Deep dive" | | | |
|   | — But: Keep technical terms in `types/api.ts`, backend responses, settings page | | | |
|   | **Files to update:** All `.tsx` files in `app/`, all UI component labels, placeholder text | | | |

---

## 2. Home / Command Center (`/dashboard`)

| # | Job | Spec Section | Effort | Phase | Status |
|---|-----|-------------|--------|-------|--------|
| 7 | **Alert Banner** (conditional, top of page) | 1.A | 2h | 🟡 | ⬜ |
|   | Shows: "⚠️ 2 spaces need your attention" | | | | |
|   | Trigger: Query `/spaces/{id}/alerts` for all spaces, count alerts with severity >= warning | | | | |
|   | Click: expand inline summary or navigate to first space with alerts | | | | |
|   | **Dependency:** Job 43 (alerts endpoint) | | | | |
| 8 | **Space Cards** (card grid, responsive) | 1.B | 4h | 🟡 | ⬜ |
|   | Each card: name, goal, status label, last active, Focus gauge (1-8 dots), Consistency gauge | | | | |
|   | Status derived from confidence/drift/margin using `getSpaceStatus()` (Job 3) | | | | |
|   | Focus gauge uses `getFocusDots(confidence)` (Job 3) | | | | |
|   | **Dependency:** Job 3 (formatters) | | | | |
| 9 | **Activity Chart** (30-day line chart) | 1.C | 3h | 🟡 | ⬜ |
|   | Items saved per day, color-coded by space (max 5 + "Other") | | | | |
|   | Weekly summary bar: "This week: 15 items saved across 3 spaces" | | | | |
|   | Interactive: hover for exact counts | | | | |
|   | **Library:** Recharts or similar | | | | |
| 10 | **Recently Saved** (last 10 real items) | 1.D | 2h | 🟡 | ⬜ |
|   | Each: title (truncated 60 chars), space name, relative timestamp | | | | |
|   | Click → open source URL in new tab | | | | |
|   | Currently shows hardcoded dummy data — needs real `useAllArtifacts()` data | | | | |
|   | **Dependency:** Job 42 (artifacts endpoint with pagination) | | | | |

---

## 2.5 Onboarding (`/dashboard` — first visit)

| # | Job | Spec Section | Effort | Phase | Status |
|---|-----|-------------|--------|-------|--------|
| 11 | 🟡 **First-time user onboarding flow** | New (UX gap) | 4h | ⬜ |
|   | **Trigger:** user has 0 spaces OR `localStorage.misir_onboarded !== 'true'` | | | |
|   | **UI:** Modal or inline card on empty dashboard: | | | |
|   | — "Welcome to Misir! Let's create your first space." | | | |
|   | — Input: "What do you want to research?" (placeholder: "e.g., Quantum Computing") | | | |
|   | — Input: "What's your goal?" (placeholder: "e.g., Understand error mitigation") | | | |
|   | — [Create space →] button | | | |
|   | **Flow:** Calls `useCreateSpace(name, goal)` → redirects to `/spaces/{id}` → sets `localStorage.misir_onboarded = 'true'` | | | |
|   | **Why:** Without this, new users land on empty dashboard with no guidance | | | |

---

## 3. Space Detail (`/spaces/[id]`)

### Structure

| # | Job | Spec Section | Effort | Phase | Status |
|---|-----|-------------|--------|-------|--------|
| 12 | **Tab navigation** — Overview (default), Map, Library, Insights | Space Detail Navigation | 1h | 🟡 | ⬜ |
|   | Use Next.js App Router with URL params: `/spaces/[id]?tab=overview` | | | | |

### Tab: Overview

| # | Job | Spec Section | Effort | Phase | Status |
|---|-----|-------------|--------|-------|--------|
| 13 | **Space Header** — name, goal, start date, edit/settings/archive actions | 2 Overview A | 2h | 🟡 | ⬜ |
|   | Display: Space name (editable), "Your goal: {goal}" (editable), "Started: {date}" | | | | |
|   | Actions: Edit goal (inline or modal), Settings (gear icon), Archive (three-dot menu) | | | | |
| 14 | **"How You're Doing" panel** — Focus (dots), Consistency, Progress (items/week) | 2 Overview B | 3h | 🟡 | ⬜ |
|   | **Focus:** `getFocusLabel(confidence)` + `getFocusDots(confidence)` visual gauge | | | | |
|   | **Consistency:** Derived from velocity stability over 4 weeks ("Excellent" / "Good" / "Uneven") | | | | |
|   | **Progress:** "2-3 items per week" (avg over last 4 weeks) | | | | |
|   | **Dependency:** Job 3 (formatters) | | | | |
| 15 | **Smart Alerts** (conditional cards) | 2 Overview C | 4h | 🟡 | ⬜ |
|   | Query `/spaces/{id}/alerts` and render returned alerts | | | | |
|   | **Alert types:** | | | | |
|   | — Low margin: Trigger avg margin < 0.3 for last 5 items | | | | |
|   | — High drift: Trigger drift > 0.3 | | | | |
|   | — Velocity drop: Trigger velocity < 50% of 30d avg | | | | |
|   | — Confidence drop: Trigger confidence drops > 0.2 in one week | | | | |
|   | **UI:** Alert card with icon, message (from `lib/alerts.ts`), suggested actions as checkboxes, "View items →" link | | | | |
|   | **Dependency:** Jobs 4 (alerts.ts), 43 (alerts endpoint) | | | | |
| 16 | **Knowledge Map** (interactive bubble chart) | 2 Overview D | 12h | 🟡 | ⬜ |
|   | **CRITICAL:** This is your hardest job. Budget 2 full days. | | | | |
|   | **Encoding:** | | | | |
|   | — Bubble size = items in topic | | | | |
|   | — Color intensity = focus level (confidence: bright = high, faded = low) | | | | |
|   | — Border thickness = recent activity (thick = 24h, medium = 1 week, thin = older) | | | | |
|   | — Distance = semantic similarity (from centroid vectors) | | | | |
|   | **Interactions:** | | | | |
|   | — Hover → tooltip (name, count, focus level, last active) | | | | |
|   | — Click bubble → filter library to that topic | | | | |
|   | — Zoom/pan enabled (D3 or react-force-graph) | | | | |
|   | **Min size:** 300x400px, full-width on desktop, scrollable on mobile | | | | |
|   | **Dependency:** Job 44 (topology endpoint with 2D coordinates) | | | | |
|   | **Fallback:** If not working by Day 2, ship simplified version (static bubbles, no zoom, random placement) | | | | |
| 17 | **Coverage Analysis** | 2 Overview E | 3h | 🟡 | ⬜ |
|   | **Logic:** | | | | |
|   | — "You know a lot about:" topics with >8 items AND confidence >0.7 | | | | |
|   | — "Just starting:" topics with 3-7 items OR confidence 0.4-0.7 | | | | |
|   | — "Possible gap:" topics with <3 items AND low margin (<0.3) | | | | |
|   | **Suggestions:** Pull from unassigned items or show "No suggestions yet" | | | | |
| 18 | **Topic Areas** (expandable list) | 2 Overview F | 3h | 🟡 | ⬜ |
|   | **Collapsed state:** name, count, focus description (from `getFocusLabel()`) | | | | |
|   | **Expanded state:** last active, 3 most recent items, "View all items" link | | | | |
|   | **Actions:** Rename topic, Merge topics, Delete topic (context menu) | | | | |
|   | **Button:** "+ Create new topic area" | | | | |

### Tab: Map

| # | Job | Spec Section | Effort | Phase | Status |
|---|-----|-------------|--------|-------|--------|
| 19 | **Full-screen topology** — enhanced bubble map | 2 Map A | 8h | 🔵 | ⬜ |
|   | Larger canvas (fills viewport), 2D projection (t-SNE/UMAP from backend) | | | | |
|   | Filters: Show/hide by confidence, engagement level, date range | | | | |
|   | **Dependency:** Job 44 (topology endpoint) | | | | |
| 20 | **Time slider** — playback centroid movement over time | 2 Map A | 6h | 🔵 | ⬜ |
|   | Slider at bottom, play/pause, speed controls (1x/2x/5x) | | | | |
|   | Animates centroid positions from historical data | | | | |
|   | **Dependency:** Backend stores centroid history (check if implemented) | | | | |
| 21 | **Drift timeline** — "Significant Shifts Detected" list | 2 Map B | 4h | 🔵 | ⬜ |
|   | Shows: date, topic, triggering artifact, natural-language change description | | | | |
|   | Query: `/spaces/{id}/analytics/drift` filtered by drift > 0.25 | | | | |

### Tab: Library

| # | Job | Spec Section | Effort | Phase | Status |
|---|-----|-------------|--------|-------|--------|
| 22 | **Full items table** | 2 Library B | 6h | 🟡 | ⬜ |
|   | **Columns:** | | | | |
|   | — Title (icon for type + truncated to 50 chars, clickable to source) | | | | |
|   | — Topic (color badge matching map) | | | | |
|   | — Fit (●●● / ●●○ / ●○○ using `getFitDots()`, color from `getFitColor()`) | | | | |
|   | — Reading Depth (using `getReadingDepth(engagement_level)`) | | | | |
|   | — Time Spent (from `word_count / 200` or actual `dwell_time_ms` if available) | | | | |
|   | — Saved (relative timestamp via `formatRelativeTime()`) | | | | |
|   | **Interactions:** | | | | |
|   | — Row click → open source URL | | | | |
|   | — Hover → preview card | | | | |
|   | — Context menu → Open/Move/Assign/Delete | | | | |
|   | **Dependency:** Jobs 3 (formatters), 42 (artifacts endpoint) | | | | |
| 23 | **Search + Sort + Filter** | 2 Library A+C | 4h | 🟡 | ⬜ |
|   | **Search:** Real-time semantic within space (debounced 300ms) | | | | |
|   | **Sort:** Recent, Oldest, Most relevant, Reading time, Best fit, Doesn't fit well | | | | |
|   | **Filter panel (slide-in):** | | | | |
|   | — Topic checkboxes (all topics in space) | | | | |
|   | — Reading Depth checkboxes (Skimmed/Read/Studied/Deep dive) | | | | |
|   | — Fit checkboxes (Clear/Moderate/Weak) | | | | |
|   | — Date range (Last 7/30/90 days, All time, Custom) | | | | |
| 24 | **Bulk actions** — multi-select with Move/Assign/Delete | 2 Library C | 3h | 🔵 | ⬜ |
|   | Checkbox selection on rows, action bar appears: "✓ 3 items selected [Move] [Assign topic] [Delete]" | | | | |

### Tab: Insights

| # | Job | Spec Section | Effort | Phase | Status |
|---|-----|-------------|--------|-------|--------|
| 25 | **Focus Over Time** — line chart | 2 Insights A.1 | 3h | 🔵 | ⬜ |
|   | X-axis: Date (30 days), Y-axis: Confidence (0-1) | | | | |
|   | Annotations: Drift events marked with dots (from `/analytics/drift`) | | | | |
|   | Hover: exact confidence + triggering item | | | | |
| 26 | **Reading Pace** — line chart | 2 Insights A.2 | 2h | 🔵 | ⬜ |
|   | Items per week over 30 days, trend arrow, peak/slowest week callout | | | | |
| 27 | **Focus Clarity** — stacked area chart | 2 Insights A.3 | 3h | 🔵 | ⬜ |
|   | Shows % of items by fit level over time (Clear/Moderate/Weak) | | | | |
| 28 | **Margin Distribution** — histogram | 2 Insights B | 2h | 🔵 | ⬜ |
|   | X-axis: Margin ranges (0-0.3, 0.3-0.5, 0.5+), Y-axis: Item count | | | | |
|   | Callout: "⚠️ 6 items have weak connections (margin <0.3)" | | | | |
| 29 | **Engagement Distribution** — donut chart | 2 Insights C | 2h | 🔵 | ⬜ |
|   | Segments: Skimmed/Read/Studied/Deep dive with % and counts | | | | |
|   | Insight text: "You're doing more deep reading than most users" | | | | |
| 30 | **Source Diversity** — horizontal bar chart | 2 Insights D | 2h | 🔵 | ⬜ |
|   | Top 5 domains, % of total items, insight about diversity or echo chamber | | | | |
| 31 | **Most Important Reads** — ranked list | 2 Insights E | 3h | 🔵 | ⬜ |
|   | Top 3-5 items ranked by (WESA × engagement), drift-trigger events get boosted | | | | |
|   | Shows: title, source, date, impact reason ("Triggered major shift in X topic") | | | | |

---

## 4. Global Analytics (`/analytics`)

| # | Job | Spec Section | Effort | Phase | Status |
|---|-----|-------------|--------|-------|--------|
| 32 | **System Overview** | 3.A | 2h | 🔵 | ⬜ |
|   | Total items, active spaces, overall focus (weighted avg confidence as dots), system health | | | | |
| 33 | **Time Allocation** — pie chart | 3.B | 2h | 🔵 | ⬜ |
|   | Reading time by space (via `word_count / 200` proxy) | | | | |
|   | Insight: "You said Coffee was priority, but 60% time on Social Ent" | | | | |
| 34 | **Activity Heatmap** — GitHub-style grid | 3.D | 4h | 🔵 | ⬜ |
|   | 90 days, Mon-Sun rows, color intensity = item count | | | | |
|   | Pattern insight: "Most productive Mon-Wed, drop off Thu-Fri" | | | | |
| 35 | **Cross-space weak items** | 3.C | 2h | 🔵 | ⬜ |
|   | Items with margin <0.3 across ALL spaces, table + "Review these →" link | | | | |
| 36 | **Pace by Space** — horizontal bar chart | 3.E | 2h | 🔵 | ⬜ |
|   | Items/week per space, fastest/slowest callout | | | | |

---

## 5. Search (`/search`)

| # | Job | Spec Section | Effort | Phase | Status |
|---|-----|-------------|--------|-------|--------|
| 37 | **Enhance results** | 4.B | 3h | 🟡 | ⬜ |
|   | Add: relevance gauge (●●●●○), snippet with highlighted query terms, engagement level, reading time, space color badge | | | | |
|   | **Dependency:** Job 3 (formatters) | | | | |
| 38 | **Filter sidebar** | 4.C | 3h | 🔵 | ⬜ |
|   | Reading depth filter, date range, relevance threshold slider (0.5-1.0), per-space checkboxes | | | | |

---

## 6. Settings (`/settings`) — New Page

| # | Job | Spec Section | Effort | Phase | Status |
|---|-----|-------------|--------|-------|--------|
| 39 | **Appearance** | 5.A | 2h | 🔵 | ⬜ |
|   | Theme (Light/Dark/Auto), Density (Comfortable/Compact/Cozy) | | | | |
| 40 | **Privacy & Data** | 5.C | 3h | 🔵 | ⬜ |
|   | Retention policy selector, JSON/CSV export buttons, account deletion warning | | | | |
| 41 | **Advanced** | 5.D | 4h | 🔵 | ⬜ |
|   | "How Misir Works" explainer, model config display (embedding model, learning rate, drift sensitivity, margin threshold), diagnostics (embedding count, DB size, last sync) | | | | |
|   | Link to algorithms.md on GitHub | | | | |

---

## 7. Backend Integration (API Wrappers)

**CRITICAL UPDATE:** These are **NOT new features**. The intelligence layer already exists in the backend. We're just exposing it via REST API.

| # | Job | Current Status | Work Needed | Effort | Phase | Status |
|---|-----|----------------|-------------|--------|-------|--------|
| 42 | **`GET /spaces/{id}/artifacts`** | ✅ Repository method exists (`artifact_repo.get_by_space_id()`) | Add FastAPI route with pagination parameter, serialize existing data | 2h | 🟡 | ⬜ |
|   | **Return fields:** `id, title, url, subspace_id, margin, engagement_level, dwell_time_ms, created_at` | All fields already in DB schema | Just return them | | | |
|   | **Implementation:** | | | | | |
|   | ```python | | | | | |
|   | @router.get("/spaces/{space_id}/artifacts") | | | | | |
|   | def get_artifacts(space_id: int, page: int = 1, limit: int = 50): | | | | | |
|   |     offset = (page - 1) * limit | | | | | |
|   |     artifacts = artifact_repo.get_by_space_id( | | | | | |
|   |         space_id, limit=limit, offset=offset | | | | | |
|   |     ) | | | | | |
|   |     return {"items": artifacts, "page": page, "total": count} | | | | | |
|   | ``` | | | | | |
| 43 | **`GET /spaces/{id}/alerts`** | ✅ Logic exists (margin thresholds in `margin_service.py`, drift in `subspace_analytics.py`) | New handler that queries existing metrics, formats as alert objects | 4h | 🟡 | ⬜ |
|   | **Alert types:** `low_margin`, `high_drift`, `velocity_drop`, `confidence_drop` | Thresholds already defined in code | Wrap in JSON with severity + suggested_actions | | | |
|   | **Implementation:** | | | | | |
|   | ```python | | | | | |
|   | @router.get("/spaces/{space_id}/alerts") | | | | | |
|   | def get_space_alerts(space_id: int): | | | | | |
|   |     alerts = [] | | | | | |
|   |     | | | | | |
|   |     # Low margin check | | | | | |
|   |     recent = artifact_repo.get_recent(space_id, limit=5) | | | | | |
|   |     avg_margin = sum(a.margin for a in recent) / len(recent) | | | | | |
|   |     if avg_margin < 0.3: | | | | | |
|   |         alerts.append({ | | | | | |
|   |             "type": "low_margin", | | | | | |
|   |             "severity": "warning", | | | | | |
|   |             "message": "Your last 5 items don't fit neatly...", | | | | | |
|   |             "affected_artifacts": [a.id for a in recent], | | | | | |
|   |             "suggested_actions": [ | | | | | |
|   |                 "Create a new topic area", | | | | | |
|   |                 "Review these items together" | | | | | |
|   |             ] | | | | | |
|   |         }) | | | | | |
|   |     | | | | | |
|   |     # Similar for drift, velocity, confidence... | | | | | |
|   |     # (query subspace_analytics, compare to thresholds) | | | | | |
|   |     | | | | | |
|   |     return {"alerts": alerts} | | | | | |
|   | ``` | | | | | |
| 44 | **`GET /spaces/{id}/topology`** | ✅ Centroids exist in DB (`subspace.centroid_embedding` VECTOR(768)) | Query centroids, apply t-SNE/UMAP for 2D projection, return coordinates | 6h | 🔵 | ⬜ |
|   | **Return fields:** `subspace_id, name, artifact_count, confidence, x, y` | Centroids stored, need dimensionality reduction | Use `sklearn.manifold.TSNE` | | | |
|   | **Implementation:** | | | | | |
|   | ```python | | | | | |
|   | from sklearn.manifold import TSNE | | | | | |
|   | import numpy as np | | | | | |
|   | | | | | | |
|   | @router.get("/spaces/{space_id}/topology") | | | | | |
|   | def get_space_topology(space_id: int): | | | | | |
|   |     subspaces = subspace_repo.get_by_space_id(space_id) | | | | | |
|   |     | | | | | |
|   |     # Extract 768-dim centroids | | | | | |
|   |     centroids = [s.centroid_embedding for s in subspaces] | | | | | |
|   |     centroids_array = np.array(centroids) | | | | | |
|   |     | | | | | |
|   |     # Reduce to 2D | | | | | |
|   |     coords_2d = TSNE(n_components=2, random_state=42) \ | | | | | |
|   |                    .fit_transform(centroids_array) | | | | | |
|   |     | | | | | |
|   |     return { | | | | | |
|   |         "nodes": [ | | | | | |
|   |             { | | | | | |
|   |                 "subspace_id": s.id, | | | | | |
|   |                 "name": s.name, | | | | | |
|   |                 "artifact_count": s.artifact_count, | | | | | |
|   |                 "confidence": s.confidence, | | | | | |
|   |                 "x": float(coords_2d[i][0]), | | | | | |
|   |                 "y": float(coords_2d[i][1]) | | | | | |
|   |             } | | | | | |
|   |             for i, s in enumerate(subspaces) | | | | | |
|   |         ] | | | | | |
|   |     } | | | | | |
|   | ``` | | | | | |
|   | **Note:** For production, cache t-SNE results (expensive computation) | | | | | |
| 45 | **Analytics time-series endpoints** | ✅ `analytics_handler.py` already does aggregation | Extend to accept date ranges, return arrays instead of single values | 4h | 🔵 | ⬜ |
|   | **Endpoints to add:** | | | | | |
|   | — `GET /spaces/{id}/analytics/drift?start_date=X&end_date=Y` | Drift events stored in DB | Query by date range | | | |
|   | — `GET /spaces/{id}/analytics/velocity?start_date=X&end_date=Y` | Velocity in `subspace_analytics.py` | Return time series | | | |
|   | — `GET /spaces/{id}/analytics/confidence?start_date=X&end_date=Y` | Confidence in `subspace.confidence` | Return time series | | | |
|   | — `GET /spaces/{id}/analytics/margin_distribution` | Margin in `artifact.margin` | GROUP BY ranges, return histogram | | | |
|   | **Implementation pattern (drift example):** | | | | | |
|   | ```python | | | | | |
|   | @router.get("/spaces/{space_id}/analytics/drift") | | | | | |
|   | def get_drift_timeseries( | | | | | |
|   |     space_id: int, | | | | | |
|   |     start_date: Optional[date] = None, | | | | | |
|   |     end_date: Optional[date] = None | | | | | |
|   | ): | | | | | |
|   |     # Query drift_events table (or compute from centroid history) | | | | | |
|   |     events = subspace_analytics.get_drift_events( | | | | | |
|   |         space_id, start_date, end_date | | | | | |
|   |     ) | | | | | |
|   |     return { | | | | | |
|   |         "timeseries": [ | | | | | |
|   |             { | | | | | |
|   |                 "date": e.timestamp.isoformat(), | | | | | |
|   |                 "drift_magnitude": e.drift_magnitude, | | | | | |
|   |                 "subspace_id": e.subspace_id, | | | | | |
|   |                 "triggering_artifact_id": e.artifact_id | | | | | |
|   |             } | | | | | |
|   |             for e in events | | | | | |
|   |         ] | | | | | |
|   |     } | | | | | |
|   | ``` | | | | | |

**Total Backend Work: ~16 hours (2 days)**

**Key Insight:** The math model is done. The embeddings are working. Centroids are updating. We're just exposing these via REST API.

---

## 8. Shell / Navigation / Cross-Cutting

| # | Job | Spec Section | Effort | Phase | Status |
|---|-----|-------------|--------|-------|--------|
| 46 | **Sidebar nav update** | Information Architecture | 1h | 🟡 | ⬜ |
|   | Links: Home, Spaces (dropdown?), Analytics, Search, Settings | | | | |
|   | Labels match spec IA | | | | |
| 47 | **Responsive breakpoints** | Responsive Breakpoints | 8h | ⚪ | ⬜ |
|   | Mobile (<640px): 1 col, hide map tab, simplified cards | | | | |
|   | Tablet (640-1024): 2 col, condensed | | | | |
|   | Desktop (>1024): full features | | | | |

---

## Phase 1 Summary (Beta — Week 1-2)

**Goal:** Minimum viable insights for first 50 users

**Must Ship:** Jobs 1-18, 22-23, 37, 42-43, 46  
**Total Effort:** ~70 hours (2 developers × 1 week = feasible)

### Execution Order

**Week 1:**
```
Day 1-2: Foundation (Jobs 1-6) — 16h
         • Fix critical bugs
         • Build formatters/alerts/colors
         • Terminology rename
         
Day 3:   Backend endpoints (Jobs 42-43) — 6h
         • Artifacts pagination
         • Alerts generation
         
Day 4-5: Home page (Jobs 7-10, 46) — 12h
         • Command center
         • Space cards
         • Activity chart
         • Nav update
```

**Week 2:**
```
Day 8-10:  Space Overview (Jobs 12-18) — 24h
           • Header + diagnostics
           • Smart alerts
           • Knowledge map (budget 12h!)
           • Coverage + topics
           
Day 11-12: Library + Search (Jobs 22-23, 37) — 13h
           • Items table
           • Filters
           • Search enhancement
           
Day 13:    Onboarding (Job 11) — 4h
           
Day 14:    Integration testing + bug fixes
```

**Launch Target: Feb 23-25, 2026**

---

## Phase 2 Summary (Week 3-4)

**Add depth:** Jobs 19-21, 24-36, 38-41, 44-45  
**Goal:** Power user features + analytics

**Total Effort:** ~70 hours

---

## Phase 3 Summary (Week 5-8)

**Iterate:** Job 47 + responsive polish, A/B test alert wording, mobile views  
**Goal:** Based on real usage data

---

## Critical Success Factors

### 1. Foundation First (Jobs 3-5)
Without formatters/alerts/colors, you'll hardcode translation logic everywhere. This creates tech debt. **Do these first.**

### 2. Budget Time for Knowledge Map (Job 16)
The interactive topology visualization is your hardest job. It's also your "wow" feature. Budget 2 full days (12h).

**Fallback plan:** If not working by Day 10, ship simplified version:
- Static bubbles (no zoom/pan)
- Click opens topic (no filtering)
- Random placement (no semantic distance)

You can enhance in Phase 2.

### 3. Backend Integration is Easy
Jobs 42-45 are **thin wrappers**, not new features. The intelligence layer exists. Don't overthink these.

### 4. Test With Real Data
Before public beta:
1. Use Misir yourself for 7 days (both founders)
2. Get 3 friends to use it for 7 days
3. Manually verify alerts make sense
4. Tune thresholds if needed (margin <0.3, drift >0.25, etc.)

### 5. Prioritize Aha Moment
Users need to see value in **first session**. Consider:
- Upload browser history on signup → instant insights
- Or: Pre-seed spaces with curated content → immediate knowledge map

Without this, activation rate will suffer.

---

## What This Enables for YC

If you launch beta before YC decisions and send an update:

> Subject: Misir Update - Beta Launched
> 
> We launched public beta on Feb 25. 150 users in first week via BRAC University and Rebelbase network.
> 
> 12 users hit "aha moment" (detected blind spots in their research) within 48 hours. 3 asked about paid plans.
> 
> Demo: [link]
> Testimonial: [researcher quote]

**That changes the narrative** from "interesting idea" to "live product with traction."

---

## Changelog

**v1.1 (Feb 11, 2026)**
- Revised based on actual backend architecture review
- Updated Jobs 42-45 with implementation details and effort estimates
- Added code examples for backend endpoints
- Clarified that backend work is API wrappers, not new features
- Adjusted timeline: 12-14 days to functional beta (was 14 days)

**v1.0 (Feb 10, 2026)**
- Initial job breakdown from dashboard spec
- 47 jobs across 3 phases
- Execution order defined

---

**Status:** Ready for execution  
**Next Review:** After Phase 1 beta launch  
**Maintainers:** Jamil & Tomal