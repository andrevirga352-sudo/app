import { useEffect, useState } from "react";
import api, { apiError } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { UserPlus, Scale, Loader2, Users, FolderOpen } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABEL = {
  inviata: "Inviata", in_revisione: "In Revisione", asseverata: "Asseverata",
  integrazioni: "Integrazioni", pronto_pec: "Pronto PEC",
};

export default function AdminLawyers() {
  const [lawyers, setLawyers] = useState([]);
  const [cases, setCases] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const load = () => {
    api.get("/admin/lawyers").then((r) => setLawyers(r.data)).catch(() => {});
    api.get("/casefiles").then((r) => setCases(r.data)).catch(() => {});
  };
  useEffect(load, []);

  const create = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/admin/lawyers", { name: name || "Avvocato Convenzionato", email, password });
      toast.success("Avvocato convenzionato creato");
      setName(""); setEmail(""); setPassword(""); load();
    } catch (err) { toast.error(apiError(err.response?.data?.detail) || "Creazione non riuscita"); }
    finally { setLoading(false); }
  };

  return (
    <div className="jp-fade-up" data-testid="admin-lawyers-view">
      <p className="jp-eyebrow text-slate-500">Amministrazione · Human-in-the-Loop</p>
      <h1 className="text-3xl sm:text-4xl font-serif font-bold text-slate-900 mt-1">Rete Avvocati Convenzionati</h1>
      <p className="text-slate-500 mt-2 text-sm">Invita i legali abilitati e monitora i fascicoli tecnici inviati per asseverazione.</p>

      <div className="grid lg:grid-cols-3 gap-4 mt-6">
        <Card className="p-6 border-slate-200">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="w-4 h-4 text-blue-800" />
            <h3 className="text-base font-serif font-semibold text-slate-900">Invita un legale</h3>
          </div>
          <form onSubmit={create} className="space-y-3">
            <Input data-testid="lawyer-name-input" placeholder="Nome e cognome" value={name} onChange={(e) => setName(e.target.value)} />
            <Input data-testid="lawyer-email-input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input data-testid="lawyer-password-input" type="password" placeholder="Password provvisoria" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            <Button data-testid="create-lawyer-button" type="submit" disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800 text-white">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crea accesso convenzionato"}
            </Button>
          </form>
        </Card>

        <Card className="p-6 border-slate-200 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-emerald-700" />
            <h3 className="text-base font-serif font-semibold text-slate-900">Legali convenzionati ({lawyers.length})</h3>
          </div>
          <div className="space-y-2">
            {lawyers.length === 0 && <p className="text-sm text-slate-400">Nessun legale convenzionato.</p>}
            {lawyers.map((l) => (
              <div key={l.id} className="flex items-center justify-between border border-slate-200 rounded-md p-3" data-testid={`lawyer-row-${l.id}`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs"><Scale className="w-4 h-4" /></div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{l.name}</p>
                    <p className="text-xs text-slate-500">{l.email}</p>
                  </div>
                </div>
                <Badge variant="outline" className="jp-mono text-[10px]">{l.pratiche_assegnate} pratiche</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-6 border-slate-200 mt-4">
        <div className="flex items-center gap-2 mb-4">
          <FolderOpen className="w-4 h-4 text-purple-700" />
          <h3 className="text-base font-serif font-semibold text-slate-900">Fascicoli nella rete ({cases.length})</h3>
        </div>
        <div className="space-y-2">
          {cases.length === 0 && <p className="text-sm text-slate-400">Nessun fascicolo inviato.</p>}
          {cases.map((c) => (
            <div key={c.id} className="flex items-center justify-between border border-slate-200 rounded-md p-3" data-testid={`network-case-${c.id}`}>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{c.title}</p>
                <p className="text-xs text-slate-500 truncate">{c.owner_name} · {c.assigned_lawyer_name || "non assegnato"}</p>
              </div>
              <Badge variant="outline" className="jp-mono text-[10px] shrink-0">{STATUS_LABEL[c.status] || c.status}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
