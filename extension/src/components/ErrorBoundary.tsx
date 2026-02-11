/**
 * Error Boundary Component
 *
 * Catches React errors and displays a fallback UI instead of crashing the popup.
 * Logs errors for debugging.
 */
import React, { ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console for debugging
    console.error('[Misir Error Boundary]', error);
    console.error('[Misir Error Info]', errorInfo);

    // Store error info in state
    this.setState({ errorInfo });

    // Optionally send to logging service (not implemented)
    // sendErrorToLogging(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-900 to-slate-800">
          {/* Header */}
          <div className="flex items-center gap-2 mb-6">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <h1 className="text-2xl font-bold text-white">
              {this.props.fallbackTitle || 'Something went wrong'}
            </h1>
          </div>

          {/* Error Message */}
          <p className="text-center text-slate-300 mb-4 max-w-md">
            {this.props.fallbackMessage ||
              'The extension encountered an unexpected error. Please try again.'}
          </p>

          {/* Error Details (Development only) */}
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <div className="w-full mb-6 p-4 bg-slate-800 rounded-lg border border-red-500/30">
              <p className="text-xs font-mono text-red-300 whitespace-pre-wrap break-words">
                {this.state.error.toString()}
              </p>
              {this.state.errorInfo && (
                <details className="mt-2">
                  <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-300">
                    Component Stack
                  </summary>
                  <pre className="mt-2 text-xs text-slate-400 overflow-auto max-h-40">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Try Again
            </button>
            <button
              onClick={() => chrome.runtime.reload()}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
            >
              Reload Extension
            </button>
          </div>

          {/* Footer Help Text */}
          <p className="text-xs text-slate-500 mt-6 text-center">
            If the problem persists, check the browser console for more details
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
