import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, ROLE_REDIRECTS } from '@/stores/authStore';
import { Eye, EyeOff, Mail, Lock, Loader2 } from 'lucide-react';
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[hsl(var(--dark))] via-[hsl(var(--dark2))] to-[hsl(var(--dark))] px-4">
      {/* Radial gold overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at top, hsl(var(--gold) / 0.10), transparent 60%), radial-gradient(ellipse at bottom right, hsl(var(--gold) / 0.06), transparent 50%)',
        }}
      />
      {/* Grain noise (subtle) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
        }}
      />

      <div className="relative w-full max-w-[420px]">
        <div
          className="rounded-2xl border border-[hsl(var(--gold)/0.12)] bg-card/85 backdrop-blur-md p-8"
          style={{ boxShadow: '0 20px 60px hsl(var(--gold) / 0.15)' }}
        >
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

          <p className="text-center text-sm font-dm text-muted-foreground mb-6">
            Sistema de Gestión Operacional
          </p>

          <div className="h-px bg-border mb-6" />

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-dm font-medium text-foreground mb-1.5">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@empresa.com"
                  autoComplete="email"
                  className="h-11 w-full rounded-lg border border-border bg-background pl-10 pr-4 text-sm font-dm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none focus:ring-2 focus:ring-[hsl(var(--gold)/0.3)] transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-dm font-medium text-foreground mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="h-11 w-full rounded-lg border border-border bg-background pl-10 pr-10 text-sm font-dm text-foreground placeholder:text-muted-foreground focus:border-gold focus:outline-none focus:ring-2 focus:ring-[hsl(var(--gold)/0.3)] transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-lg bg-gold font-barlow font-semibold uppercase tracking-wide text-sm text-white transition-all hover:bg-gold-bright disabled:opacity-60 shadow-[0_4px_14px_hsl(var(--gold)/0.25)] hover:shadow-[0_6px_20px_hsl(var(--gold)/0.35)]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Ingresando...
                </span>
              ) : (
                'Ingresar'
              )}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-[11px] font-dm text-muted-foreground/60">
          © {new Date().getFullYear()} Up & Down Solar — Power by God
        </p>
      </div>
    </div>
  );
};

export default Login;
