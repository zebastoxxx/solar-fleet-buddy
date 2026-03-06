import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--dark))]">
      <div className="w-full max-w-sm px-6">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gold/20">
            <span className="text-2xl font-bold font-barlow text-gold-bright">U&D</span>
          </div>
          <h1 className="text-xl font-barlow font-bold text-gold-bright uppercase tracking-wide">
            Up & Down Solar
          </h1>
          <p className="text-xs font-dm uppercase tracking-[0.2em] text-muted-foreground">
            Power by God
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-danger-bg p-3 text-sm text-danger font-dm">{error}</div>
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="h-11 w-full rounded-lg border border-white/10 bg-white/5 px-4 text-sm text-white font-dm placeholder:text-white/30 focus:border-gold focus:outline-none"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            className="h-11 w-full rounded-lg border border-white/10 bg-white/5 px-4 text-sm text-white font-dm placeholder:text-white/30 focus:border-gold focus:outline-none"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="h-11 w-full rounded-lg bg-gold font-barlow font-semibold uppercase tracking-wide text-white transition-colors hover:bg-gold-bright disabled:opacity-50"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
