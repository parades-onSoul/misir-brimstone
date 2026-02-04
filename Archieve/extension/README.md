# Misir Sensor Extension

A lightweight Chrome extension that acts as a **Sensor** for capturing web browsing signals.

## Philosophy: Sensor, Not Product

This extension is intentionally minimal. It:

- **Captures** web content and engagement metrics
- **Sends** raw signals to the backend
- **Delegates** all intelligence to the server

No AI, no complex matching, no heavy dependencies. Just clean data collection.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   POPUP     │     │  CONTENT    │     │ BACKGROUND  │
│   (React)   │◄───►│  SCRIPT     │◄───►│  (Service   │
│   Simple UI │     │  Extractor  │     │   Worker)   │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │   BACKEND   │
                                        │   (API)     │
                                        └─────────────┘
```

## What Gets Captured

For each qualifying page:

| Field | Description |
|-------|-------------|
| `url` | Page URL |
| `title` | Page title |
| `content` | Extracted text (via Readability.js) |
| `word_count` | Word count |
| `dwell_time_ms` | Time spent on page |
| `scroll_depth` | How far user scrolled (0-1) |
| `reading_depth` | Engagement multiplier (0-1.5) |
| `capture_method` | `auto`, `manual`, or `committed` |
| `content_source` | `web`, `video`, `ai`, `document` |

## Quality Filters

Signals are only sent when:

- Page has ≥100 words
- User spent ≥5 seconds on page
- URL not in blocklist (email, social, auth pages, etc.)

## File Structure

```
extension/
├── manifest.json          # Chrome extension manifest v3
├── package.json           # Minimal dependencies
├── vite.config.ts         # Build config
│
├── src/
│   ├── types.ts           # TypeScript types (Signal, Settings)
│   │
│   ├── capture/           # Data collection
│   │   ├── tab_listener.ts    # Tab events (update, remove, activate)
│   │   ├── dwell_timer.ts     # Time-on-page tracking
│   │   ├── content_guard.ts   # URL blocklist/allowlist
│   │   └── index.ts           # Module exports
│   │
│   ├── classify/          # Content classification
│   │   ├── artifact_type.ts   # ambient/engaged/committed detection
│   │   ├── content_extract.ts # Readability.js wrapper
│   │   └── index.ts           # Module exports
│   │
│   ├── store/             # Local persistence
│   │   ├── local_db.ts        # IndexedDB for signals
│   │   ├── queue.ts           # Batch sync queue
│   │   ├── settings.ts        # chrome.storage.sync
│   │   └── index.ts           # Module exports
│   │
│   ├── sync/              # Backend communication
│   │   ├── backend.ts         # API client with retry
│   │   └── index.ts           # Module exports
│   │
│   ├── ui/                # User interface
│   │   ├── main.tsx           # React entry point
│   │   ├── popup.tsx          # Popup stats & controls
│   │   ├── explain.tsx        # "Why saved?" detail view
│   │   └── index.ts           # Module exports
│   │
│   ├── background/
│   │   └── index.ts       # Service worker orchestrator
│   │
│   └── content/
│       └── index.ts       # Content script entry
│
└── icons/                 # Extension icons
```

## Development

```bash
# Install dependencies
npm install

# Build for development
npm run dev

# Build for production
npm run build
```

## Loading in Chrome

1. Run `npm run build`
2. Go to `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist` folder

## Configuration

Settings are stored in `chrome.storage.sync`:

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | `true` | Auto-capture on/off |
| `minWordCount` | `100` | Minimum words to capture |
| `minDwellTimeMs` | `5000` | Minimum time on page |
| `apiUrl` | `http://localhost:8000/api/v1` | Backend URL |

## API Contract

The sensor sends POST requests to `{apiUrl}/signals`:

```json
{
  "url": "https://example.com/article",
  "title": "Example Article",
  "content": "Full extracted text...",
  "word_count": 1500,
  "dwell_time_ms": 45000,
  "scroll_depth": 0.85,
  "reading_depth": 1.0,
  "capture_method": "auto",
  "content_source": "web",
  "captured_at": "2026-01-25T10:30:00Z",
  "domain": "example.com"
}
```

## What's NOT Included

Intentionally omitted from the sensor:

- ❌ AI/ML models
- ❌ Embedding generation
- ❌ Semantic matching
- ❌ Supabase authentication
- ❌ Complex UI
- ❌ Offline queue (can be added)

All intelligence lives on the backend.
