import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Home, RefreshCw, RotateCcw, TriangleAlert } from 'lucide-react';
import { isChunkLoadError } from '../../lib/chunkError';
import { Button } from '../ui/Button';

interface Props {
  children: ReactNode;
  reload?: () => void;
}

interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Application render error', error, info.componentStack);
    this.setState({ info });
  }

  private retry = () => {
    if (isChunkLoadError(this.state.error)) {
      (this.props.reload ?? (() => window.location.reload()))();
      return;
    }
    this.setState({ error: null, info: null });
  };

  private reload = () => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div
        role="alert"
        className="grid min-h-dvh place-items-center bg-surface px-4 py-12 text-ink"
      >
        <div className="w-full max-w-lg rounded-3xl surface-card p-6">
          <span className="grid h-12 w-12 place-items-center rounded-2xl border border-coral/25 bg-coral/10 text-coral">
            <TriangleAlert className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
            NeonRift
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">Something went wrong</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            The page stopped unexpectedly. Your favourites, recently played list and game records are
            stored in this browser and were not affected. Try rendering the page again, or reload it
            completely.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={this.retry}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Try again
            </Button>
            <Button variant="secondary" onClick={this.reload}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Reload page
            </Button>
          </div>

          <a
            href="/"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-brand underline underline-offset-2"
          >
            <Home className="h-3.5 w-3.5" aria-hidden="true" />
            Go to the home page
          </a>

          {import.meta.env.DEV ? (
            <details className="mt-5 rounded-xl border border-line bg-sunken p-3">
              <summary className="cursor-pointer text-xs font-medium text-muted">
                Developer diagnostics
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-muted">
                {this.state.error.message}
                {'\n\n'}
                {this.state.error.stack ?? 'No stack trace available.'}
                {this.state.info?.componentStack
                  ? `\n\nComponent stack:${this.state.info.componentStack}`
                  : ''}
              </pre>
            </details>
          ) : null}
        </div>
      </div>
    );
  }
}
