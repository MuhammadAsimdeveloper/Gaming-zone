import { Component, type ErrorInfo, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '../ui/Button';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

export class GameErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Game runtime error', error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="grid min-h-[420px] place-items-center rounded-3xl border border-white/10 bg-night-900 p-6">
          <div className="max-w-md text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-coral/25 bg-coral/10 text-coral">
              <TriangleAlert className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="mt-4 font-display text-xl font-semibold text-ink">This game hit a snag</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              The game stopped unexpectedly. Your saved scores were not affected. Try restarting,
              or use another browser if the problem repeats.
            </p>
            <p className="mt-2 break-words text-[11px] text-muted/60">{this.state.error.message}</p>
            <Button className="mt-5" onClick={this.reset}>
              Restart game
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
