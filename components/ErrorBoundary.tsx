import * as React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { captureError } from '../lib/sentry';

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

// Using explicit property declarations to satisfy TypeScript
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    // Explicitly declare inherited properties
    declare readonly props: ErrorBoundaryProps;
    declare state: ErrorBoundaryState;

    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
        this.handleReset = this.handleReset.bind(this);
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        console.error('[ErrorBoundary] Caught error:', error);
        console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);

        // Send to Sentry with component stack context
        captureError(error, {
            componentStack: errorInfo.componentStack,
            boundary: 'ErrorBoundary'
        });
    }

    handleReset(): void {
        this.setState({ hasError: false, error: null });
    }

    render(): React.ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen bg-[#0f1014] flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-zinc-900/50 border border-white/10 rounded-2xl p-8 text-center">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle className="text-red-500" size={32} />
                        </div>

                        <h1 className="text-2xl font-bold text-white mb-2">
                            Something went wrong
                        </h1>

                        <p className="text-zinc-400 mb-6">
                            We encountered an unexpected error. Please try again.
                        </p>

                        {this.state.error && (
                            <div className="bg-black/50 rounded-lg p-4 mb-6 text-left overflow-auto max-h-32">
                                <code className="text-xs text-red-400 font-mono">
                                    {this.state.error.message}
                                </code>
                            </div>
                        )}

                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={this.handleReset}
                                className="flex items-center gap-2 px-6 py-3 bg-white text-black font-bold rounded-full hover:bg-zinc-200 transition-colors"
                            >
                                <RefreshCw size={18} />
                                Try Again
                            </button>

                            <button
                                onClick={() => window.location.reload()}
                                className="px-6 py-3 bg-white/10 text-white font-bold rounded-full hover:bg-white/20 transition-colors"
                            >
                                Reload Page
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
