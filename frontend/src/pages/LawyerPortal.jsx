import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { NoteLegaliDialog, Footer } from "../components/Legal";
import {
  Scale, LogOut, Loader2, FileDown, Inbox, ClipboardCheck, Receipt, CheckCircle2, UserCheck, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

const eur = (n) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);
const STATUS_LABEL = {
  inviata: "Inviata", in_revisione: "In Revisione", asseverata: "Pratica Asseverata",
  integrazioni: "Richiesta Integrazioni", pronto_pec: "Atto Pronto per Notifica PEC",
};
const STATUS_COLOR = {
  inviata: "bg-slate-100 text-slate-700", in_revisione: "bg-blue-100 text-blue-800",
  asseverata: "bg-emerald-100 text-emerald-800", integrazioni: "bg-amber-100 text-amber-800",
  pronto_pec: "bg-purple-100 text-purple-800",
};

export default function LawyerPortal() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [list, setList] = useState([]);
  const [sel, setSel] = useState(null);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("inviata");
  const [saving, setSaving] = useState(false);
  const [tariffa, setTariffa] = useState("€ 250,00 + IVA a fascicolo");

  const load = () => api.get("/casefiles").then((r) => setList(r.data)).catch(() => {});
  useEffect(() => {
    load();
    api.get("/compliance/info").then((r) => setTariffa(r.data.tariffa)).catch(() => {});
  }, []);

  const open = async (id) => {
    const { data } = await api.get(`/casefiles/${id}`);
    setSel(data);
    setDraft(data.edited_draft || data.draft || "");
    setStatus(data.status);
  };

  const patch = async (payload, msg) => {
    setSaving(true);
    try {
      const { data } = await api.patch(`/casefiles/${sel.id}`, payload);
      setSel(data); setStatus(data.status);
      toast.success(msg || "Aggiornato");
      load();
    } catch (e) { toast.error("Aggiornamento non riuscito"); }
    finally { setSaving(false); }
  };

  const downloadPdf = async (id) => {
    try {
      const res = await api.get(`/casefiles/${id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = "fascicolo_tecnico.pdf"; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Download non riuscito"); }
  };

  const doLogout = async () => { await logout(); nav("/login"); };

  const snap = sel?.snapshot || {};
  const reports = snap.reports || {};
  const synth = snap.synthesis || {};
  const comm = snap.communications || {};

  return (
    <div className="min-h-screen jp-canvas">
      <header className="bg-[#0F2027] text-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-white/10 flex items-center justify-center"><Scale className="w-5 h-5" /></div>
            <div>
              <p className="font-serif font-bold leading-none">Portale Avvocati Convenzionati</p>
              <p className="jp-eyebrow text-white/40 mt-1">Rete JUS-PATRIMONIUM</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-white/80 hidden sm:block">{user?.name}</span>
            <Button data-testid="lawyer-logout-button" variant="ghost" onClick={doLogout} className="text-white hover:bg-white/10 h-9">
              <LogOut className="w-4 h-4 mr-2" /> Esci
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8">
        {!sel ? (
          <div className="jp-fade-up">
            <p className="jp-eyebrow text-slate-500">Human-in-the-Loop</p>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-slate-900 mt-1">Pratiche Ricevute</h1>
            <p className="text-slate-500 mt-2 text-sm">Fascicoli tecnici pre-istruiti inviati dagli ETS per revisione e asseverazione.</p>
            <div className="mt-6 space-y-2">
              {list.length === 0 && (
                <Card className="p-10 border-slate-200 text-center text-slate-400">
                  <Inbox className="w-8 h-8 mx-auto mb-2" /> Nessuna pratica ricevuta.
                </Card>
              )}
              {list.map((cf) => (
                <Card key={cf.id} data-testid={`casefile-row-${cf.id}`}
                  className="p-4 border-slate-200 flex items-center justify-between gap-4 hover:border-blue-300 cursor-pointer transition-colors"
                  onClick={() => open(cf.id)}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`jp-mono text-[10px] border-0 ${STATUS_COLOR[cf.status]}`}>{STATUS_LABEL[cf.status]}</Badge>
                      <span className="jp-mono text-[10px] text-slate-400">{cf.protocol}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-800 truncate">{cf.title}</p>
                    <p className="text-xs text-slate-500 truncate">{cf.owner_name} · {cf.owner_email} · pregiudizio {eur(cf.totale_danno_eur)}</p>
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0">Apri</Button>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <div className="jp-fade-up">
            <button onClick={() => setSel(null)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4" data-testid="back-to-list">
              <ArrowLeft className="w-4 h-4" /> Torna alle pratiche
            </button>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="jp-eyebrow text-slate-500">{sel.protocol}</p>
                <h1 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900 mt-1">{sel.title}</h1>
                <p className="text-sm text-slate-500 mt-1">Richiedente: {sel.owner_name} ({sel.owner_email})</p>
              </div>
              <Badge className={`jp-mono text-xs border-0 ${STATUS_COLOR[sel.status]}`}>{STATUS_LABEL[sel.status]}</Badge>
            </div>

            <div className="grid lg:grid-cols-2 gap-4 mt-6">
              {/* LEFT: estratto atti */}
              <Card className="p-5 border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <ClipboardCheck className="w-4 h-4 text-blue-800" />
                  <h3 className="text-base font-serif font-semibold text-slate-900">Estratto degli Atti</h3>
                </div>
                {synth.sintesi_esecutiva && <p className="text-xs text-slate-600 leading-relaxed mb-3">{synth.sintesi_esecutiva}</p>}
                <p className="jp-eyebrow text-slate-400 mb-1">Vizi rilevati</p>
                <ul className="text-xs text-slate-700 space-y-1 mb-3 list-disc pl-4">
                  {(reports.A1?.vizi || []).slice(0, 5).map((v, i) => <li key={i}><b>{v.tipo}</b> — {v.norma_violata} ({v.gravita})</li>)}
                  {(reports.A1?.vizi || []).length === 0 && <li className="text-slate-400 list-none">n.d.</li>}
                </ul>
                <p className="jp-eyebrow text-slate-400 mb-1">Prospetto pregiudizio</p>
                <ul className="text-xs text-slate-700 space-y-1 mb-2">
                  {(synth.matrice_danno || []).map((x, i) => <li key={i} className="flex justify-between"><span className="truncate pr-2">{x.voce}</span><span className="jp-mono">{eur(x.importo_eur)}</span></li>)}
                </ul>
                <div className="flex justify-between border-t border-slate-100 pt-2 text-sm font-semibold">
                  <span>Totale stimato</span><span className="jp-mono">{eur(synth.totale_danno_eur)}</span>
                </div>
                {(comm.prospetto || []).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100" data-testid="lawyer-prospetto">
                    <p className="jp-eyebrow text-slate-400 mb-1">Prospetto comunicazioni (art. 2712 c.c.)</p>
                    <ul className="text-xs text-slate-700 space-y-1">
                      {comm.prospetto.slice(0, 4).map((r, i) => (
                        <li key={i}><span className="jp-mono text-slate-500">{r.data_ora}</span> — <b>{r.interlocutore}</b>: {r.rilevanza_vizio}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <details className="mt-3">
                  <summary className="text-xs text-blue-800 cursor-pointer">Allegato originale (estratto)</summary>
                  <pre className="text-[10px] jp-mono text-slate-500 whitespace-pre-wrap break-words mt-2 max-h-40 overflow-y-auto jp-scroll">{(snap.case_text || "").slice(0, 1500)}</pre>
                </details>
              </Card>

              {/* RIGHT: bozza modificabile + azioni */}
              <div className="space-y-4">
                <Card className="p-5 border-slate-200">
                  <h3 className="text-base font-serif font-semibold text-slate-900 mb-3">Bozza in revisione</h3>
                  <Textarea data-testid="lawyer-draft-editor" value={draft} onChange={(e) => setDraft(e.target.value)}
                    className="min-h-[240px] text-xs leading-relaxed" placeholder="Bozza tecnica dell'atto…" />
                  <div className="flex flex-wrap gap-2 mt-3">
                    {!sel.assigned_lawyer && (
                      <Button data-testid="take-charge-button" size="sm" onClick={() => patch({ assign_self: true }, "Pratica presa in carico")}
                        className="bg-slate-900 hover:bg-slate-800 text-white">
                        <UserCheck className="w-4 h-4 mr-1.5" /> Prendi in carico
                      </Button>
                    )}
                    <Button data-testid="save-draft-button" size="sm" variant="outline" disabled={saving}
                      onClick={() => patch({ edited_draft: draft }, "Bozza salvata")}>
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salva bozza"}
                    </Button>
                    <Button data-testid="download-fascicolo-button" size="sm" variant="outline" onClick={() => downloadPdf(sel.id)}>
                      <FileDown className="w-4 h-4 mr-1.5" /> Fascicolo PDF/A
                    </Button>
                  </div>
                </Card>

                <Card className="p-5 border-slate-200">
                  <p className="jp-eyebrow text-slate-500 mb-2">Stato della pratica</p>
                  <div className="flex gap-2">
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger data-testid="status-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k} data-testid={`status-${k}`}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button data-testid="update-status-button" onClick={() => patch({ status, edited_draft: draft }, "Stato aggiornato")}
                      className="bg-blue-800 hover:bg-blue-900 text-white shrink-0">
                      <CheckCircle2 className="w-4 h-4 mr-1.5" /> Applica
                    </Button>
                  </div>
                </Card>

                <Card className="p-5 border-amber-200 bg-amber-50/40" data-testid="tariffa-box">
                  <div className="flex items-center gap-2 mb-1">
                    <Receipt className="w-4 h-4 text-amber-700" />
                    <p className="jp-eyebrow text-amber-700">Tariffario Convenzionato</p>
                  </div>
                  <p className="text-2xl font-serif font-bold text-slate-900 jp-mono">{tariffa}</p>
                  <p className="text-xs text-slate-500 mt-1">Tariffa flat concordata per revisione e asseverazione del fascicolo.</p>
                </Card>
              </div>
            </div>
          </div>
        )}
        <Footer />
      </div>
    </div>
  );
}
