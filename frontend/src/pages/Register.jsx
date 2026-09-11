import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth, apiError } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Scale, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(email, password, name || "Operatore");
      toast.success("Registrazione completata");
      nav("/app/dashboard");
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail) || "Registrazione non riuscita");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center jp-canvas p-6">
      <div className="w-full max-w-sm jp-fade-up">
        <div className="flex items-center gap-2 mb-8">
          <Scale className="w-6 h-6 text-slate-900" />
          <span className="font-serif font-bold text-xl">JUS-PATRIMONIUM</span>
        </div>
        <p className="jp-eyebrow text-slate-500">Nuovo operatore</p>
        <h2 className="text-2xl font-serif font-semibold text-slate-900 mt-1 mb-6">Crea il tuo accesso</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome</Label>
            <Input id="name" data-testid="register-name-input" value={name}
              onChange={(e) => setName(e.target.value)} className="mt-1.5" placeholder="Nome e cognome" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" data-testid="register-email-input" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} className="mt-1.5" required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" data-testid="register-password-input" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} className="mt-1.5" required minLength={6} />
          </div>
          <Button data-testid="auth-register-submit-button" type="submit" disabled={loading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Registrati"}
          </Button>
        </form>
        <p className="text-sm text-slate-500 mt-6">
          Hai già un account?{" "}
          <Link to="/login" data-testid="go-to-login-link" className="text-blue-800 font-medium hover:underline">
            Accedi
          </Link>
        </p>
      </div>
    </div>
  );
}
