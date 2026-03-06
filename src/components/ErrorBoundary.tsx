import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props { children: ReactNode; moduleName: string }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error(`[${this.props.moduleName}] Error:`, error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-[400px] items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <span className="text-5xl">⚠️</span>
          <h2 className="text-lg font-barlow font-bold uppercase tracking-wide text-foreground">
            Algo salió mal en {this.props.moduleName}
          </h2>
          <p className="text-sm font-dm text-muted-foreground">
            Ocurrió un error inesperado. Intenta recargar la página o contacta soporte.
          </p>
          <div className="flex gap-3">
            <Button onClick={() => this.setState({ hasError: false })}>🔄 Reintentar</Button>
            <Button variant="outline" onClick={() => window.location.reload()}>Recargar página</Button>
          </div>
          {import.meta.env.DEV && this.state.error && (
            <details className="mt-4 w-full text-left">
              <summary className="cursor-pointer text-xs text-muted-foreground">Detalle del error (dev)</summary>
              <pre className="mt-2 overflow-auto rounded-lg bg-muted p-3 text-xs">{this.state.error.stack}</pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
