/**
 * Settings Page — Full page options UI
 *
 * Shows auth status, diagnostics, config, storage stats, and debug tools.
 */
import React, { useEffect, useState } from 'react';
import { Compass, Check, AlertCircle, Brain, Database, Trash2, LogOut, User, Shield } from 'lucide-react';
import type { SensorConfig, RecentCapture, AuthState } from '@/types';

function sendMessage(msg: Record<string, unknown>): Promise<any> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (resp: any) => {
      resolve(resp || { success: false, error: 'No response' });
    });
  });
}

export default function App() {
  const [config, setConfig] = useState<SensorConfig | null>(null);
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [nlpReady, setNlpReady] = useState(false);
  const [recent, setRecent] = useState<RecentCapture[]>([]);
  const [saved, setSaved] = useState(false);
  const [auth, setAuth] = useState<AuthState | null>(null);

  // Form state
  const [apiUrl, setApiUrl] = useState('');
  const [minWords, setMinWords] = useState(50);
  const [minDwell, setMinDwell] = useState(3000);
  const [enabled, setEnabled] = useState(true);
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(false);
  const [autoCaptureConfidence, setAutoCaptureConfidence] = useState(70);
  const [autoCaptureCooldownMin, setAutoCaptureCooldownMin] = useState(30);
  const [autoCaptureSpaceId, setAutoCaptureSpaceId] = useState('');

  useEffect(() => {
    (async () => {
      // Auth state
      const authResp = await sendMessage({ type: 'GET_AUTH_STATE' });
      if (authResp.success) setAuth(authResp.data as AuthState);

      const cfgResp = await sendMessage({ type: 'GET_CONFIG' });
      if (cfgResp.success) {
        const c = cfgResp.data as SensorConfig;
        setConfig(c);
        setApiUrl(c.apiUrl);
        setMinWords(c.minWordCount);
        setMinDwell(c.minDwellTimeMs);
        setEnabled(c.enabled);
        setAutoCaptureEnabled(c.autoCaptureEnabled);
        setAutoCaptureConfidence(Math.round((c.autoCaptureConfidenceThreshold ?? 0.55) * 100));
        setAutoCaptureCooldownMin(Math.max(1, Math.round((c.autoCaptureCooldownMs ?? 1800000) / 60000)));
        setAutoCaptureSpaceId(
          typeof c.autoCaptureSpaceId === 'number' && c.autoCaptureSpaceId > 0
            ? String(c.autoCaptureSpaceId)
            : ''
        );
      }

      const hResp = await sendMessage({ type: 'HEALTH_CHECK' });
      setHealthy(hResp.success && hResp.data?.healthy);

      const nlpResp = await sendMessage({ type: 'GET_NLP_STATUS' });
      setNlpReady(nlpResp.success && nlpResp.data?.available);

      const recResp = await sendMessage({ type: 'GET_RECENT' });
      if (recResp.success) setRecent(recResp.data);
    })();
  }, []);

  const handleSave = async () => {
    const parsedSpaceId = Number(autoCaptureSpaceId);
    const configUpdate: Partial<SensorConfig> = {
      apiUrl,
      minWordCount: minWords,
      minDwellTimeMs: minDwell,
      enabled,
      autoCaptureEnabled,
      autoCaptureConfidenceThreshold: Math.min(1, Math.max(0, autoCaptureConfidence / 100)),
      autoCaptureCooldownMs: Math.max(60000, autoCaptureCooldownMin * 60000),
      autoCaptureSpaceId:
        autoCaptureSpaceId.trim() === ''
          ? undefined
          : Number.isInteger(parsedSpaceId) && parsedSpaceId > 0
            ? parsedSpaceId
            : undefined,
    };

    await sendMessage({
      type: 'SET_CONFIG',
      config: configUpdate,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearRecent = async () => {
    await chrome.storage.local.set({ recentCaptures: [] });
    setRecent([]);
  };

  const handleSignOut = async () => {
    await sendMessage({ type: 'SIGN_OUT' });
    setAuth(null);
  };

  return (
    <div className="min-h-screen bg-misir-bg text-misir-text">
      <div className="max-w-xl mx-auto p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Compass className="w-8 h-8 text-misir-accent" />
          <div>
            <h1 className="text-xl font-bold">Misir Sensor Settings</h1>
            <p className="text-sm text-misir-muted">Extension v0.2.0 — Backend Classifier + Nomic 1.5 pipeline</p>
          </div>
        </div>

        {/* Auth Section */}
        <div className="rounded-xl bg-misir-surface border border-misir-border p-4 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4" /> Authentication
          </h2>
          {auth?.isAuthenticated ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-misir-muted flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Signed in as
                </span>
                <span className="text-misir-text font-medium">{auth.email}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-misir-muted">User ID</span>
                <span className="text-misir-muted text-xs font-mono truncate max-w-[200px]">{auth.userId}</span>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-misir-danger/10 text-misir-danger text-sm hover:bg-misir-danger/20 transition"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          ) : (
            <div className="text-sm text-misir-muted space-y-1">
              <p>Not authenticated</p>
              <p className="text-xs">Sign in from the popup to use your Supabase account</p>
            </div>
          )}
        </div>

        {/* Diagnostics */}
        <div className="rounded-xl bg-misir-surface border border-misir-border p-4 space-y-3">
          <h2 className="text-sm font-semibold">Diagnostics</h2>
          <div className="grid grid-cols-2 gap-3">
            <DiagItem
              label="Backend"
              value={healthy === null ? 'Checking…' : healthy ? 'Connected' : 'Offline'}
              ok={healthy === true}
            />
            <DiagItem label="Classifier" value={nlpReady ? 'Backend' : 'Unavailable'} ok={nlpReady} />
            <DiagItem label="Embeddings" value="Nomic 1.5 (server)" ok={healthy === true} />
            <DiagItem label="Recent Captures" value={String(recent.length)} ok={true} />
          </div>
        </div>

        {/* Configuration */}
        <div className="rounded-xl bg-misir-surface border border-misir-border p-4 space-y-4">
          <h2 className="text-sm font-semibold">Configuration</h2>

          <div className="space-y-3">
            <Field label="API URL" value={apiUrl} onChange={setApiUrl} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Min Word Count" value={String(minWords)} onChange={(v) => setMinWords(Number(v))} type="number" />
              <Field label="Min Dwell Time (ms)" value={String(minDwell)} onChange={(v) => setMinDwell(Number(v))} type="number" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Auto Capture</span>
              <button
                onClick={() => setAutoCaptureEnabled(!autoCaptureEnabled)}
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
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Auto Confidence (%)"
                value={String(autoCaptureConfidence)}
                onChange={(v) => setAutoCaptureConfidence(Number(v))}
                type="number"
              />
              <Field
                label="Auto Cooldown (min)"
                value={String(autoCaptureCooldownMin)}
                onChange={(v) => setAutoCaptureCooldownMin(Number(v))}
                type="number"
              />
            </div>
            <Field
              label="Auto Space ID (optional)"
              value={autoCaptureSpaceId}
              onChange={setAutoCaptureSpaceId}
              type="number"
            />
            <div className="flex items-center justify-between">
              <span className="text-sm">Sensor Enabled</span>
              <button
                onClick={() => setEnabled(!enabled)}
                className={`w-10 h-5 rounded-full transition-colors duration-200 ${
                  enabled ? 'bg-misir-accent' : 'bg-misir-border'
                } relative`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                    enabled ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          </div>

          <button
            onClick={handleSave}
            className="w-full py-2.5 rounded-lg bg-misir-accent text-white text-sm font-medium hover:bg-blue-600 transition flex items-center justify-center gap-2"
          >
            {saved ? <Check className="w-4 h-4" /> : null}
            {saved ? 'Saved!' : 'Save Configuration'}
          </button>
        </div>

        {/* Debug */}
        <div className="rounded-xl bg-misir-surface border border-misir-border p-4 space-y-3">
          <h2 className="text-sm font-semibold">Debug Tools</h2>
          <button
            onClick={handleClearRecent}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-misir-danger/10 text-misir-danger text-sm hover:bg-misir-danger/20 transition"
          >
            <Trash2 className="w-4 h-4" /> Clear Recent Captures
          </button>
        </div>
      </div>
    </div>
  );
}

function DiagItem({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-misir-muted">{label}</span>
      <span className={ok ? 'text-misir-success' : 'text-misir-warning'}>{value}</span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs text-misir-muted block mb-1">{label}</label>
      <input
        type={type}
        className="w-full px-3 py-2 rounded-lg bg-misir-bg border border-misir-border text-sm focus:border-misir-accent focus:outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

