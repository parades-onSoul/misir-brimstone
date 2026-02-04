import { useState, useEffect } from 'react';
import { Explain } from './explain';
import type { Signal, SensorSettings } from '../types';

interface Stats {
  total: number;
  unsynced: number;
  synced: number;
}

interface ConnectionStatus {
  connected: boolean;
  latencyMs?: number;
}

export function Popup() {
  const [settings, setSettings] = useState<SensorSettings | null>(null);
  const [stats, setStats] = useState<Stats>({ total: 0, unsynced: 0, synced: 0 });
  const [connection, setConnection] = useState<ConnectionStatus | null>(null);
  const [recentSignals, setRecentSignals] = useState<Signal[]>([]);
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [currentTab, setCurrentTab] = useState<{ title: string; url: string } | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadData();
    getCurrentTab();
  }, []);

  const loadData = () => {
    // Get settings
    chrome.runtime.sendMessage({ action: 'getSettings' }, (res) => {
      if (res?.success) setSettings(res.data);
    });

    // Get stats
    chrome.runtime.sendMessage({ action: 'getStats' }, (res) => {
      if (res?.success) setStats(res.data);
    });

    // Get recent signals
    chrome.runtime.sendMessage({ action: 'getRecent', limit: 5 }, (res) => {
      if (res?.success) setRecentSignals(res.data);
    });

    // Check connection
    chrome.runtime.sendMessage({ action: 'checkConnection' }, (res) => {
      setConnection(res || { connected: false });
    });
  };

  const getCurrentTab = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab) {
        setCurrentTab({ title: tab.title || '', url: tab.url || '' });
      }
    });
  };

  const toggleEnabled = () => {
    if (!settings) return;
    chrome.runtime.sendMessage({
      action: 'updateSettings',
      settings: { enabled: !settings.enabled },
    }, (res) => {
      if (res?.success) setSettings(res.data);
    });
  };

  const manualCapture = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.id) {
        chrome.runtime.sendMessage({ action: 'manualCapture', tabId: tab.id }, (res) => {
          if (res?.success) {
            loadData();
          }
        });
      }
    });
  };

  const forceSync = () => {
    setSyncing(true);
    chrome.runtime.sendMessage({ action: 'forceSync' }, () => {
      setSyncing(false);
      loadData();
    });
  };

  // Show explain view for a signal
  if (selectedSignal) {
    return (
      <Explain 
        signal={selectedSignal} 
        onBack={() => setSelectedSignal(null)} 
      />
    );
  }

  return (
    <div className="w-80 p-4 bg-gray-50 min-h-[400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-800">Misir Sensor</h1>
        <StatusIndicator connected={connection?.connected ?? false} />
      </div>

      {/* Current Page */}
      {currentTab && (
        <div className="bg-white rounded-lg p-3 mb-3 border border-gray-200">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Current Page</p>
          <p className="text-sm font-medium text-gray-800 truncate">{currentTab.title}</p>
          <button
            onClick={manualCapture}
            className="mt-2 w-full py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition-colors"
          >
            Capture Now
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Pending" value={stats.unsynced} highlight={stats.unsynced > 0} />
        <StatCard label="Synced" value={stats.synced} />
      </div>

      {/* Sync Button */}
      {stats.unsynced > 0 && (
        <button
          onClick={forceSync}
          disabled={syncing}
          className="w-full py-2 mb-3 bg-gray-800 hover:bg-gray-900 disabled:bg-gray-400 text-white text-sm rounded transition-colors"
        >
          {syncing ? 'Syncing...' : `Sync ${stats.unsynced} Signals`}
        </button>
      )}

      {/* Recent Signals */}
      {recentSignals.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Recent</p>
          <div className="space-y-1">
            {recentSignals.map((signal) => (
              <button
                key={signal.id}
                onClick={() => setSelectedSignal(signal)}
                className="w-full text-left bg-white p-2 rounded border border-gray-200 hover:border-blue-300 transition-colors"
              >
                <p className="text-sm text-gray-800 truncate">{signal.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <TypeBadge type={signal.artifactType} />
                  <span className="text-xs text-gray-400">
                    {formatTime(signal.capturedAt)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Toggle */}
      <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
        <span className="text-sm text-gray-700">Auto-capture</span>
        <Toggle checked={settings?.enabled ?? true} onChange={toggleEnabled} />
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-gray-400 mt-4">
        v0.1.0 • Sensor Mode
      </p>
    </div>
  );
}

// ============================================================================
// COMPONENTS
// ============================================================================

function StatusIndicator({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="text-xs text-gray-500">{connected ? 'Online' : 'Offline'}</span>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="bg-white rounded-lg p-2 border border-gray-200 text-center">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-semibold ${highlight ? 'text-orange-500' : 'text-gray-800'}`}>
        {value}
      </p>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    ambient: 'bg-gray-100 text-gray-600',
    engaged: 'bg-blue-100 text-blue-600',
    committed: 'bg-green-100 text-green-600',
  };
  
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${colors[type] || colors.ambient}`}>
      {type}
    </span>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`w-10 h-5 rounded-full transition-colors ${checked ? 'bg-blue-500' : 'bg-gray-300'}`}
    >
      <div
        className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
