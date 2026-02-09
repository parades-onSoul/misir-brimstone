import type { Signal } from '../types';

interface ExplainProps {
  signal: Signal;
  onBack: () => void;
}

/**
 * Explain View
 * 
 * Shows why a signal was captured and its classification details.
 */
export function Explain({ signal, onBack }: ExplainProps) {
  return (
    <div className="w-80 p-4 bg-gray-50 min-h-[400px]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={onBack}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-gray-800">Why Saved?</h1>
      </div>

      {/* Title */}
      <div className="bg-white rounded-lg p-3 mb-3 border border-gray-200">
        <p className="text-sm font-medium text-gray-800">{signal.title}</p>
        <p className="text-xs text-gray-400 truncate mt-1">{signal.domain}</p>
      </div>

      {/* Classification */}
      <div className="bg-white rounded-lg p-3 mb-3 border border-gray-200">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Classification</p>
        
        <div className="flex items-center gap-2 mb-3">
          <TypeBadge type={signal.artifactType} />
          <span className="text-sm text-gray-600">
            {getTypeDescription(signal.artifactType)}
          </span>
        </div>

        <p className="text-xs text-gray-500 mb-2">
          {getTypeExplanation(signal.artifactType)}
        </p>
      </div>

      {/* Metrics */}
      <div className="bg-white rounded-lg p-3 mb-3 border border-gray-200">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Engagement Signals</p>
        
        <div className="space-y-2">
          <MetricRow 
            label="Time on page" 
            value={formatDuration(signal.dwellTimeMs)}
            icon="⏱️"
          />
          <MetricRow 
            label="Scroll depth" 
            value={`${Math.round(signal.scrollDepth * 100)}%`}
            icon="📜"
          />
          <MetricRow 
            label="Reading depth" 
            value={getReadingLabel(signal.readingDepth)}
            icon="📖"
          />
          <MetricRow 
            label="Word count" 
            value={signal.wordCount.toLocaleString()}
            icon="📝"
          />
          <MetricRow 
            label="Capture method" 
            value={signal.captureMethod}
            icon={signal.captureMethod === 'manual' ? '👆' : '🤖'}
          />
        </div>
      </div>

      {/* Sync Status */}
      <div className="bg-white rounded-lg p-3 border border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Sync status</span>
          <span className={`text-sm font-medium ${signal.synced ? 'text-green-600' : 'text-orange-500'}`}>
            {signal.synced ? '✓ Synced' : '⏳ Pending'}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Captured {formatTimestamp(signal.capturedAt)}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENTS
// ============================================================================

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    ambient: 'bg-gray-100 text-gray-600',
    engaged: 'bg-blue-100 text-blue-600',
    committed: 'bg-green-100 text-green-600',
  };
  
  return (
    <span className={`text-sm px-2 py-0.5 rounded font-medium ${colors[type] || colors.ambient}`}>
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </span>
  );
}

function MetricRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600">
        <span className="mr-1.5">{icon}</span>
        {label}
      </span>
      <span className="text-sm font-medium text-gray-800">{value}</span>
    </div>
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function getTypeDescription(type: string): string {
  switch (type) {
    case 'ambient': return 'Brief visit';
    case 'engaged': return 'Active reading';
    case 'committed': return 'Deep study';
    default: return type;
  }
}

function getTypeExplanation(type: string): string {
  switch (type) {
    case 'ambient':
      return 'You visited this page briefly. Low engagement signal sent to backend.';
    case 'engaged':
      return 'You spent time reading this content. Medium engagement signal sent.';
    case 'committed':
      return 'You deeply engaged with this content. Strong signal sent to backend.';
    default:
      return '';
  }
}

function getReadingLabel(depth: number): string {
  if (depth <= 0) return 'Bounce';
  if (depth <= 0.5) return 'Skimmed';
  if (depth <= 1.0) return 'Read';
  return 'Deep read';
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  
  const isToday = date.toDateString() === now.toDateString();
  
  if (isToday) {
    return `today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  
  return date.toLocaleDateString([], { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
