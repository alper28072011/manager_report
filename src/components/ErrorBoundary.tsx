import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<any, State> {
  public state: State;

  constructor(props: any) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = "Beklenmeyen bir hata oluştu.";
      let isPermissionError = false;

      try {
        if (this.state.error?.message) {
          const parsedError = JSON.parse(this.state.error.message);
          if (parsedError.error && parsedError.error.includes("Missing or insufficient permissions")) {
            isPermissionError = true;
            errorMessage = "Veritabanına erişim izniniz yok. Lütfen Firebase Console üzerinden Firestore Security Rules (Güvenlik Kuralları) ayarlarınızı güncelleyin.";
          } else {
            errorMessage = parsedError.error || this.state.error.message;
          }
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-rose-100 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Erişim Hatası</h2>
            <p className="text-slate-600 mb-6">{errorMessage}</p>
            {isPermissionError && (
              <div className="text-left bg-slate-50 p-4 rounded-lg text-sm font-mono text-slate-700 overflow-x-auto mb-6">
                <p className="font-semibold mb-2 text-slate-900">Örnek Test Kuralları:</p>
                <code>
                  rules_version = '2';<br/>
                  service cloud.firestore {'{'}<br/>
                  &nbsp;&nbsp;match /databases/{"{database}"}/documents {'{'}<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;match /queries/{"{query}"} {'{'}<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;allow read, write: if true;<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;{'}'}<br/>
                  &nbsp;&nbsp;{'}'}<br/>
                  {'}'}
                </code>
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="bg-rose-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-rose-700 transition-colors"
            >
              Sayfayı Yenile
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
