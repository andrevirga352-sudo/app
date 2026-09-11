import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth, apiError } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Scale, Loader2 } from "lucide-react";
import { toast } from "sonner";

const HERO = "https://images.unsplash.com/photo-1589994965851-a8f479c573a9?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@juspatrimonium.it");
  const [password, setPassword] = useState("Patrimonio2026!");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await login(email, password);
      toast.success("Accesso effettuato");
      nav(u.role === "lawyer" ? "/lawyer-portal" : "/app/dashboard");
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail) || "Accesso non riuscito");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 jp-canvas">
      <div className="hidden lg:block relative">
        <img src={HERO} alt="Giustizia" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, rgba(15,32,39,0.88), rgba(30,58,138,0.55))" }} />
        <div className="relative z-10 h-full flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <Scale className="w-7 h-7" />
            <span className="jp-eyebrow text-white/80">Cluster A · Legal Justice</span>
          </div>
          <div>
            <h1 className="text-4xl font-serif font-bold leading-tight">JUS&#8209;PATRIMONIUM</h1>
            <p className="mt-4 text-white/85 max-w-md text-base leading-relaxed">
              Piattaforma multi-agente per la tutela legale e la valorizzazione strategica del patrimonio
              culturale ed etno-antropologico in contenzioso con la Pubblica Amministrazione.
            </p>
          </div>
          <p className="jp-mono text-xs text-white/60">Bus di Orchestrazione · Memoria Evolutiva RAG · Reflection Loop</p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm jp-fade-up">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <Scale className="w-6 h-6 text-slate-900" />
            <span className="font-serif font-bold text-xl">JUS-PATRIMONIUM</span>
          </div>
          <p className="jp-eyebrow text-slate-500">Accesso riservato</p>
          <h2 className="text-2xl font-serif font-semibold text-slate-900 mt-1 mb-6">Entra nella console</h2>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" data-testid="login-email-input" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)} className="mt-1.5" required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" data-testid="login-password-input" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} className="mt-1.5" required />
            </div>
            <Button data-testid="auth-login-submit-button" type="submit" disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Accedi"}
            </Button>
          </form>
          <p className="text-sm text-slate-500 mt-6">
            Non hai un account?{" "}
            <Link to="/register" data-testid="go-to-register-link" className="text-blue-800 font-medium hover:underline">
              Registrati
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
