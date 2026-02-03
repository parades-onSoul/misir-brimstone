/**
 * Popup App (Smart Sensor UI)
 * 
 * Shows:
 * - Login screen if not authenticated
 * - Sensor dashboard if authenticated
 */

import { useState, useEffect } from 'react';
import { useSensor } from './useSensor';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Activity,
  Database,
  Eye,
  RefreshCw,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  Target,
  Settings,
  LogIn,
  LogOut,
  Loader2,
  Mail,
  Lock,
  Upload,
  Share2,
  Layers,
} from 'lucide-react';
import { supabaseAuth, AuthState } from '../api/supabase';

// ============================================================================
// HELPERS
// ============================================================================

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
}

// ============================================================================
// LOGIN COMPONENT
// ============================================================================

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await supabaseAuth.signInWithEmail(email, password);

    if (!result.success) {
      setError(result.error || 'Login failed');
      setLoading(false);
      return;
    }

    // Trigger map refresh in background after login
    chrome.runtime.sendMessage({ type: 'refreshUserMap' }, () => {
      setLoading(false);
    });
  };

  return (
    <div className="w-80 bg-zinc-900 text-zinc-100 p-6 font-sans">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-zinc-800 rounded-full mx-auto mb-3 flex items-center justify-center">
          <Zap className="w-6 h-6 text-blue-400" />
        </div>
        <h1 className="font-bold text-lg">MISIR Sensor</h1>
        <p className="text-xs text-zinc-500 mt-1">Sign in to start capturing</p>
      </div>

      {/* Login Form */}
      <form onSubmit={handleLogin} className="space-y-3">
        <div>
          <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2">
            <Mail className="w-4 h-4 text-zinc-500" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 bg-transparent text-sm focus:outline-none placeholder-zinc-600"
              required
            />
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2">
            <Lock className="w-4 h-4 text-zinc-500" />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex-1 bg-transparent text-sm focus:outline-none placeholder-zinc-600"
              required
            />
          </div>
        </div>

        {error && (
          <div className="text-xs text-red-400 text-center">{error}</div>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LogIn className="w-4 h-4" />
          )}
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-zinc-800 text-center">
        <p className="text-[10px] text-zinc-600">
          Don't have an account?{' '}
          <button
            onClick={() => chrome.tabs.create({ url: 'https://your-app-url.com/signup' })}
            className="text-blue-400 hover:underline"
          >
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// DASHBOARD COMPONENT
// ============================================================================

function Dashboard({ user, onLogout }: { user: AuthState['user']; onLogout: () => void }) {
  const { state, loading, pushToBackend, refreshMap, captureNow } = useSensor();
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showMockPopup, setShowMockPopup] = useState(false);

  // Handle push to backend with feedback
  const handlePushToBackend = async () => {
    setPushing(true);
    setPushResult(null);

    const result = await pushToBackend();

    setPushing(false);
    if (result.success) {
      setPushResult({ success: true, message: `✓ Synced ${result.synced || 0} artifacts to DB` });
    } else {
      setPushResult({ success: false, message: result.error || 'Sync failed' });
    }

    // Clear message after 3 seconds
    setTimeout(() => setPushResult(null), 3000);
  };

  // Score color based on match quality
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-zinc-500';
  };

  // Status indicator
  const getStatusBadge = () => {
    if (state.match?.pass) {
      return <Badge variant="success">MATCH</Badge>;
    }
    if (state.status === 'analyzing') {
      return <Badge variant="outline">ANALYZING</Badge>;
    }
    return <Badge variant="outline">NOISE</Badge>;
  };

  if (loading) {
    return (
      <div className="w-80 bg-zinc-900 text-zinc-100 p-6 font-sans flex items-center justify-center">
        <RefreshCw className="w-5 h-5 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (showMockPopup) {
    return <PopupMockup onBack={() => setShowMockPopup(false)} />;
  }

  return (
    <div className="w-80 bg-zinc-900 text-zinc-100 p-4 font-sans">

      {/* ============ HEADER ============ */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${state.syncState?.active
              ? 'bg-blue-500 animate-pulse'
              : state.mapLoaded
                ? 'bg-green-500'
                : 'bg-zinc-600'
            }`} />
          <span className="font-bold tracking-wider text-sm">MISIR SENSOR</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMockPopup(true)}
            className="text-[10px] px-2 py-1 rounded border border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700/60 transition-colors"
          >
            Mock Popup
          </button>
          <span className="text-[10px] text-zinc-500 truncate max-w-[80px]" title={user?.email || ''}>
            {user?.email?.split('@')[0]}
          </span>
          <button
            onClick={onLogout}
            className="p-1 hover:bg-zinc-800 rounded transition-colors"
            title="Sign out"
          >
            <LogOut className="w-3 h-3 text-zinc-500 hover:text-zinc-300" />
          </button>
        </div>
      </div>

      {/* ============ CURRENT CONTEXT (The Eye) ============ */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-zinc-400 text-xs uppercase">
              <Eye className="w-3 h-3" />
              <span>Current Context</span>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Page Title */}
          {state.context && (
            <div className="text-sm text-zinc-300 line-clamp-1" title={state.context.title}>
              {state.context.title || 'Unknown Page'}
            </div>
          )}

          {/* Relevance Score */}
          <div className="flex items-end justify-between">
            <span className="text-sm text-zinc-500">Relevance Score</span>
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-mono font-bold ${getScoreColor(state.match?.score || 0)}`}>
                {state.match?.score?.toFixed(0) || '0'}
              </span>
              <span className="text-xs text-zinc-600">/ 100</span>
            </div>
          </div>

          {/* Matched Space */}
          {state.match?.topMatch && (
            <div className="flex items-center gap-2">
              <Target className="w-3 h-3 text-green-500" />
              <span className="text-sm text-green-400">
                {state.match.topMatch.spaceName}
              </span>
              <span className="text-xs text-zinc-600">
                ({(state.match.topMatch.similarity * 100).toFixed(0)}%)
              </span>
            </div>
          )}

          {/* Matched Markers */}
          {state.match?.matchedMarkerIds && state.match.matchedMarkerIds.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {state.match.matchedMarkerIds.slice(0, 4).map((id) => (
                <Badge key={id} variant="outline" className="text-[10px]">
                  #{id}
                </Badge>
              ))}
              {state.match.matchedMarkerIds.length > 4 && (
                <span className="text-[10px] px-1.5 py-0.5 text-zinc-500">
                  +{state.match.matchedMarkerIds.length - 4}
                </span>
              )}
            </div>
          ) : (
            <div className="text-xs text-zinc-600 italic">
              No known patterns detected
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============ STATS ============ */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 text-center">
          <div className="flex items-center justify-center gap-1 text-zinc-500 text-[10px] uppercase mb-1">
            <Activity className="w-2.5 h-2.5" />
            <span>Today</span>
          </div>
          <div className="text-xl font-bold">{state.stats?.dailyCount || 0}</div>
        </div>

        <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 text-center">
          <div className="flex items-center justify-center gap-1 text-zinc-500 text-[10px] uppercase mb-1">
            <Database className="w-2.5 h-2.5" />
            <span>Pending</span>
          </div>
          <div className="text-xl font-bold">{state.stats?.pendingSync || 0}</div>
        </div>

        <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 text-center">
          <div className="flex items-center justify-center gap-1 text-zinc-500 text-[10px] uppercase mb-1">
            <Zap className="w-2.5 h-2.5" />
            <span>Spaces</span>
          </div>
          <div className="text-xl font-bold">{state.spaceCount || 0}</div>
        </div>
      </div>

      {/* ============ SESSION INFO ============ */}
      {state.session?.sessionId && (
        <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800 mb-4 flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-2">
            <Activity className="w-3 h-3 text-blue-400" />
            <span className="text-zinc-400">Session:</span>
            <span className="text-zinc-300 font-mono">{state.session.sessionId.substring(0, 15)}...</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-zinc-500">
              {state.session.artifactCount} artifact{state.session.artifactCount !== 1 ? 's' : ''}
            </span>
            <span className="text-zinc-600">
              {formatDuration(state.session.durationMs)}
            </span>
          </div>
        </div>
      )}

      {/* ============ ACTIONS ============ */}
      <div className="space-y-2">
        {/* Push Result Feedback */}
        {pushResult && (
          <div className={`text-xs text-center py-1 px-2 rounded ${pushResult.success ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
            }`}>
            {pushResult.message}
          </div>
        )}

        {/* Primary Action: Push to Backend DB */}
        <Button
          onClick={handlePushToBackend}
          disabled={pushing || state.stats?.pendingSync === 0}
          className="w-full"
        >
          {pushing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {pushing ? 'Pushing to DB...' : `Push to DB (${state.stats?.pendingSync || 0} pending)`}
        </Button>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={captureNow}
          >
            <CheckCircle2 className="w-3 h-3" />
            Capture Now
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={refreshMap}
          >
            <Target className="w-3 h-3" />
            Refresh Map
          </Button>
        </div>
      </div>

      {/* ============ FOOTER ============ */}
      <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-600">
        <div className="flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          <span>
            Last sync: {state.syncState?.lastSync
              ? new Date(state.syncState.lastSync).toLocaleTimeString()
              : 'Never'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {state.syncState?.error && (
            <div className="flex items-center gap-1 text-red-400">
              <XCircle className="w-2.5 h-2.5" />
              <span>Error</span>
            </div>
          )}
          <button
            onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('src/settings/index.html') })}
            className="p-1 hover:bg-zinc-800 rounded transition-colors"
            title="Settings"
          >
            <Settings className="w-3 h-3 text-zinc-500 hover:text-zinc-300" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MOCK POPUP VIEW
// ============================================================================

function PopupMockup({ onBack }: { onBack: () => void }) {
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setDragging(true);
    setDragOffset({
      x: e.clientX - panelPos.x,
      y: e.clientY - panelPos.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setPanelPos({
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y,
    });
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  return (
    <div className="w-80 bg-[#121212] text-zinc-100 font-sans">
      <div
        className="relative h-[520px] overflow-hidden"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Blurry background context */}
        <div className="absolute inset-0 bg-[#121212]" />
        <div className="absolute inset-0 p-5 blur-sm opacity-50">
          <div className="text-zinc-200 text-sm font-semibold">
            Paul Graham — Founder Mode
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-3 rounded bg-zinc-700/70 w-11/12" />
            <div className="h-3 rounded bg-zinc-700/70 w-10/12" />
            <div className="h-3 rounded bg-zinc-700/70 w-9/12" />
            <div className="h-3 rounded bg-zinc-700/70 w-11/12" />
            <div className="h-3 rounded bg-zinc-700/70 w-8/12" />
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#121212]/60 to-[#121212]" />

        {/* Popup UI */}
        <div
          className="relative z-10 p-4"
          style={{ transform: `translate(${panelPos.x}px, ${panelPos.y}px)` }}
        >
          <div
            className="flex items-center justify-between mb-3 cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="font-bold tracking-wider text-xs">MISIR SENSOR</span>
            </div>
            <button
              onClick={onBack}
              className="text-[10px] px-2 py-1 rounded border border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700/60 transition-colors"
            >
              Back
            </button>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4 shadow-lg">
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest">Current Context</div>
            <div className="text-sm text-zinc-200 mt-1 line-clamp-1">Paul Graham: Founder Mode</div>

            <div className="mt-4 flex items-end justify-between">
              <span className="text-xs text-zinc-500">Relevance Score</span>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-mono font-bold text-emerald-400">94</span>
                <span className="text-xs text-emerald-300">/ 100</span>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                <Share2 className="h-3.5 w-3.5" />
                Matched to: Series A Prep
              </div>
              <p className="text-[10px] text-emerald-200/80 mt-1">
                High signal overlap with &apos;Founder Psychology&apos; cluster.
              </p>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border border-zinc-800 bg-zinc-900/70 p-2">
                <div className="text-[9px] text-zinc-500 uppercase">⚡ Today</div>
                <div className="text-lg font-bold text-zinc-100">14</div>
              </div>
              <div className="rounded-md border border-zinc-800 bg-zinc-900/70 p-2">
                <div className="text-[9px] text-zinc-500 uppercase">◷ Pending</div>
                <div className="text-lg font-bold text-zinc-100">3</div>
              </div>
              <div className="rounded-md border border-zinc-800 bg-zinc-900/70 p-2">
                <div className="text-[9px] text-zinc-500 uppercase">❖ Spaces</div>
                <div className="text-lg font-bold text-zinc-100">3</div>
              </div>
            </div>

            <button className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-md bg-emerald-500 text-zinc-900 text-xs font-semibold px-3 py-2 hover:bg-emerald-400 transition-colors">
              Save to “Series A Prep"
              <Layers className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN APP
// ============================================================================

export function App() {
  const [authState, setAuthState] = useState<AuthState>({ isAuthenticated: false, user: null, session: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for session to load from chrome.storage.local before checking auth
    const initAuth = async () => {
      await supabaseAuth.waitForInit();
      // Now subscribe to auth changes (session already restored)
      const unsubscribe = supabaseAuth.onAuthChange((state) => {
        setAuthState(state);
        setLoading(false);
      });
      return unsubscribe;
    };

    let cleanup: (() => void) | undefined;
    initAuth().then(unsub => { cleanup = unsub; });

    return () => cleanup?.();
  }, []);

  const handleLogout = async () => {
    await supabaseAuth.signOut();
  };

  if (loading) {
    return (
      <div className="w-80 bg-zinc-900 text-zinc-100 p-6 font-sans flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!authState.isAuthenticated) {
    return <LoginScreen />;
  }

  return <Dashboard user={authState.user} onLogout={handleLogout} />;
}

export default App;
