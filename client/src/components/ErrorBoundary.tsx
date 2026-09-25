import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Unhandled React Error in Catan:', error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    this.setState({ hasError: false, error: null });
    window.location.hash = '';
    window.location.href = window.location.pathname;
  };

  handleCopy = async (): Promise<void> => {
    if (this.state.error && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(
          `${this.state.error.name}: ${this.state.error.message}\n${this.state.error.stack ?? ''}`,
        );
        alert('Error details copied to clipboard!');
      } catch {
        // clipboard unavailable
      }
    }
  };

  override render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-ocean p-4 text-ink select-none">
          <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-3xl border-2 border-line bg-cream p-6 text-center shadow-2xl">
            <span className="text-5xl" aria-hidden="true">
              ⛵
            </span>
            <h1 className="font-display text-2xl font-bold text-ink">Something went wrong</h1>
            <p className="text-sm font-medium text-ink-soft">
              The game ran into an unexpected display issue. Your game session is preserved.
            </p>
            {this.state.error ? (
              <div className="w-full max-h-32 overflow-y-auto rounded-xl border border-red-200 bg-red-50 p-2.5 text-left font-mono text-xs text-red-700 break-words">
                {this.state.error.message || 'Unknown error'}
              </div>
            ) : null}
            <div className="flex w-full flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="h-12 w-full rounded-2xl bg-cta font-display text-base font-bold text-ink shadow-[0_4px_0_#a86d08] active:translate-y-px"
              >
                Reload Game
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="h-12 w-full rounded-2xl bg-parchment font-display text-base font-bold text-ink active:translate-y-px"
              >
                Back to Home
              </button>
              <button
                type="button"
                onClick={this.handleCopy}
                className="text-xs font-bold text-ocean-deep underline hover:opacity-80 pt-1"
              >
                Copy error details
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
