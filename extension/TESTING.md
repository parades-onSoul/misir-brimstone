# Misir Sensor — Testing Guide

## Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `g:\Project\misir\extension\dist` folder
5. The extension icon should appear in your toolbar

## Clear Storage (if you already loaded the old version)

Since the previous version set `userId: 'test-user-123'` on install, you need to clear storage to see the login screen:

### Method 1: Use the debug tool
1. Right-click the extension icon → **Inspect popup**
2. In the console, run:
   ```javascript
   chrome.storage.local.clear(() => { console.log('Cleared'); location.reload(); })
   ```

### Method 2: Remove and reload
1. Go to `chrome://extensions/`
2. Click **Remove** on Misir Sensor
3. Click **Load unpacked** again and select `dist` folder

## Sign In Flow

After clearing storage, the popup should show:

1. **Login View** — Email/password form
   - Use your Supabase credentials for `vnnhmqrxrcnmcumcorta.supabase.co`
   - Or click **Continue with Mock Auth** to skip (uses `test-user-123`)

2. **Main View** (after login)
   - Shows your email in the header (if authenticated)
   - Backend health indicator (green dot)
   - NLP status (purple = wink-nlp, yellow = fallback)
   - Sign out button (logout icon)

## Auth Features

### When Authenticated (Supabase)
- Bearer JWT sent with all API requests
- User ID from Supabase used for spaces/captures
- Session stored in `chrome.storage.local` as `misir_session`
- Token auto-refreshes every 60s (pulse alarm)

### When Using Mock Auth
- No JWT sent (backend MOCK_AUTH=True handles this)
- Uses `userId` from config (defaults to `test-user-123`)
- Sign out clears session but keeps userId

## Settings Page

Right-click extension icon → **Options** to open full settings page:

- **Authentication section** — Shows signed-in user or "Not authenticated"
- **Diagnostics** — Backend health, NLP engine, embeddings (Nomic 1.5)
- **Configuration** — User ID, API URL, thresholds
- **Debug Tools** — Clear recent captures

## Testing Backend Integration

Make sure backend is running with the correct config:

```bash
cd g:\Project\misir\backend
# Check .env has:
# SUPABASE_URL=https://vnnhmqrxrcnmcumcorta.supabase.co
# SUPABASE_KEY=<anon_key>
# MOCK_AUTH=False  # if you want JWT validation

uvicorn main:app --reload
```

Extension calls:
- `GET /health` — Health check
- `GET /api/v1/spaces?user_id=...` — List spaces (with Bearer if authenticated)
- `POST /api/v1/artifacts/capture` — Capture artifact (with Bearer if authenticated)

Backend `get_current_user()` in `capture.py`:
- If `MOCK_AUTH=True` → returns `"test-user-123"` (ignores JWT)
- If `MOCK_AUTH=False` → validates JWT via `client.auth.get_user(token)` → returns `user.user.id`

## Troubleshooting

**"Cannot read this page"** in popup:
- Extension can't scrape `chrome://` or `chrome-extension://` URLs
- Navigate to a real website (e.g., https://example.com)

**Backend offline**:
- Red dot in header
- Check backend is running on `http://localhost:8000`

**NLP fallback mode** (yellow dot):
- wink-nlp model failed to load
- Extension falls back to regex-based keyword extraction
- Still works, just less accurate

**Login fails**:
- Check Supabase credentials
- Make sure user exists in `vnnhmqrxrcnmcumcorta.supabase.co`
- Check browser console for errors

**Storage Debug**:
- Open the included `debug-storage.html` in Chrome (load as extension page)
- Shows all chrome.storage.local contents
- Buttons to clear auth or all storage

**"Failed to fetch" in background script**:
- This can happen if you have an expired Supabase session in storage
- The extension now handles this gracefully and clears the bad session
- If you see this repeatedly, clear storage using Method 1 or 2 above
- The pulse alarm now waits 5 minutes after startup before attempting token refresh
