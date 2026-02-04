/**
 * Settings Page
 * 
 * Full settings page with:
 * - Diagnostics (Backend, NLP)
 * - Configuration (API URL, thresholds)
 * - Storage stats
 * - User Map info
 * - Debug tools
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Server, 
  Brain,
  ArrowLeft,
  Loader2,
  Database,
  Settings,
  Map,
  Trash2,
  Download,
  Power,
  Clock,
  Save,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface DiagnosticStatus {
  checked: boolean;
  ok: boolean;
  message: string;
  latencyMs?: number;
}

interface StorageStats {
  artifactCount: number;
  pendingSyncCount: number;
  oldestPending: number | null;
}

interface UserMapInfo {
  loaded: boolean;
  spaceCount: number;
  markerCount: number;
  lastUpdated: number | null;
}

interface SensorSettings {
  enabled: boolean;
  apiUrl: string;
  minDwellTimeMs: number;
  minWordCount: number;
  syncIntervalMin: number;
}

const DEFAULT_SETTINGS: SensorSettings = {
  enabled: true,
  apiUrl: 'http://localhost:8000/api/v1',
  minDwellTimeMs: 5000,
  minWordCount: 100,
  syncIntervalMin: 30,
};

// ============================================================================
// COMPONENT
// ============================================================================

export function App() {
  // Diagnostics
  const [diagnostics, setDiagnostics] = useState({
    backend: { checked: false, ok: false, message: 'Not checked' } as DiagnosticStatus,
    nlp: { checked: false, ok: false, message: 'Not checked' } as DiagnosticStatus,
  });
  const [checking, setChecking] = useState<string | null>(null);

  // Settings
  const [settings, setSettings] = useState<SensorSettings>(DEFAULT_SETTINGS);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Storage
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [clearing, setClearing] = useState(false);

  // User Map
  const [userMap, setUserMap] = useState<UserMapInfo | null>(null);
  const [refreshingMap, setRefreshingMap] = useState(false);

  // --------------------------------------------------------------------------
  // LOAD DATA
  // --------------------------------------------------------------------------

  const loadSettings = useCallback(() => {
    chrome.storage.sync.get('sensor_settings', (result) => {
      if (result.sensor_settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...result.sensor_settings });
      }
    });
  }, []);

  const loadStorageStats = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'getStorageStats' }, (response) => {
      if (response && !chrome.runtime.lastError) {
        setStorageStats(response);
      }
    });
  }, []);

  const loadUserMapInfo = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'getUserMapInfo' }, (response) => {
      if (response && !chrome.runtime.lastError) {
        setUserMap(response);
      }
    });
  }, []);

  useEffect(() => {
    loadSettings();
    loadStorageStats();
    loadUserMapInfo();
  }, [loadSettings, loadStorageStats, loadUserMapInfo]);

  // --------------------------------------------------------------------------
  // DIAGNOSTICS
  // --------------------------------------------------------------------------

  const checkBackend = async () => {
    setChecking('backend');
    setDiagnostics(prev => ({
      ...prev,
      backend: { checked: false, ok: false, message: 'Checking...' },
    }));

    const start = Date.now();

    try {
      const response = await fetch(`${settings.apiUrl}/extension/health`, {
        signal: AbortSignal.timeout(5000),
      });
      
      const latencyMs = Date.now() - start;

      if (response.ok) {
        const data = await response.json();
        setDiagnostics(prev => ({
          ...prev,
          backend: {
            checked: true,
            ok: true,
            message: `Connected (${data.service || 'OK'})`,
            latencyMs,
          },
        }));
      } else {
        setDiagnostics(prev => ({
          ...prev,
          backend: { checked: true, ok: false, message: `HTTP ${response.status}` },
        }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      setDiagnostics(prev => ({
        ...prev,
        backend: {
          checked: true,
          ok: false,
          message: message.includes('timeout') ? 'Timeout' : message,
        },
      }));
    } finally {
      setChecking(null);
    }
  };

  const checkNlp = () => {
    setChecking('nlp');
    chrome.runtime.sendMessage({ type: 'CHECK_NLP_STATUS' }, (response) => {
      if (chrome.runtime.lastError) {
        setDiagnostics(prev => ({
          ...prev,
          nlp: { checked: true, ok: false, message: 'Background not responding' },
        }));
      } else if (response?.loaded) {
        setDiagnostics(prev => ({
          ...prev,
          nlp: { checked: true, ok: true, message: `Loaded (${response.modelName})` },
        }));
      } else {
        setDiagnostics(prev => ({
          ...prev,
          nlp: { checked: true, ok: false, message: response?.error || 'Not loaded' },
        }));
      }
      setChecking(null);
    });
  };

  const runAllChecks = async () => {
    await checkBackend();
    checkNlp();
  };

  // --------------------------------------------------------------------------
  // SETTINGS
  // --------------------------------------------------------------------------

  const updateSetting = <K extends keyof SensorSettings>(key: K, value: SensorSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSettingsDirty(true);
  };

  const saveSettings = async () => {
    setSaving(true);
    await chrome.storage.sync.set({ sensor_settings: settings });
    setSettingsDirty(false);
    setSaving(false);
  };

  // --------------------------------------------------------------------------
  // STORAGE
  // --------------------------------------------------------------------------

  const clearStorage = async () => {
    if (!confirm('Clear all local data? This cannot be undone.')) return;
    
    setClearing(true);
    chrome.runtime.sendMessage({ type: 'clearAllData' }, () => {
      loadStorageStats();
      setClearing(false);
    });
  };

  // --------------------------------------------------------------------------
  // USER MAP
  // --------------------------------------------------------------------------

  const refreshUserMap = () => {
    setRefreshingMap(true);
    chrome.runtime.sendMessage({ type: 'refreshUserMap' }, () => {
      loadUserMapInfo();
      setRefreshingMap(false);
    });
  };

  // --------------------------------------------------------------------------
  // DEBUG
  // --------------------------------------------------------------------------

  const exportDebugInfo = () => {
    const debugData = {
      timestamp: new Date().toISOString(),
      settings,
      diagnostics,
      storageStats,
      userMap,
      userAgent: navigator.userAgent,
    };
    
    const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `misir-debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------

  const StatusBadge = ({ status }: { status: DiagnosticStatus }) => {
    if (!status.checked) return <Badge variant="outline">Not Checked</Badge>;
    if (status.ok) return <Badge variant="success"><CheckCircle2 className="w-3 h-3 mr-1" />OK</Badge>;
    return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Error</Badge>;
  };

  const formatTime = (ms: number | null) => {
    if (!ms) return 'Never';
    return new Date(ms).toLocaleString();
  };

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------

  return (
    <div className="min-h-full h-full w-full bg-zinc-900 text-zinc-100 font-sans overflow-auto">
      <div className="w-full max-w-2xl mx-auto p-8">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={() => window.close()}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Settings</h1>
            <p className="text-sm text-zinc-500">Diagnostics & Configuration</p>
          </div>
        </div>

        {/* ================================================================ */}
        {/* DIAGNOSTICS */}
        {/* ================================================================ */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-zinc-400 uppercase mb-3 flex items-center gap-2">
            <Server className="w-4 h-4" /> Diagnostics
          </h2>
          
          <Card className="mb-3">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Server className="w-4 h-4 text-blue-400" /> Backend Server
                </CardTitle>
                <StatusBadge status={diagnostics.backend} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-zinc-400 mb-2">
                {diagnostics.backend.message}
                {diagnostics.backend.latencyMs && <span className="text-zinc-600 ml-2">({diagnostics.backend.latencyMs}ms)</span>}
              </div>
              <Button size="sm" onClick={checkBackend} disabled={checking === 'backend'}>
                {checking === 'backend' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Check
              </Button>
            </CardContent>
          </Card>

          <Card className="mb-3">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-400" /> NLP Engine
                </CardTitle>
                <StatusBadge status={diagnostics.nlp} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-zinc-400 mb-2">{diagnostics.nlp.message}</div>
              <Button size="sm" onClick={checkNlp} disabled={checking === 'nlp'}>
                {checking === 'nlp' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Check
              </Button>
            </CardContent>
          </Card>

          <Button className="w-full" onClick={runAllChecks} disabled={checking !== null}>
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Run All Diagnostics
          </Button>
        </section>

        {/* ================================================================ */}
        {/* CONFIGURATION */}
        {/* ================================================================ */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-zinc-400 uppercase mb-3 flex items-center gap-2">
            <Settings className="w-4 h-4" /> Configuration
          </h2>

          <Card>
            <CardContent className="pt-4 space-y-4">
              {/* Enable/Disable */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Power className="w-4 h-4 text-green-400" />
                  <span className="text-sm">Sensor Enabled</span>
                </div>
                <button
                  onClick={() => updateSetting('enabled', !settings.enabled)}
                  className={`w-12 h-6 rounded-full transition-colors ${settings.enabled ? 'bg-green-500' : 'bg-zinc-700'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform mx-0.5 ${settings.enabled ? 'translate-x-6' : ''}`} />
                </button>
              </div>

              {/* API URL */}
              <div>
                <label className="text-sm text-zinc-400 block mb-1">API URL</label>
                <input
                  type="text"
                  value={settings.apiUrl}
                  onChange={(e) => updateSetting('apiUrl', e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
                />
              </div>

              {/* Min Dwell Time */}
              <div>
                <label className="text-sm text-zinc-400 block mb-1">Min Dwell Time (seconds)</label>
                <input
                  type="number"
                  value={settings.minDwellTimeMs / 1000}
                  onChange={(e) => updateSetting('minDwellTimeMs', Number(e.target.value) * 1000)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
                  min={1}
                  max={60}
                />
              </div>

              {/* Min Word Count */}
              <div>
                <label className="text-sm text-zinc-400 block mb-1">Min Word Count</label>
                <input
                  type="number"
                  value={settings.minWordCount}
                  onChange={(e) => updateSetting('minWordCount', Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
                  min={10}
                  max={500}
                />
              </div>

              {/* Sync Interval */}
              <div>
                <label className="text-sm text-zinc-400 block mb-1">Sync Interval (minutes)</label>
                <input
                  type="number"
                  value={settings.syncIntervalMin}
                  onChange={(e) => updateSetting('syncIntervalMin', Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
                  min={5}
                  max={120}
                />
              </div>

              {/* Save Button */}
              <Button 
                className="w-full" 
                onClick={saveSettings} 
                disabled={!settingsDirty || saving}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {settingsDirty ? 'Save Changes' : 'Saved'}
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* ================================================================ */}
        {/* STORAGE */}
        {/* ================================================================ */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-zinc-400 uppercase mb-3 flex items-center gap-2">
            <Database className="w-4 h-4" /> Storage
          </h2>

          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{storageStats?.artifactCount ?? '—'}</div>
                  <div className="text-xs text-zinc-500">Artifacts</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{storageStats?.pendingSyncCount ?? '—'}</div>
                  <div className="text-xs text-zinc-500">Pending Sync</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-zinc-500">
                    {storageStats?.oldestPending ? '⏳' : '✓'}
                  </div>
                  <div className="text-xs text-zinc-500">Queue Status</div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={loadStorageStats}>
                  <RefreshCw className="w-3 h-3" /> Refresh
                </Button>
                <Button size="sm" variant="destructive" onClick={clearStorage} disabled={clearing}>
                  {clearing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  Clear All Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ================================================================ */}
        {/* USER MAP */}
        {/* ================================================================ */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-zinc-400 uppercase mb-3 flex items-center gap-2">
            <Map className="w-4 h-4" /> User Map
          </h2>

          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{userMap?.spaceCount ?? '—'}</div>
                  <div className="text-xs text-zinc-500">Spaces</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{userMap?.markerCount ?? '—'}</div>
                  <div className="text-xs text-zinc-500">Markers</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${userMap?.loaded ? 'text-green-400' : 'text-zinc-500'}`}>
                    {userMap?.loaded ? '✓' : '✗'}
                  </div>
                  <div className="text-xs text-zinc-500">Loaded</div>
                </div>
              </div>

              <div className="text-xs text-zinc-500 mb-3 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Last updated: {formatTime(userMap?.lastUpdated ?? null)}
              </div>

              <Button size="sm" onClick={refreshUserMap} disabled={refreshingMap}>
                {refreshingMap ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Refresh Map
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* ================================================================ */}
        {/* DEBUG */}
        {/* ================================================================ */}
        <section className="mb-8">
          <h2 className="text-sm font-medium text-zinc-400 uppercase mb-3 flex items-center gap-2">
            🐛 Debug
          </h2>

          <Card>
            <CardContent className="pt-4 space-y-3">
              <Button size="sm" variant="secondary" onClick={exportDebugInfo}>
                <Download className="w-3 h-3" /> Export Debug Info
              </Button>

              <Button 
                size="sm" 
                variant="secondary" 
                onClick={() => chrome.runtime.reload()}
              >
                <RefreshCw className="w-3 h-3" /> Reload Extension
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Footer */}
        <div className="text-xs text-zinc-600 text-center">
          MISIR Sensor v0.2.0 • Settings Page
        </div>
      </div>
    </div>
  );
}

export default App;
