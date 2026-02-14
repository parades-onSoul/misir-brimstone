/**
 * Popup App — Main UI
 *
 * Four views:
 *   1. Login   (Supabase auth — email/password)
 *   2. Main    (page info, space selector, capture, recent, classifier status)
 *   3. Settings (change config, diagnostics)
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Compass,
  Zap,
  Settings as SettingsIcon,
  ArrowLeft,
  Plus,
  Check,
  Loader2,
  ExternalLink,
  Brain,
  Wifi,
  WifiOff,
  RefreshCw,
  ChevronRight,
  LogIn,
  LogOut,
  Mail,
  Lock,
} from 'lucide-react';
import type {
  SensorConfig,
  Space,
  Subspace,
  Marker,
  ScrapedPage,
  ReadingMetrics,
  EngagementLevel,
  ClassificationResult,
  RecentCapture,
  AuthState,
} from '@/types';

// ── Helpers ──────────────────────────────────────────

function sendMessage(msg: Record<string, unknown>): Promise<any> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (resp: any) => {
      resolve(resp || { success: false, error: 'No response' });
    });
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const ENGAGEMENT_COLORS: Record<EngagementLevel, string> = {
  latent: 'badge-latent',
  discovered: 'badge-discovered',
  engaged: 'badge-engaged',
  saturated: 'badge-saturated',
};

function getEngagementBadgeClass(level: string): string {
  if (level in ENGAGEMENT_COLORS) {
    return ENGAGEMENT_COLORS[level as EngagementLevel];
  }
  if (level === 'ambient') return 'badge-latent';
  if (level === 'committed') return 'badge-saturated';
  return 'badge-latent';
}

function getScoreColor(score: number): string {
  // score is 0-100
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-yellow-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

// ── Login View (Supabase Auth) ───────────────────────

function LoginView({
  onLogin,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError('');
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="text-center space-y-2 pt-4">
        <Compass className="w-10 h-10 text-misir-accent mx-auto" />
        <h1 className="text-lg font-semibold">Misir Sensor</h1>
        <p className="text-sm text-misir-muted">Sign in to your account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-misir-muted" />
          <input
            type="email"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-misir-surface border border-misir-border text-sm text-misir-text focus:border-misir-accent focus:outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            autoFocus
          />
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-misir-muted" />
          <input
            type="password"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-misir-surface border border-misir-border text-sm text-misir-text focus:border-misir-accent focus:outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
        </div>

        {error && (
          <p className="text-xs text-misir-danger bg-misir-danger/10 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !email || !password}
          className="w-full py-2.5 rounded-lg bg-misir-accent text-white text-sm font-medium hover:bg-blue-600 transition disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LogIn className="w-4 h-4" />
          )}
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

    </div>
  );
}

// ── Settings View ────────────────────────────────────

function SettingsView({
  config,
  onSave,
  onBack,
  nlpStatus,
}: {
  config: SensorConfig;
  onSave: (c: Partial<SensorConfig>) => void;
  onBack: () => void;
  nlpStatus: boolean;
}) {
  const [apiUrl, setApiUrl] = useState(config.apiUrl);
  const [minWords, setMinWords] = useState(config.minWordCount);
  const [minDwell, setMinDwell] = useState(config.minDwellTimeMs);
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(config.autoCaptureEnabled);
  const [autoCaptureConfidence, setAutoCaptureConfidence] = useState(
    Math.round(config.autoCaptureConfidenceThreshold * 100)
  );
  const [autoCaptureCooldownMin, setAutoCaptureCooldownMin] = useState(
    Math.max(1, Math.round(config.autoCaptureCooldownMs / 60000))
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1 hover:bg-misir-surface rounded">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-sm font-semibold">Settings</h2>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-misir-muted block mb-1">API URL</label>
          <input
            className="w-full px-3 py-2 rounded-lg bg-misir-surface border border-misir-border text-sm"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-misir-muted block mb-1">Min Words</label>
            <input
              type="number"
              className="w-full px-3 py-2 rounded-lg bg-misir-surface border border-misir-border text-sm"
              value={minWords}
              onChange={(e) => setMinWords(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-xs text-misir-muted block mb-1">Min Dwell (ms)</label>
            <input
              type="number"
              className="w-full px-3 py-2 rounded-lg bg-misir-surface border border-misir-border text-sm"
              value={minDwell}
              onChange={(e) => setMinDwell(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-misir-border bg-misir-surface px-3 py-2">
          <span className="text-xs text-misir-muted uppercase tracking-wider">Auto Capture</span>
          <button
            onClick={() => setAutoCaptureEnabled((prev) => !prev)}
            className={`w-10 h-5 rounded-full transition-colors duration-200 ${
              autoCaptureEnabled ? 'bg-misir-accent' : 'bg-misir-border'
            } relative`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                autoCaptureEnabled ? 'left-5' : 'left-0.5'
              }`}
            />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-misir-muted block mb-1">Auto Confidence (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              className="w-full px-3 py-2 rounded-lg bg-misir-surface border border-misir-border text-sm"
              value={autoCaptureConfidence}
              onChange={(e) => setAutoCaptureConfidence(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-xs text-misir-muted block mb-1">Auto Cooldown (min)</label>
            <input
              type="number"
              min={1}
              className="w-full px-3 py-2 rounded-lg bg-misir-surface border border-misir-border text-sm"
              value={autoCaptureCooldownMin}
              onChange={(e) => setAutoCaptureCooldownMin(Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* Diagnostics */}
      <div className="rounded-lg bg-misir-surface border border-misir-border p-3 space-y-2">
        <h3 className="text-xs font-medium text-misir-muted uppercase tracking-wider">Diagnostics</h3>
        <div className="flex items-center justify-between text-sm">
          <span className="text-misir-muted flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5" /> Classifier
          </span>
          <span className={nlpStatus ? 'text-misir-success' : 'text-misir-warning'}>
            {nlpStatus ? 'Backend ✓' : 'Unavailable'}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-misir-muted">Embedding</span>
          <span className="text-misir-muted">Nomic 1.5 (backend)</span>
        </div>
      </div>

      <button
        onClick={() =>
          onSave({
            apiUrl,
            minWordCount: minWords,
            minDwellTimeMs: minDwell,
            autoCaptureEnabled,
            autoCaptureConfidenceThreshold: Math.min(1, Math.max(0, autoCaptureConfidence / 100)),
            autoCaptureCooldownMs: Math.max(60000, autoCaptureCooldownMin * 60000),
          })
        }
        className="w-full py-2.5 rounded-lg bg-misir-accent text-white text-sm font-medium hover:bg-blue-600 transition"
      >
        Save & Back
      </button>
    </div>
  );
}

// ── Main View ────────────────────────────────────────

function MainView({
  config,
  auth,
  onOpenSettings,
  onSignOut,
}: {
  config: SensorConfig;
  auth: AuthState | null;
  onOpenSettings: () => void;
  onSignOut: () => void;
}) {
  const [backendHealthy, setBackendHealthy] = useState<boolean | null>(null);
  const [nlpReady, setNlpReady] = useState(false);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<number | null>(null);
  const [subspaces, setSubspaces] = useState<Subspace[]>([]);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [showSpaceDetails, setShowSpaceDetails] = useState(false);
  const [pageData, setPageData] = useState<{
    page: ScrapedPage;
    metrics: ReadingMetrics;
    engagement: EngagementLevel;
  } | null>(null);
  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  const [recentCaptures, setRecentCaptures] = useState<RecentCapture[]>([]);
  const [captureState, setCaptureState] = useState<'idle' | 'capturing' | 'success' | 'error'>('idle');
  const [captureError, setCaptureError] = useState('');
  const [lastArtifactId, setLastArtifactId] = useState<number | null>(null);

  // ── Init ──────────────────────────────────────────

  useEffect(() => {
    // Health check
    sendMessage({ type: 'HEALTH_CHECK' }).then((r: any) => {
      setBackendHealthy(r.success && r.data?.healthy);
    });

    // Classifier status
    sendMessage({ type: 'GET_NLP_STATUS' }).then((r: any) => {
      setNlpReady(r.success && r.data?.available);
    });

    // Load spaces — from Supabase if authenticated, else from backend
    const loadSpaces = async () => {
      if (auth?.isAuthenticated) {
        // Use Supabase RLS for authenticated users
        const r = await sendMessage({ type: 'FETCH_SPACES_SUPABASE' });
        if (r.success && Array.isArray(r.data) && r.data.length > 0) {
          setSpaces(r.data);
          const configuredSpace = config.autoCaptureSpaceId;
          if (
            typeof configuredSpace === 'number' &&
            r.data.some((space: Space) => space.id === configuredSpace)
          ) {
            setSelectedSpaceId(configuredSpace);
          } else if (r.data.length === 1) {
            setSelectedSpaceId(r.data[0].id);
          }
          return;
        }
        // If direct Supabase read fails or returns empty, fallback to backend API.
        console.warn('[Misir Popup] Supabase spaces unavailable, falling back to backend', r.error);
      }

      // Fallback to backend API
      const r = await sendMessage({ type: 'FETCH_SPACES' });
      if (r.success && r.data) {
        setSpaces(r.data);
        const configuredSpace = config.autoCaptureSpaceId;
        if (
          typeof configuredSpace === 'number' &&
          r.data.some((space: Space) => space.id === configuredSpace)
        ) {
          setSelectedSpaceId(configuredSpace);
        } else if (r.data.length === 1) {
          setSelectedSpaceId(r.data[0].id);
        }
      }
    };
    loadSpaces();

    // Load recent captures
    sendMessage({ type: 'GET_RECENT' }).then((r: any) => {
      if (r.success && r.data) setRecentCaptures(r.data);
    });

    // Scrape current page
    scrapeCurrentPage();
  }, [auth]);

  useEffect(() => {
    if (!selectedSpaceId) return;
    sendMessage({
      type: 'SET_CONFIG',
      config: { autoCaptureSpaceId: selectedSpaceId },
    });
  }, [selectedSpaceId]);

  // ── Load subspaces and markers when space selected ──

  useEffect(() => {
    if (!selectedSpaceId || !auth?.isAuthenticated) {
      setSubspaces([]);
      setMarkers([]);
      return;
    }

    // Load subspaces
    sendMessage({ type: 'FETCH_SUBSPACES_SUPABASE', spaceId: selectedSpaceId }).then((r: any) => {
      if (r.success && r.data) {
        setSubspaces(r.data);
      }
    });

    // Load markers
    sendMessage({ type: 'FETCH_MARKERS_SUPABASE', spaceId: selectedSpaceId }).then((r: any) => {
      if (r.success && r.data) {
        setMarkers(r.data);
      }
    });
  }, [selectedSpaceId, auth]);

  // ── Scrape ────────────────────────────────────────

  const ensureContentScript = useCallback(async (tabId: number) => {
    const manifest = chrome.runtime.getManifest();
    const contentScriptFile = manifest.content_scripts?.[0]?.js?.[0];
    if (!contentScriptFile) return;

    await chrome.scripting.executeScript({
      target: { tabId },
      files: [contentScriptFile],
    });
  }, []);

  const scrapeCurrentPage = useCallback(async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabUrl = tab?.url ?? tab?.pendingUrl ?? '';
      if (!tab?.id || !tabUrl || tabUrl.startsWith('chrome://') || tabUrl.startsWith('chrome-extension://')) {
        return;
      }

      let resp: any;
      try {
        resp = await chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_PAGE' });
      } catch (err) {
        // Content script may not be injected yet (site access set to "on click")
        console.warn('[Misir Popup] Content script not ready, injecting...', err);
        try {
          await ensureContentScript(tab.id);
        } catch (injectErr) {
          console.error('[Misir Popup] Content script injection failed:', injectErr);
          throw new Error('Content script not available on this page');
        }
        await new Promise((r) => setTimeout(r, 200));
        try {
          resp = await chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_PAGE' });
        } catch (retryErr) {
          console.error('[Misir Popup] Content script still not available:', retryErr);
          throw new Error('Content script not available on this page');
        }
      }

      if (resp?.success && resp.data) {
        setPageData(resp.data);

        // Run classification in background
        const clsResp = await sendMessage({
          type: 'CLASSIFY_CONTENT',
          page: resp.data.page,
          metrics: resp.data.metrics,
          engagement: resp.data.engagement,
        });
        if (clsResp.success && clsResp.data) {
          setClassification(clsResp.data);
        }
      }
    } catch (err) {
      console.error('[Misir Popup] Scrape failed:', err);
    }
  }, [ensureContentScript]);

  // ── Capture ───────────────────────────────────────

  const handleCapture = useCallback(async () => {
    if (!selectedSpaceId || !pageData) return;
    setCaptureState('capturing');
    setCaptureError('');

    const resp = await sendMessage({
      type: 'CAPTURE',
      spaceId: selectedSpaceId,
      page: pageData.page,
      metrics: pageData.metrics,
      engagement: pageData.engagement,
    });

    if (resp.success) {
      setCaptureState('success');
      setLastArtifactId(resp.data?.artifact_id);
      // Refresh recent
      const recentResp = await sendMessage({ type: 'GET_RECENT' });
      if (recentResp.success) setRecentCaptures(recentResp.data);
      setTimeout(() => setCaptureState('idle'), 2500);
    } else {
      setCaptureState('error');
      setCaptureError(resp.error || 'Capture failed');
      setTimeout(() => setCaptureState('idle'), 4000);
    }
  }, [selectedSpaceId, pageData]);

  // ── Render ────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-misir-border">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-misir-accent" />
          <span className="text-sm font-semibold">Misir Sensor</span>
          {auth?.isAuthenticated && auth.email && (
            <span className="text-[10px] text-misir-muted truncate max-w-[100px]" title={auth.email}>
              {auth.email}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Classifier indicator */}
          <div
            className={`w-2 h-2 rounded-full ${nlpReady ? 'bg-purple-400' : 'bg-yellow-500'}`}
            title={nlpReady ? 'backend classifier active' : 'classifier unavailable'}
          />
          {/* Backend health */}
          <div
            className={`w-2 h-2 rounded-full ${backendHealthy === null
                ? 'bg-gray-500 animate-pulse'
                : backendHealthy
                  ? 'bg-misir-success'
                  : 'bg-misir-danger'
              }`}
            title={backendHealthy ? 'Backend connected' : 'Backend offline'}
          />
          {auth?.isAuthenticated && (
            <button
              onClick={onSignOut}
              className="p-1 hover:bg-misir-surface rounded"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5 text-misir-muted" />
            </button>
          )}
          <button onClick={onOpenSettings} className="p-1 hover:bg-misir-surface rounded">
            <SettingsIcon className="w-4 h-4 text-misir-muted" />
          </button>
        </div>
      </div>

      {/* Page Info */}
      <div className="px-4 py-3 border-b border-misir-border">
        {pageData ? (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate" title={pageData.page.title}>
                  {pageData.page.title || 'Untitled Page'}
                </p>
                <p className="text-xs text-misir-muted truncate">{pageData.page.domain}</p>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full border font-medium whitespace-nowrap ${getEngagementBadgeClass(classification?.engagementLevel || pageData.engagement)
                  }`}
              >
                {classification?.engagementLevel || pageData.engagement}
              </span>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-misir-muted">
              <span>{pageData.page.wordCount.toLocaleString()} words</span>
              <span>·</span>
              <span>{Math.round(pageData.metrics.dwellTimeMs / 1000)}s dwell</span>
              <span>·</span>
              <span>{Math.round(pageData.metrics.scrollDepth * 100)}% scroll</span>
            </div>

            {/* Confidence/Relevance Score */}
            {classification && (
              <div className="flex items-end justify-between mt-2 pt-2 border-t border-misir-border">
                <span className="text-[10px] text-misir-muted">Confidence</span>
                <div className="flex items-baseline gap-1">
                  <span className={`text-2xl font-mono font-bold ${getScoreColor(Math.round(classification.confidence * 100))}`}>
                    {Math.round(classification.confidence * 100)}
                  </span>
                  <span className="text-[10px] text-misir-muted">/ 100</span>
                </div>
              </div>
            )}

            {/* Classifier Keywords */}
            {classification?.keywords && classification.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {classification.keywords.slice(0, 6).map((kw) => (
                  <span
                    key={kw}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-misir-surface border border-misir-border text-misir-muted"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            )}

            {/* Classification details */}
            {classification && (
              <div className="flex items-center gap-2 text-[10px] text-misir-muted">
                <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  {classification.contentType}
                </span>
                <span>→</span>
                <span className="text-misir-text">{classification.contentSource}</span>
                {classification.nlpAvailable && (
                  <span className="ml-auto" aria-label="backend classified">
                    <Brain className="w-3 h-3 text-purple-400" />
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4 text-sm text-misir-muted">
            <p>Cannot read this page</p>
          </div>
        )}
      </div>

      {/* Space Selector + Capture */}
      <div className="px-4 py-3 border-b border-misir-border space-y-2">
        <div>
          <label className="text-[10px] text-misir-muted uppercase tracking-wider block mb-1">
            Knowledge Space
          </label>
          <select
            className="w-full px-3 py-2 rounded-lg bg-misir-surface border border-misir-border text-sm text-misir-text focus:border-misir-accent focus:outline-none appearance-none cursor-pointer"
            value={selectedSpaceId ?? ''}
            onChange={(e) => setSelectedSpaceId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Select a space…</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.artifact_count !== undefined ? `(${s.artifact_count} items)` : ''}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleCapture}
          disabled={!selectedSpaceId || !pageData || captureState === 'capturing'}
          className={`w-full py-2.5 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${captureState === 'success'
              ? 'bg-misir-success/20 text-misir-success border border-misir-success/30'
              : captureState === 'error'
                ? 'bg-misir-danger/20 text-misir-danger border border-misir-danger/30'
                : 'bg-misir-accent text-white hover:bg-blue-600 disabled:opacity-40'
            }`}
        >
          {captureState === 'capturing' && <Loader2 className="w-4 h-4 animate-spin" />}
          {captureState === 'success' && <Check className="w-4 h-4" />}
          {captureState === 'idle' && <Plus className="w-4 h-4" />}
          {captureState === 'capturing'
            ? 'Classifying & Capturing…'
            : captureState === 'success'
              ? `Captured! (artifact #${lastArtifactId})`
              : captureState === 'error'
                ? captureError
                : 'Capture this page'}
        </button>
      </div>

      {/* Space Details (Subspaces & Markers) */}
      {auth?.isAuthenticated && selectedSpaceId && (subspaces.length > 0 || markers.length > 0) && (
        <div className="border-b border-misir-border">
          <button
            onClick={() => setShowSpaceDetails(!showSpaceDetails)}
            className="w-full px-4 py-2 flex items-center justify-between hover:bg-misir-surface/50 transition"
          >
            <span className="text-xs font-medium text-misir-muted uppercase tracking-wider">
              Space Details
            </span>
            <ChevronRight
              className={`w-3.5 h-3.5 text-misir-muted transition-transform ${showSpaceDetails ? 'rotate-90' : ''
                }`}
            />
          </button>

          {showSpaceDetails && (
            <div className="px-4 pb-3 space-y-3">
              {/* Subspaces */}
              {subspaces.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-medium text-misir-muted uppercase tracking-wider mb-1.5">
                    Subspaces ({subspaces.length})
                  </h4>
                  <div className="space-y-1">
                    {subspaces.slice(0, 5).map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between px-2 py-1.5 rounded bg-misir-surface/50 hover:bg-misir-surface transition"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{sub.name}</p>
                          {sub.description && (
                            <p className="text-[10px] text-misir-muted truncate">{sub.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-misir-muted shrink-0 ml-2">
                          <span>{sub.artifact_count} items</span>
                          <span>·</span>
                          <span>{Math.round(sub.confidence * 100)}%</span>
                        </div>
                      </div>
                    ))}
                    {subspaces.length > 5 && (
                      <p className="text-[10px] text-misir-muted text-center py-1">
                        +{subspaces.length - 5} more
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Markers */}
              {markers.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-medium text-misir-muted uppercase tracking-wider mb-1.5">
                    Markers ({markers.length})
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {markers.slice(0, 12).map((marker) => (
                      <span
                        key={marker.id}
                        className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-misir-accent/10 text-misir-accent border border-misir-accent/20"
                      >
                        {marker.label}
                        {marker.weight !== 1 && (
                          <span className="text-[9px] opacity-60">×{marker.weight.toFixed(1)}</span>
                        )}
                      </span>
                    ))}
                    {markers.length > 12 && (
                      <span className="inline-flex items-center text-[10px] px-2 py-1 text-misir-muted">
                        +{markers.length - 12} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Recent Captures */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-medium text-misir-muted uppercase tracking-wider">
            Recent ({recentCaptures.length})
          </h3>
          <button
            onClick={() =>
              chrome.tabs.create({ url: 'http://localhost:3000/dashboard' })
            }
            className="text-[10px] text-misir-accent hover:text-blue-400 flex items-center gap-0.5"
          >
            Dashboard <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        {recentCaptures.length === 0 ? (
          <p className="text-xs text-misir-muted text-center py-6">No captures yet</p>
        ) : (
          <div className="space-y-1">
            {recentCaptures.slice(0, 10).map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-misir-surface transition group"
              >
                <div className="w-6 h-6 rounded bg-misir-surface border border-misir-border flex items-center justify-center text-[10px] font-medium text-misir-muted shrink-0">
                  {(item.domain || '?')[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs truncate">{item.title || item.url}</p>
                  <div className="flex items-center gap-1.5 text-[10px] text-misir-muted">
                    <span>{item.domain}</span>
                    <span>·</span>
                    <span>{timeAgo(item.capturedAt)}</span>
                  </div>
                </div>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${getEngagementBadgeClass(item.engagementLevel)
                    }`}
                >
                  {item.engagementLevel}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── App (Root) ───────────────────────────────────────

export function App() {
  const [view, setView] = useState<'loading' | 'login' | 'main' | 'settings'>('loading');
  const [config, setConfig] = useState<SensorConfig | null>(null);
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [nlpStatus, setNlpStatus] = useState(false);

  useEffect(() => {
    (async () => {
      // Check auth state first
      const authResp = await sendMessage({ type: 'GET_AUTH_STATE' });
      const authState = authResp.success ? (authResp.data as AuthState) : null;
      setAuth(authState);

      // Load config
      const resp = await sendMessage({ type: 'GET_CONFIG' });
      if (resp.success && resp.data) {
        const cfg = resp.data as SensorConfig;
        setConfig(cfg);

        if (authState?.isAuthenticated) {
          // Authenticated via Supabase — go straight to main
          setView('main');
        } else {
          // No auth session — show login
          setView('login');
        }
      } else {
        setView('login');
      }

      const nlpResp = await sendMessage({ type: 'GET_NLP_STATUS' });
      setNlpStatus(nlpResp.success && nlpResp.data?.available);
    })();
  }, []);

  const handleLogin = async (email: string, password: string) => {
    const resp = await sendMessage({ type: 'SIGN_IN', email, password });
    if (!resp.success) throw new Error(resp.error || 'Sign in failed');
    setAuth(resp.data as AuthState);
    // Refresh config after auth state changes.
    const cfgResp = await sendMessage({ type: 'GET_CONFIG' });
    if (cfgResp.success) setConfig(cfgResp.data);
    setView('main');
  };

  const handleSignOut = async () => {
    await sendMessage({ type: 'SIGN_OUT' });
    setAuth(null);
    setView('login');
  };

  const handleSaveSettings = async (partial: Partial<SensorConfig>) => {
    await sendMessage({ type: 'SET_CONFIG', config: partial });
    const resp = await sendMessage({ type: 'GET_CONFIG' });
    if (resp.success) setConfig(resp.data);
    setView('main');
  };

  if (view === 'loading') {
    return (
      <div className="flex items-center justify-center h-[480px]">
        <Loader2 className="w-6 h-6 text-misir-accent animate-spin" />
      </div>
    );
  }

  if (view === 'login') {
    return <LoginView onLogin={handleLogin} />;
  }

  if (view === 'settings' && config) {
    return (
      <SettingsView
        config={config}
        onSave={handleSaveSettings}
        onBack={() => setView('main')}
        nlpStatus={nlpStatus}
      />
    );
  }

  if (config) {
    return (
      <MainView
        config={config}
        auth={auth}
        onOpenSettings={() => setView('settings')}
        onSignOut={handleSignOut}
      />
    );
  }

  return null;
}
