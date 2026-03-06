import { useNavigate } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';

const NotFound = () => {
  usePageTitle('404');
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-center px-6">
        <span className="text-7xl font-barlow font-bold text-primary">404</span>
        <h1 className="text-xl font-barlow font-bold uppercase tracking-wide text-foreground">
          Página no encontrada
        </h1>
        <p className="text-sm font-dm text-muted-foreground max-w-xs">
          La ruta que buscas no existe en este sistema.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="h-10 rounded-lg bg-primary px-6 font-barlow font-semibold uppercase tracking-wide text-primary-foreground text-sm transition-colors hover:opacity-90"
        >
          ← Volver al inicio
        </button>
      </div>
    </div>
  );
};

export default NotFound;
