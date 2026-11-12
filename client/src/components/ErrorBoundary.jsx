import { Component } from 'react';
import { captureException } from '../services/monitoring';

/**
 * Catches render errors so a single broken component shows a recoverable
 * message instead of a blank page, and reports the error to error tracking
 * (a no-op unless VITE_SENTRY_DSN is configured).
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(error);
    captureException(error, { componentStack: info?.componentStack });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-6 text-ink">
        <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted">
            The app hit an unexpected error. Reloading usually fixes it; your notes are stored on the server.
          </p>
          <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-panel p-3 text-xs text-muted">{error.message}</pre>
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-action px-4 py-2 text-sm font-medium text-action-foreground hover:bg-action-hover"
            >
              Reload
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = '/'; }}
              className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-panel"
            >
              Go home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
