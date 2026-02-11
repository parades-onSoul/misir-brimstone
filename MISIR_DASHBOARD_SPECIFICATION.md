# Misir Dashboard Specification
**Version:** 1.0  
**Date:** February 10, 2026  
**Purpose:** User-facing dashboard for knowledge state tracking and blind spot detection

---

## Table of Contents
1. [Product Philosophy](#product-philosophy)
2. [Dashboard Structure](#dashboard-structure)
3. [Detailed Page Specifications](#detailed-page-specifications)
4. [Language & Terminology Guidelines](#language--terminology-guidelines)
5. [Implementation Priority](#implementation-priority)
6. [Technical Notes](#technical-notes)

---

## Product Philosophy

### What We're Building
Misir is a **real-time knowledge state tracker** that helps researchers, executives, and knowledge workers detect blind spots before making decisions. We're not building a bookmark manager - we're building computational infrastructure for situation awareness.

### Core Principles
1. **Actionable over descriptive** - Every metric should suggest what to do next
2. **Simple language, complex math** - Hide the complexity, show the insights
3. **Visual-first** - Show topology, don't just list data
4. **Progressive disclosure** - Casual users see simple views, power users can go deep

### Target Users
- Academic researchers drowning in papers
- Strategic executives making high-stakes decisions
- Grant reviewers evaluating proposals
- Founders researching markets
- Analysts synthesizing intelligence

---

## Dashboard Structure

### Information Architecture

```
/dashboard (Home/Command Center)
├── /spaces/[id] (Space Detail)
│   ├── Overview (default)
│   ├── Map
│   ├── Library
│   └── Insights
├── /analytics (Global Analytics)
├── /search (Semantic Search)
└── /settings (Preferences & Advanced)
```

---

## Detailed Page Specifications

---

## 1. Home / Command Center
**Route:** `/dashboard`  
**Purpose:** Daily command center - "What needs my attention right now?"

### Layout Components

#### A. Alert Banner (top, conditional)
**Shows when:** Blind spots detected or significant drift events

```
⚠️ 2 spaces need your attention
```

Click expands inline summary or navigates to space.

---

#### B. Your Spaces (primary section)

**Card Grid Layout** (responsive: 1 col mobile, 2-3 cols desktop)

Each Space Card contains:

```
┌─────────────────────────────────────────┐
│ Social Entrepreneurship                 │
│ Goal: Learn social business models      │
│                                         │
│ Status: Exploring new territory  ⚠️    │
│ Last active: 2 hours ago                │
│                                         │
│ Focus:       Strong ●●●●●○○○            │
│ Consistency: Good ●●●●○○○○              │
│                                         │
│ [View Space →]                          │
└─────────────────────────────────────────┘
```

**Status Types:**
- ✅ "Looking good" (high confidence, low drift)
- ⚠️ "Exploring new territory" (low margins detected)
- 🔄 "Focus shifting" (high drift detected)
- 📊 "Building understanding" (low artifact count, stable)

**Data Displayed:**
- Space name
- User's stated goal
- Status assessment (derived from confidence/drift/margin)
- Last activity timestamp
- Focus score (visual gauge: confidence translated to 1-8 dots)
- Consistency score (visual gauge: velocity consistency)

---

#### C. Activity Overview

**Chart: "Your research activity over the last 30 days"**
- Line chart showing items saved per day
- Color-coded by space (max 5 spaces shown, rest grouped as "Other")
- Interactive: hover for exact counts
- Shows momentum patterns

**Weekly Summary Bar:**
```
This week: 15 items saved across 3 spaces
```

---

#### D. Recently Saved

**List View** (last 10 items)

```
• Yunus Centre - What is Social Business
  Social Entrepreneurship • 5 minutes ago
  
• GitHub: quantum-error-mitigation 
  Quantum Computing • 2 hours ago
  
• ArXiv: Black Hole Information Paradox
  Quantum Computing • 1 day ago
```

**Each item shows:**
- Title (truncated at 60 chars)
- Space name
- Relative timestamp

Click item → opens source URL in new tab

---

## 2. Space Detail
**Route:** `/dashboard/spaces/[id]`  
**Purpose:** Deep dive into a single knowledge domain

### Navigation Tabs
- **Overview** (default)
- **Map** (visual topology)
- **Library** (all items)
- **Insights** (analytics)

---

### Tab: Overview

#### A. Space Header

```
Social Entrepreneurship
Your goal: "Learn social business models in depth"
Started: January 15, 2026
```

**Actions:**
- Edit goal (pencil icon)
- Space settings (gear icon)
- Archive space (three-dot menu)

---

#### B. How You're Doing (Primary Diagnostic Panel)

```
┌─ Space Health ────────────────────────────┐
│                                           │
│ Focus:        Strong ●●●●●○○○             │
│ Consistency:  Good ●●●●○○○○               │
│ Progress:     2-3 items per week          │
│                                           │
└───────────────────────────────────────────┘
```

**Metric Definitions:**
- **Focus** = Confidence score translated to 1-8 scale
  - 0.8-1.0: "Very strong" (8 dots)
  - 0.6-0.8: "Strong" (6 dots)
  - 0.4-0.6: "Moderate" (4 dots)
  - 0.2-0.4: "Developing" (2 dots)
  - 0.0-0.2: "Just starting" (1 dot)

- **Consistency** = Velocity stability over 4 weeks
  - Steady pace: "Excellent"
  - Minor fluctuation: "Good"
  - Irregular: "Uneven"

- **Progress** = Average items/week over last 4 weeks

---

#### C. Smart Alerts (Conditional)

**Alert Type 1: Low Assignment Margin**

```
💡 We noticed something interesting:

Your last 5 items don't fit neatly into your 
existing topics. This usually means you're 
discovering something new.

What you can do:
□ Create a new topic area
□ Review these items together
□ Keep exploring - we'll keep tracking

[View items →]
```

**Trigger:** Average margin < 0.3 for last 5 items

---

**Alert Type 2: High Drift**

```
🔄 Your focus is shifting:

After reading "Social Business Failures," your 
understanding of this space evolved significantly.

This is normal when exploring new perspectives.

[See what changed →]
```

**Trigger:** Drift magnitude > 0.3 in last update

---

**Alert Type 3: Velocity Drop**

```
📉 You've slowed down:

You're saving 1-2 items per week, down from 
your usual 4-5.

Busy week, or losing momentum?
```

**Trigger:** Current velocity < 50% of 30-day average

---

**Alert Type 4: Confidence Drop**

```
⚠️ This topic is getting messy:

Your recent reads cover very different angles. 
You might want to split this into separate 
topic areas.

[Review topics →]
```

**Trigger:** Confidence drops >0.2 in one week

---

#### D. Your Knowledge Map (Visual Component)

**Interactive Bubble/Node Chart**

**Visual Encoding:**
- **Bubble size** = Number of items in topic
- **Bubble color intensity** = Focus level (confidence)
  - Bright = high confidence (>0.7)
  - Medium = moderate (0.4-0.7)
  - Faded = low confidence (<0.4)
- **Bubble border thickness** = Recent activity
  - Thick = activity in last 24h
  - Medium = activity in last week
  - Thin = older than 1 week
- **Distance between bubbles** = Semantic similarity
  - Close = related topics
  - Far = distinct topics

**Interactions:**
- Hover bubble → Tooltip shows:
  - Topic name
  - Item count
  - Focus level ("Very focused" / "Still exploring")
  - Last active timestamp
- Click bubble → Filters library view to that topic
- Zoom/pan enabled for large spaces

**Size Guidelines:**
- 300x400px minimum
- Full-width on desktop
- Scrollable on mobile

---

#### E. Coverage Analysis

```
You know a lot about:
✅ Yunus Models (12 items, very focused)
✅ How Microfinance Works (8 items, solid understanding)

You're just starting to explore:
⚠️ Measuring Impact (4 items, still figuring this out)
⚠️ Rules & Regulations (3 items, needs more depth)

Possible gap we detected:
🚨 Critical Perspectives (only 2 items here)
   These recent reads don't connect to your other topics.
   Might be worth creating a separate area for this.
   
   Here are 3 resources that could help:
   → [Suggested item 1]
   → [Suggested item 2]
   → [Suggested item 3]
```

**Logic:**
- **"You know a lot about"** = Topics with >8 items AND confidence >0.7
- **"Just starting to explore"** = Topics with 3-7 items OR confidence 0.4-0.7
- **"Possible gap"** = Topics with <3 items AND low margin (<0.3)

**Suggestions:**
- Pull from semantic search of external corpus (future feature)
- Or pull from user's unassigned items
- Or show "No suggestions yet" if neither available

---

#### F. Topic Areas (Expandable List)

**Collapsed State:**
```
▸ Yunus Models (12 items, very focused)
▸ Microfinance Mechanics (8 items, solid understanding)
▸ Impact Measurement (4 items, still figuring this out)
▸ Critical Perspectives (2 items, just started)

+ Create new topic area
```

**Expanded State:**
```
▾ Yunus Models (12 items, very focused)
  Last active: 3 hours ago
  
  Recent items:
  • What is Social Business - Yunus Centre
  • Seven Principles Explained - Dana Asia
  • ... (show 3 most recent)
  
  [View all items in this topic →]
```

**Each topic shows:**
- Topic name (auto-generated or user-edited)
- Item count
- Focus description
- Last activity timestamp
- Preview of 3 most recent items when expanded

**Actions:**
- Click topic name → Filter library to this topic
- Click "View all items" → Navigate to Library tab with filter applied
- Hover → Shows quick stats
- Right-click / long-press → Rename topic, Merge topics, Delete topic

---

### Tab: Map

**Full-Screen Knowledge Topology Visualization**

#### A. Interactive Graph (Primary)

**Enhanced version of Overview map with:**
- Larger canvas (fills viewport)
- 2D projection of embedding space (t-SNE or UMAP)
- Animated transitions when data updates
- More detailed tooltips

**Additional Features:**
- **Time slider** at bottom
  - Playback how topics evolved over time
  - Shows centroid movement as animation
  - "Play" button to auto-advance
  - Speed controls (1x, 2x, 5x)

**Filters (sidebar):**
- Show/hide topics by confidence threshold
- Show/hide items below certain engagement level
- Date range filter (e.g., "Last 30 days only")

---

#### B. Timeline: How Your Understanding Changed

**Below the map or in separate tab:**

```
Significant Shifts Detected:

Feb 5, 2026
├─ "Social Business" topic shifted significantly
├─ Triggered by: "Social Business Failures" (Medium)
└─ Change: Focus expanded to include criticism

Feb 1, 2026
├─ "Regulatory Frameworks" emerged as new topic
├─ Triggered by: "Policy Analysis" (ArXiv)
└─ Change: New area of interest detected

Jan 28, 2026
├─ "Yunus Models" became more focused
├─ Triggered by: Multiple deep reads
└─ Change: Understanding solidified
```

**Implementation:**
- Pull from drift events table where drift > 0.25
- Show triggering artifact
- Describe change in natural language

---

### Tab: Library

**Searchable, Filterable Table of All Items**

#### A. Controls Bar (Top)

```
[Search box: "Find in this space..."]  [Sort: Recent ▾]  [Filter ≡]
```

**Search:**
- Real-time semantic search within space
- Searches title, URL, and content (if indexed)

**Sort Options:**
- Recent (default)
- Oldest
- Most relevant (if search active)
- Reading time (longest first)
- Best fit (highest margin first)
- Doesn't fit well (lowest margin first)

**Filter Panel (slide-in from right):**
```
Filter by:

Topic
☐ Yunus Models (12)
☐ Microfinance (8)
☐ Impact Measurement (4)
☑ All topics

Reading Depth
☐ Skimmed
☐ Read
☐ Studied
☐ Deep dive
☑ All levels

Fit
☐ Clear match
☐ Somewhat related
☐ Doesn't fit well
☑ All items

Date Range
○ Last 7 days
○ Last 30 days
○ Last 90 days
● All time
○ Custom range

[Apply] [Clear filters]
```

---

#### B. Items Table

**Columns:**

| Title | Topic | Fit | Reading Depth | Time Spent | Saved |
|-------|-------|-----|---------------|------------|-------|
| Yunus Centre - What is... | Yunus Models | ●●● Clear | Deep dive | 12 min | 2 hours ago |
| Social Business Failures | Critical | ●○○ Weak | Read | 6 min | 1 day ago |

**Column Details:**

1. **Title**
   - Truncated at 50 chars
   - Clickable → Opens source URL
   - Icon indicates type (📄 article, 🎥 video, 💻 code, 📊 PDF)

2. **Topic**
   - Shows assigned topic name
   - Badge color matches topic in map
   - Empty if unassigned or margin too low

3. **Fit** (Assignment Margin visualization)
   - Visual: ●●● (3 dots = clear), ●●○ (moderate), ●○○ (weak)
   - Color: Green >0.5, Yellow 0.3-0.5, Red <0.3
   - Tooltip: "This fits clearly in [Topic]" / "This doesn't fit well anywhere"

4. **Reading Depth** (Engagement Level)
   - "Skimmed" (Latent: <30 sec, <10% scroll)
   - "Read" (Discovered: 30sec-3min, 10-50% scroll)
   - "Studied" (Engaged: 3-10min, 50-90% scroll)
   - "Deep dive" (Saturated: >10min, >90% scroll)

5. **Time Spent**
   - Actual dwell time in minutes
   - Calculated from 200 WPM model + scroll behavior

6. **Saved**
   - Relative timestamp ("2 hours ago")
   - Tooltip shows absolute datetime

**Row Actions:**
- Click row → Opens source URL in new tab
- Hover → Shows preview card (if available)
- Right-click / long-press → Context menu:
  - Open source
  - Move to different space
  - Assign to topic
  - Delete from space

---

#### C. Bulk Actions (when items selected)

```
✓ 3 items selected

[Move to space ▾] [Assign topic ▾] [Delete]
```

---

### Tab: Insights

**Analytics and Pattern Detection**

#### A. Reading Patterns

**1. Focus Over Time**

```
How your focus changed over the last 30 days:

[Line chart: Confidence score over time]

Notable moments:
• Feb 5: Focus shifted after "Social Business Failures"
• Feb 1: New topic area emerged
• Jan 28: Understanding solidified
```

**Chart Details:**
- X-axis: Date (daily granularity for 30 days, weekly for 90+ days)
- Y-axis: Confidence score (0.0 to 1.0)
- Line color: Matches space color
- Annotations: Significant drift events marked with dots
- Hover: Shows exact confidence + item that triggered update

---

**2. Reading Pace**

```
Your reading pace over the last 30 days:

[Line chart: Items per week]

Current pace: 2-3 items per week
Average: 3.5 items per week
Trend: ↓ Slowing down slightly

Peak week: Jan 15-21 (7 items)
Slowest week: Feb 5-11 (1 item)
```

---

**3. How Clear Is Your Focus?**

```
Clarity of focus over time:

[Area chart: Percentage of items by fit level]

Right now:
• 65% Clear matches (fits existing topics well)
• 25% Somewhat related (moderate fit)
• 10% Doesn't fit well (possible new topics)

Trend: You're discovering new territory
```

**Chart:** Stacked area showing proportion of high/medium/low margin items over time

---

#### B. What Doesn't Fit

**Margin Distribution Histogram**

```
How well your saved items connect:

[Histogram: Number of items by margin score]

            │
  10 items  │ █
            │ █
   5 items  │ █ █
            │ █ █ █
   0 items  │ █ █ █ █
            └─────────
             Clear  →  Weak
             match     match

⚠️ 6 items have weak connections (margin <0.3)
These might represent blind spots or emerging interests.

[View these items →]
```

---

#### C. What You're Actually Reading

**Engagement Distribution**

```
How deeply are you engaging?

[Pie or donut chart]

Skimmed:    8 items (17%)  → Saved for later
Read:       23 items (49%) → Standard reading
Studied:    12 items (26%) → Deep focus
Deep dive:  4 items (8%)   → Comprehensive study

💡 Insight: You're doing more deep reading than most 
users. This typically leads to better retention.
```

---

#### D. Where You're Reading From

**Source Diversity**

```
Your top sources:

1. arxiv.org        12 items (26%)
2. medium.com       8 items (17%)
3. github.com       6 items (13%)
4. nature.com       5 items (11%)
5. Other           16 items (33%)

⚠️ 80% of your reads come from academic sources.
Consider exploring practitioner perspectives (blogs, 
case studies) for balance.
```

**Visualization:** Horizontal bar chart

---

#### E. Most Important Reads

**Top Influential Items**

```
These items had the biggest impact on your understanding:

1. "Social Business Failures: A Meta-Analysis"
   • Medium.com • Read Feb 5
   • Triggered major shift in "Social Business" topic
   • Reading time: 15 minutes
   
2. "Yunus Centre - Seven Principles Explained"
   • yunuscentre.org • Deep dive Jan 28
   • Solidified "Yunus Models" understanding
   • Reading time: 18 minutes
   
3. "Regulatory Frameworks for Impact Investment"
   • ArXiv • Studied Feb 1
   • Created new topic area
   • Reading time: 22 minutes

[View all ranked by impact →]
```

**Ranking Logic:**
- Effective weight (WESA score) × engagement level
- Items that triggered drift events get boosted
- Deep dives weighted higher than skims

---

## 3. Global Analytics
**Route:** `/dashboard/analytics`  
**Purpose:** Cross-space patterns and overall system health

### A. System Overview

```
┌─ All Your Spaces ─────────────────────────┐
│                                           │
│ Total items saved:     47                 │
│ Active spaces:         3                  │
│ Overall focus:         Good ●●●●●○○○      │
│ System health:         ✅ Stable          │
│                                           │
└───────────────────────────────────────────┘
```

---

### B. Where You're Spending Time

**Time Allocation by Space**

```
Your attention over the last 30 days:

[Pie chart showing reading time by space]

Social Entrepreneurship:  45% (12 hours)
Quantum Computing:        35% (9 hours)
Coffee Science:           20% (5 hours)

💡 You said Coffee was a priority, but you're spending 
most time on Social Entrepreneurship. Is that intentional?
```

---

### C. Attention Balance

**Cross-Space Connection Analysis**

```
Items that don't fit clearly anywhere:

You have 8 items across all spaces with weak 
connections (margin <0.3).

These might be:
• Cross-cutting themes connecting multiple spaces
• Emerging new interests worth exploring
• Noise that can be archived

[Review these items →]
```

**Table:** Shows the 8 items with their attempted space assignment and margin scores

---

### D. Consistency

**Activity Heatmap**

```
Your research activity over the last 90 days:

Mon  □ □ ■ ■ □ ■ ■ □ ■ ■ □ ■ □
Tue  ■ ■ ■ □ ■ ■ ■ ■ □ ■ ■ ■ ■
Wed  ■ ■ ■ ■ ■ □ ■ ■ ■ ■ □ ■ ■
Thu  ■ □ □ ■ □ □ □ ■ □ □ ■ □ □
Fri  □ □ □ □ □ □ □ □ □ □ □ □ □
Sat  □ □ □ □ □ □ □ □ □ □ □ □ □
Sun  □ ■ □ □ ■ □ □ ■ □ □ ■ □ □
     Jan         Feb         Mar

■ 3+ items    □ 1-2 items    □ 0 items

💡 Pattern detected:
Your most productive days are Mon-Wed.
You tend to drop off Thu-Fri and weekends.
```

**Visual:** GitHub-style contribution grid

---

### E. Reading Pace by Space

**Comparative Velocity**

```
[Horizontal bar chart]

Quantum Computing    ████████ 4.2 items/week
Social Ent.          █████ 2.3 items/week
Coffee Science       ██ 0.8 items/week

Your fastest-growing space is Quantum Computing.
Coffee Science hasn't been active in 2 weeks.
```

---

## 4. Search
**Route:** `/dashboard/search`  
**Purpose:** Find anything across all spaces

### A. Search Interface

```
┌───────────────────────────────────────────┐
│ 🔍 What are you looking for?              │
│                                           │
└───────────────────────────────────────────┘

Search across 47 items in 3 spaces
```

**Search Features:**
- Semantic search (not just keyword matching)
- Real-time results as you type (debounced 300ms)
- Searches: titles, URLs, content (if indexed)
- Typo-tolerant

---

### B. Results View

```
Found 12 matches for "microfinance regulation"

Sorted by relevance • Showing 1-12 of 12

───────────────────────────────────────────────

Regulatory Frameworks for Impact Investment
From: Quantum Computing
Relevance: ●●●●● 0.89
"...examines the regulatory landscape for social 
impact investments across emerging markets..."

Saved: Feb 1, 2026 • Deep dive (22 min read)

[Open source →]

───────────────────────────────────────────────

Microfinance Regulation in Bangladesh
From: Social Entrepreneurship  
Relevance: ●●●●○ 0.76
"...Bangladesh Bank's guidelines for MFIs operating 
in rural areas with focus on consumer protection..."

Saved: Jan 28, 2026 • Studied (8 min read)

[Open source →]

───────────────────────────────────────────────

... (more results)
```

**Each Result Shows:**
- Title (clickable to source)
- Source space (with space color badge)
- Relevance score (visual + numeric)
- Preview snippet (150 chars, highlights query terms)
- Metadata: Save date, engagement level, reading time
- Action: "Open source" button

---

### C. Filters (Sidebar)

```
Filter results:

Search in:
☑ All spaces
☐ Social Entrepreneurship
☐ Quantum Computing
☐ Coffee Science

Reading depth:
☑ All levels
☐ Deep dives only
☐ Studied or deeper

Saved:
● Anytime
○ Last 7 days
○ Last 30 days
○ Custom range

Relevance threshold:
[Slider: 0.5 ──●──── 1.0]
(Currently: 0.6 - Good matches)

[Apply filters]
```

---

### D. No Results State

```
No matches found for "quantum entanglement regulation"

Try:
• Using different keywords
• Lowering the relevance threshold
• Searching in specific spaces only

Or browse your spaces:
→ Social Entrepreneurship (27 items)
→ Quantum Computing (15 items)
→ Coffee Science (5 items)
```

---

### E. Search Meta Info (Bottom)

```
💡 How search works:
We use semantic embeddings to understand meaning, 
not just keywords. "Microfinance regulation" will 
match "MFI policy frameworks" even without exact words.

Technical: 768-dimensional Nomic embeddings with 
cosine similarity ranking.

[Learn more about our search →]
```

---

## 5. Settings / Preferences
**Route:** `/dashboard/settings`  
**Purpose:** User preferences, advanced configuration, data export

### A. Appearance

```
Theme
○ Light mode
● Dark mode
○ Auto (match system)

Density
○ Comfortable (more spacing)
● Compact (fits more on screen)
○ Cozy (balanced)
```

---

### B. Notifications

```
Email me when:
☑ Blind spots detected (low margin items)
☑ Major focus shifts (high drift)
☐ Weekly summary
☐ Monthly report

Frequency:
● Real-time (as they happen)
○ Daily digest
○ Weekly digest
```

---

### C. Privacy & Data

```
Data retention:
● Keep all items indefinitely
○ Auto-archive items after 1 year
○ Auto-delete items after 2 years

Export your data:
[Download all data (JSON)] [Download CSV]

Delete your account:
[Request account deletion] ⚠️
```

---

### D. Advanced (Collapsible)

```
▾ How Misir Works

We use semantic embeddings to understand what your 
items mean, not just what keywords they contain.

Reading depth is calculated based on time spent and 
scroll behavior, using a 200 words/minute baseline.

Your "focus score" updates continuously as you read, 
using an exponential moving average.

🔗 Read the full technical documentation
   (Links to algorithms.md on GitHub or docs site)

───────────────────────────────────────────────

▸ Model Configuration (For power users)

  Embedding model: Nomic AI v1.5 (768-dim)
  Focus update rate: 0.15 (how fast focus changes)
  Drift sensitivity: 0.25 (threshold for alerts)
  Margin threshold: 0.30 (weak fit cutoff)
  
  [Reset to defaults]
  
───────────────────────────────────────────────

▸ Diagnostics

  Total embeddings generated: 1,247
  Database size: 2.3 MB
  Last sync: 2 minutes ago
  Extension version: 1.2.0
  
  [Run system check] [View logs]
```

---

### E. Help & Support

```
Documentation
→ Getting started guide
→ Understanding your metrics
→ FAQ
→ Keyboard shortcuts

Support
→ Contact support
→ Report a bug
→ Request a feature

About Misir
Version 1.2.0 (Feb 2026)
Made by Jamil & Tomal
```

---

## Language & Terminology Guidelines

### Terminology Translation Table

| Backend/Technical Term | User-Facing Language | Context |
|------------------------|----------------------|---------|
| Artifact | Item, resource, source | Main UI |
| Artifact | Artifact | API, docs, settings |
| Confidence score | Focus | All UI |
| Drift magnitude | Focus shifted / is shifting | Alerts, insights |
| High velocity | Fast reading pace | Analytics |
| Low velocity | Slow reading pace | Analytics |
| Assignment margin | How well it fits | Library, insights |
| Low margin (<0.3) | Doesn't fit clearly | Everywhere |
| Centroid update | Understanding updated | Advanced only |
| WESA effective weight | Impact on understanding | Advanced only |
| Subspace | Topic, topic area | All UI |
| Latent | Skimmed, saved for later | Engagement levels |
| Discovered | Read | Engagement levels |
| Engaged | Studied | Engagement levels |
| Saturated | Deep dive | Engagement levels |
| Semantic distance | How related | Advanced |
| Batch coherence | Focus clarity | Backend only |
| OSCL | (Don't mention) | Backend only |
| Embedding vector | (Don't mention) | Backend only |

---

### Writing Guidelines

#### ✅ DO:
- Use active voice: "You've saved 12 items" not "12 items have been saved"
- Be conversational: "Your focus shifted" not "Drift detected"
- Provide context: "This usually means..." after any alert
- Suggest actions: "What you can do:" followed by checkboxes
- Use natural time: "2 hours ago" not "14:32:15"
- Explain metrics inline: "Focus (how clear your goals are)"

#### ❌ DON'T:
- Use jargon without explanation
- Show raw numbers without context (0.847 confidence → "Strong focus")
- Use passive voice or robotic language
- Present metrics without suggesting what to do
- Assume user knows what something means
- Over-explain if user didn't ask

---

### Tone Guidelines

**Primary Tone:** Helpful colleague, not robotic assistant

**Examples:**

✅ Good: "You've slowed down this week. Busy, or losing momentum?"  
❌ Bad: "Velocity degraded to 50% of baseline."

✅ Good: "Your last few reads don't fit anywhere. Discovering something new?"  
❌ Bad: "Low assignment margin detected across recent artifacts."

✅ Good: "This is getting messy. Maybe split into separate topics?"  
❌ Bad: "Confidence score indicates cluster instability."

**Personality:**
- Curious, not judgmental
- Insightful, not prescriptive  
- Encouraging, not nagging
- Honest about uncertainty ("This might mean...")

---

### Alert Writing Formula

```
[Icon] [Observation in plain language]

[What this usually means - context]

[Suggested actions as checklist or buttons]

[Optional: Link to learn more]
```

**Example:**

```
💡 We noticed something interesting:

Your last 5 items don't fit neatly into your 
existing topics. This usually means you're 
discovering something new.

What you can do:
□ Create a new topic area
□ Review these items together
□ Keep exploring - we'll keep tracking

[View items →]
```

---

## Implementation Priority

### Phase 1: Beta Launch (Week 1-2)
**Goal:** Minimum viable insights for first 50 users

**Must-Have:**
1. Home (Command Center)
   - Space cards with status
   - Activity chart (30 days)
   - Recently saved list

2. Space Detail → Overview Tab
   - Space header
   - "How You're Doing" panel
   - Low margin alert (if triggered)
   - Knowledge map (simple version)
   - Coverage analysis
   - Topic list

3. Space Detail → Library Tab
   - Items table with all columns
   - Basic search
   - Sort by recent/margin
   - Filter by topic

4. Search
   - Basic semantic search
   - Results with relevance scores

**Can Wait:**
- Map tab (animated topology)
- Insights tab (analytics charts)
- Global analytics page
- Advanced settings

---

### Phase 2: First 100 Users (Week 3-4)
**Goal:** Add depth for power users

**Add:**
1. Space Detail → Insights Tab
   - Focus over time chart
   - Reading pace chart
   - Margin distribution
   - Engagement distribution

2. Space Detail → Map Tab
   - Interactive topology
   - Time slider (basic)

3. Global Analytics
   - Time allocation
   - Consistency heatmap
   - Cross-space items

4. Settings
   - Theme switcher
   - Export data

---

### Phase 3: Based on Usage Data (Week 5-8)
**Goal:** Refine based on what users actually use

**Iterate on:**
- Alert wording (A/B test different phrasings)
- Chart types (line vs area vs bar)
- Default sorts/filters
- Tooltip content
- Onboarding flow

**Add if requested:**
- More granular filters
- Custom date ranges
- Bulk actions
- Keyboard shortcuts
- Mobile-optimized views

---

## Technical Notes

### Backend Integration Points

#### Data Sources (from backend)

1. **For Space Cards:**
   - `GET /api/spaces` → List all spaces with metadata
   - Fields needed: `id`, `name`, `goal`, `created_at`, `last_activity_at`
   - Computed: `confidence_score`, `drift_magnitude`, `velocity`, `artifact_count`

2. **For Knowledge Map:**
   - `GET /api/spaces/{id}/topology` → Subspace centroids + positions
   - Fields: `subspace_id`, `name`, `artifact_count`, `confidence`, `centroid_vector`
   - Client-side: Reduce dimensions (t-SNE/UMAP) for 2D projection

3. **For Items Table:**
   - `GET /api/spaces/{id}/artifacts` → All items in space
   - Fields: `id`, `title`, `url`, `subspace_id`, `margin`, `engagement_level`, `dwell_time_ms`, `created_at`
   - Pagination: 50 items per page

4. **For Alerts:**
   - `GET /api/spaces/{id}/alerts` → Active alerts for space
   - Types: `low_margin`, `high_drift`, `velocity_drop`, `confidence_drop`
   - Each includes: `type`, `severity`, `message`, `affected_artifacts[]`, `suggested_actions[]`

5. **For Analytics:**
   - `GET /api/spaces/{id}/analytics/drift` → Drift events over time
   - `GET /api/spaces/{id}/analytics/velocity` → Velocity time series
   - `GET /api/spaces/{id}/analytics/confidence` → Confidence time series
   - `GET /api/spaces/{id}/analytics/margin_distribution` → Histogram data

6. **For Search:**
   - `POST /api/search` → Semantic search across spaces
   - Body: `{query: string, space_ids?: string[], min_relevance?: number}`
   - Returns: `{results: [{artifact_id, title, url, space_id, relevance, snippet}]}`

---

### Frontend State Management

**Recommended Architecture:**

```
/dashboard
  ├── components/
  │   ├── SpaceCard.tsx
  │   ├── KnowledgeMap.tsx
  │   ├── AlertBanner.tsx
  │   ├── ItemsTable.tsx
  │   └── charts/
  │       ├── DriftChart.tsx
  │       ├── VelocityChart.tsx
  │       └── Heatmap.tsx
  │
  ├── hooks/
  │   ├── useSpaces.ts
  │   ├── useSpaceDetail.ts
  │   ├── useAnalytics.ts
  │   └── useSearch.ts
  │
  ├── utils/
  │   ├── formatters.ts (confidence → "Strong focus")
  │   ├── alerts.ts (generate alert messages)
  │   └── colors.ts (space color palette)
  │
  └── pages/
      ├── index.tsx (Home)
      ├── spaces/[id].tsx (Space Detail)
      ├── analytics.tsx
      ├── search.tsx
      └── settings.tsx
```

---

### Responsive Breakpoints

```css
Mobile:   < 640px   (1 column, stacked)
Tablet:   640-1024px (2 columns, condensed)
Desktop:  > 1024px  (3 columns, full features)
```

**Adaptations:**
- **Mobile:** Hide map tab, show simplified cards, reduce chart complexity
- **Tablet:** 2-column grid for space cards, abbreviated table columns
- **Desktop:** Full feature set, side-by-side layouts

---

### Performance Targets

- **Initial page load:** < 1.5s (home)
- **Space detail load:** < 2s (includes map rendering)
- **Search results:** < 500ms (semantic search)
- **Chart rendering:** < 300ms (D3/Recharts)
- **Real-time updates:** WebSocket latency < 200ms

---

### Accessibility Requirements

- **WCAG 2.1 Level AA compliance**
- Keyboard navigation for all interactions
- Screen reader labels on all charts/maps
- Focus indicators on interactive elements
- Color contrast ratio ≥ 4.5:1 for text
- Alt text for visual-only information
- Skip links for main content
- Semantic HTML (`<main>`, `<nav>`, `<article>`)

---

### Localization Considerations

**Phase 1:** English only

**Future:** Support for:
- Bengali (Bangladeshi market)
- Spanish (Latin America)
- French (Africa/Europe)

**Prepare for i18n:**
- Extract all strings to `en.json`
- Use relative time formatting (i18n-friendly)
- Don't hardcode date formats
- Support RTL layouts (future Arabic/Hebrew)

---

## Appendix: Example Alert Messages

### Low Margin Alert

```
💡 We noticed something interesting:

Your last 5 items don't fit neatly into your 
existing topics. This usually means you're 
discovering something new.

What you can do:
□ Create a new topic area
□ Review these items together
□ Keep exploring - we'll keep tracking

[View items →]
```

---

### High Drift Alert

```
🔄 Your focus is shifting:

After reading "Social Business Failures," your 
understanding of this space evolved significantly.

This is normal when exploring new perspectives.

[See what changed →]
```

---

### Velocity Drop Alert

```
📉 You've slowed down:

You're saving 1-2 items per week, down from 
your usual 4-5.

Busy week, or losing momentum?
```

---

### Confidence Drop Alert

```
⚠️ This topic is getting messy:

Your recent reads cover very different angles. 
You might want to split this into separate 
topic areas.

[Review topics →]
```

---

### New Space Suggestion

```
💡 New interest detected:

You've saved 5 items about "Coffee Processing" 
but they're scattered across other spaces.

Want to create a dedicated space for this?

[Create space] [Ignore]
```

---

### Topic Saturation

```
✅ You know this topic well:

You've read 15+ items on "Yunus Models" with 
strong focus and deep engagement.

You might be ready to:
□ Synthesize your learnings (export items)
□ Move to a new subtopic
□ Explore related areas

[View all items →]
```

---

## Appendix: Metric Calculation Reference

### Focus Score (Confidence Translation)

```javascript
function getfocusLabel(confidence) {
  if (confidence >= 0.8) return "Very strong";
  if (confidence >= 0.6) return "Strong";
  if (confidence >= 0.4) return "Moderate";
  if (confidence >= 0.2) return "Developing";
  return "Just starting";
}

function getFocusDots(confidence) {
  return Math.round(confidence * 8); // 0-8 dots
}
```

---

### Fit Level (Margin Translation)

```javascript
function getFitLabel(margin) {
  if (margin >= 0.5) return "Clear match";
  if (margin >= 0.3) return "Somewhat related";
  return "Doesn't fit well";
}

function getFitColor(margin) {
  if (margin >= 0.5) return "green";
  if (margin >= 0.3) return "yellow";
  return "red";
}
```

---

### Reading Depth (Engagement Level Translation)

```javascript
function getReadingDepth(engagement_level) {
  const map = {
    'latent': 'Skimmed',
    'discovered': 'Read',
    'engaged': 'Studied',
    'saturated': 'Deep dive'
  };
  return map[engagement_level] || 'Unknown';
}
```

---

### Status Label (Space Health)

```javascript
function getSpaceStatus(space) {
  const { confidence, drift, avg_margin } = space.metrics;
  
  // High drift = focus shifting
  if (drift > 0.3) return "Focus shifting 🔄";
  
  // Low margin = exploring new territory
  if (avg_margin < 0.3) return "Exploring new territory ⚠️";
  
  // High confidence + low drift = stable
  if (confidence > 0.7 && drift < 0.2) return "Looking good ✅";
  
  // Default
  return "Building understanding 📊";
}
```

---

## Appendix: Color Palette

### Space Colors (Auto-assigned)

```css
--space-1: #3B82F6; /* Blue */
--space-2: #10B981; /* Green */
--space-3: #F59E0B; /* Amber */
--space-4: #EF4444; /* Red */
--space-5: #8B5CF6; /* Purple */
--space-6: #EC4899; /* Pink */
--space-7: #06B6D4; /* Cyan */
--space-8: #F97316; /* Orange */
```

Cycle through these when creating new spaces.

---

### Semantic Colors

```css
/* Focus/Confidence Levels */
--focus-high: #10B981;    /* Green */
--focus-medium: #F59E0B;  /* Yellow */
--focus-low: #EF4444;     /* Red */

/* Fit/Margin Levels */
--fit-clear: #10B981;     /* Green */
--fit-moderate: #F59E0B;  /* Yellow */
--fit-weak: #EF4444;      /* Red */

/* Alert Types */
--alert-info: #3B82F6;    /* Blue */
--alert-warning: #F59E0B; /* Amber */
--alert-success: #10B981; /* Green */
--alert-danger: #EF4444;  /* Red */
```

---

## Changelog

**v1.1 (Feb 11, 2026)**
- Revised based on actual backend architecture review
- Updated backend integration section with real implementation details
- Clarified which endpoints already exist vs need to be built
- Adjusted effort estimates based on existing infrastructure

**v1.0 (Feb 10, 2026)**
- Initial specification
- Defined all 5 main pages
- Established language guidelines
- Created implementation roadmap

---

## Addendum: Backend Implementation Status

### What Already Exists (Per Data Pipeline Documentation)

The backend is **significantly more complete** than initially assumed:

**✅ Core Intelligence Layer:**
- Embedding generation (768-dim vectors via `embedding_service.py`)
- Assignment margin calculation (d2 - d1 via `margin_service.py`)
- Centroid updates (EMA-based via RPC triggers)
- Engagement level tracking (ambient/active/flow)
- Reading depth metrics (0.0-1.5 scroll/interact)
- Analytics aggregation (`analytics_handler.py`)

**✅ Database Schema:**
- `misir.space` with layout/settings JSONB
- `misir.subspace` with centroid_embedding, learning_rate, confidence
- `misir.artifact` with margin, word_count, reading_depth, engagement_level
- `misir.signal` for normalized vectors
- Vector operations via pgvector

**✅ Repositories:**
- `artifact_repo.py` - CRUD + queries
- `subspace_repo.py` - centroid operations
- `analytics_handler.py` - aggregations

### What Needs to Be Built

**New Endpoints (Jobs 42-45):**

These are **thin wrappers** around existing logic, not new features:

**Job 42: `GET /spaces/{id}/artifacts`**
- **Status:** Repository method exists (`artifact_repo.get_by_space_id()`)
- **Work needed:** Add FastAPI route with pagination, expose existing data
- **Effort:** 2 hours

**Job 43: `GET /spaces/{id}/alerts`**
- **Status:** Logic exists (margin thresholds, drift detection)
- **Work needed:** New handler that queries existing metrics and formats as alert objects
- **Effort:** 4 hours
- **Implementation:**
```python
def get_space_alerts(space_id: int):
    alerts = []
    
    # Query existing data
    recent_artifacts = artifact_repo.get_recent(space_id, limit=5)
    avg_margin = sum(a.margin for a in recent_artifacts) / len(recent_artifacts)
    
    # Generate alerts using existing thresholds
    if avg_margin < 0.3:
        alerts.append({
            "type": "low_margin",
            "severity": "warning",
            "message": generate_low_margin_alert(recent_artifacts),
            "affected_artifacts": [a.id for a in recent_artifacts]
        })
    
    # Check drift, velocity, confidence (similar pattern)
    # ...
    
    return alerts
```

**Job 44: `GET /spaces/{id}/topology`**
- **Status:** Centroids exist in DB (`subspace.centroid_embedding`)
- **Work needed:** Query centroids, apply t-SNE/UMAP for 2D projection, return coordinates
- **Effort:** 6 hours (including dimensionality reduction)
- **Implementation:**
```python
from sklearn.manifold import TSNE

def get_space_topology(space_id: int):
    subspaces = subspace_repo.get_by_space_id(space_id)
    
    # Extract centroid vectors
    centroids = [s.centroid_embedding for s in subspaces]
    
    # Reduce to 2D
    coords_2d = TSNE(n_components=2).fit_transform(centroids)
    
    return [
        {
            "subspace_id": s.id,
            "name": s.name,
            "artifact_count": s.artifact_count,
            "confidence": s.confidence,
            "x": coords_2d[i][0],
            "y": coords_2d[i][1]
        }
        for i, s in enumerate(subspaces)
    ]
```

**Job 45: Analytics Time-Series**
- **Status:** `analytics_handler.py` already does aggregation
- **Work needed:** Extend to accept date ranges, return time-series instead of point values
- **Effort:** 4 hours
- **Endpoints:**
  - `GET /spaces/{id}/analytics/drift?start_date=X&end_date=Y`
  - `GET /spaces/{id}/analytics/velocity?start_date=X&end_date=Y`
  - `GET /spaces/{id}/analytics/confidence?start_date=X&end_date=Y`
  - `GET /spaces/{id}/analytics/margin_distribution`

**Total Backend Work: ~16 hours (2 days)**

### Frontend Translation Layer (Critical Path)

The **real work** is Jobs 3-5 (formatters, alerts, colors).

These utilities translate backend data into user-friendly UI:

**Example: Margin → "Fit" Label**
```typescript
// backend returns: { margin: 0.18 }
// frontend shows: "Doesn't fit well ●○○"

export function getFitLabel(margin: number): string {
  if (margin >= 0.5) return "Clear match";
  if (margin >= 0.3) return "Somewhat related";
  return "Doesn't fit well";
}
```

**Example: Engagement Level → Reading Depth**
```typescript
// backend returns: { engagement_level: "ambient" }
// frontend shows: "Skimmed"

export function getReadingDepth(
  engagement_level: "ambient" | "active" | "flow"
): string {
  const map = {
    ambient: "Skimmed",
    active: "Read",
    flow: "Deep dive"
  };
  return map[engagement_level];
}
```

**Without this abstraction layer, every component will hardcode translation logic.**

### Revised Implementation Timeline

**Week 1: Foundation + Backend**
- Day 1-2: Jobs 1-5 (critical bugs + utilities) - 16h
- Day 3: Jobs 42-43 (backend endpoints) - 6h
- Day 4: Job 6 (terminology rename) - 4h
- Day 5: Jobs 7-10 (home page) - 8h

**Week 2: Space Detail + Launch**
- Day 8-9: Jobs 12-16 (space overview + map) - 16h
- Day 10-11: Jobs 17-18, 22-23 (coverage + library) - 16h
- Day 12: Jobs 11, 37, 46 (onboarding + search + nav) - 8h
- Day 13-14: Jobs 44-45 (remaining backend) + testing - 16h

**Total: 12-14 days to functional beta**

---

**Document Status:** Ready for implementation (Revised)  
**Next Review:** After Phase 1 beta launch (2 weeks)  
**Maintainer:** Jamil & Tomal  
**Feedback:** feedback@misir.app