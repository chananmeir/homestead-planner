import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('PlantingCalendar Error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="bg-red-100 rounded-full p-4">
              <AlertTriangle className="w-12 h-12 text-red-600" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-800">
                Oops! Something went wrong
              </h2>
              <p className="text-gray-600 max-w-md">
                The planting calendar encountered an unexpected error. Don't worry, your data is safe.
              </p>
            </div>

            {this.state.error && (
              <details className="mt-4 p-4 bg-gray-50 rounded-lg text-left w-full max-w-2xl">
                <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
                  Technical Details
                </summary>
                <div className="mt-2 text-xs font-mono text-red-600 whitespace-pre-wrap">
                  {this.state.error.toString()}
                  {this.state.errorInfo && (
                    <div className="mt-2 text-gray-600">
                      {this.state.errorInfo.componentStack}
                    </div>
                  )}
                </div>
              </details>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Reload Page
              </button>
            </div>

            <p className="text-sm text-gray-500 mt-4">
              If this problem persists, please contact support with the technical details above.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
