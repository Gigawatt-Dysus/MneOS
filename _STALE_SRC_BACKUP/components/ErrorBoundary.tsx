import React, { ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: undefined,
    errorInfo: undefined,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI.
    console.error("[ErrorBoundary] Caught a rendering error:", error);
    return { hasError: true, error: error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error details:", error, errorInfo);
    this.setState({ errorInfo: errorInfo });
  }

  private handleReset = () => {
    console.warn("[ErrorBoundary] User triggered a hard reset.");
    
    const savedConfig = localStorage.getItem('gigi_firebase_config');
    const savedTheme = localStorage.getItem('theme');
    
    const restorePreferences = () => {
        if (savedConfig) localStorage.setItem('gigi_firebase_config', savedConfig);
        if (savedTheme) localStorage.setItem('theme', savedTheme);
    };

    try {
      // Attempt to clear IndexedDB
      const dbRequest = indexedDB.deleteDatabase('GigiDB');
      const reload = () => {
          localStorage.clear();
          restorePreferences();
          window.location.reload();
      }
      dbRequest.onsuccess = reload;
      dbRequest.onerror = reload;
      dbRequest.onblocked = reload; // Just reload if blocked
    } catch (error) {
      localStorage.clear();
      restorePreferences();
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
            <div className="max-w-2xl w-full bg-red-900/50 border border-red-500 rounded-lg p-8 shadow-2xl text-left">
                <h1 className="text-3xl font-bold text-red-300">Application Error</h1>
                <p className="mt-2 text-red-200">
                    Gigi has encountered a critical error.
                </p>
                <div className="mt-4 bg-black/50 p-4 rounded-md font-mono text-sm overflow-auto max-h-96">
                    <h2 className="font-bold text-red-300">Error Details:</h2>
                    <p className="mt-2 text-red-100">{this.state.error?.toString() || 'Unknown Error'}</p>
                    {this.state.errorInfo && (
                        <pre className="mt-2 text-xs text-gray-400 overflow-x-auto">
                            {this.state.errorInfo.componentStack}
                        </pre>
                    )}
                </div>
                <div className="mt-6 text-center">
                    <button
                        onClick={this.handleReset}
                        className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 transition-colors"
                    >
                        Hard Reset Application
                    </button>
                </div>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;