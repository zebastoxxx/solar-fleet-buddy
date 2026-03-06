import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, ROLE_REDIRECTS } from '@/stores/authStore';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import logo from '@/assets/logo.png';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const signIn = useAuthStore((s) => s.signIn);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      const user = useAuthStore.getState().user;
      const redirect = user ? ROLE_REDIRECTS[user.role] : '/dashboard';
      navigate(redirect);
    } catch (err: any) {
      toast.error(err.message || 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-[400px] px-4">
        <div className="rounded-2xl border border-line bg-card p-8 shadow-sm">
          {/* Logo */}
          <div className="flex flex-col items-center gap-1.5 mb-6">
            <img src={logo} alt="Up & Down Solar" className="h-16 w-auto object-contain" />
            <h1 className="text-2xl font-barlow font-bold uppercase tracking-wide text-gold">
              Up & Down Solar
            </h1>
            <p className="text-xs font-dm uppercase tracking-[0.2em] text-muted-foreground">
              Power by God
            </p>
          </div>

          <p className="text-center text-sm font-dm text-mid mb-6">
            Sistema de Gestión Operacional
          </p>

          <div className="h-px bg-line mb-6" />

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-dm font-medium text-foreground mb-1.5">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@empresa.com"
                className="h-11 w-full rounded-lg border border-line bg-background px-4 text-sm font-dm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-dm font-medium text-foreground mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 w-full rounded-lg border border-line bg-background px-4 pr-10 text-sm font-dm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30 transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-lg bg-gold font-barlow font-semibold uppercase tracking-wide text-sm text-white transition-colors hover:bg-gold-bright disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Ingresando...
                </span>
              ) : (
                'Ingresar'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
