import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuthStore, ROLE_REDIRECTS } from '@/stores/authStore';

const Unauthorized = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const redirect = user ? ROLE_REDIRECTS[user.role] : '/login';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-center px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning-bg">
          <Lock className="h-8 w-8 text-warning" />
        </div>
        <h1 className="text-xl font-barlow font-bold uppercase tracking-wide text-foreground">
          Acceso restringido
        </h1>
        <p className="text-sm font-dm text-muted-foreground max-w-xs">
          No tienes permisos para ver esta sección. Contacta a tu administrador si crees que es un error.
        </p>
        <button
          onClick={() => navigate(redirect)}
          className="h-10 rounded-lg bg-gold px-6 font-barlow font-semibold uppercase tracking-wide text-white text-sm transition-colors hover:bg-gold-bright"
        >
          Volver
        </button>
      </div>
    </div>
  );
};

export default Unauthorized;
