import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { iconFor, colorFor } from "../lib/agents";
import { Play, Loader2, CheckCircle2, Radio, Sparkles, FileStack, ChevronDown } from "lucide-react";
import { toast } from "sonner";

const eur = (n) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);
const AGENT_ORDER = ["A1", "A2", "A3", "A4", "A5"];

export default function Orchestrator() {
  const loc = useLocation();
  const [agents, setAgents] = useState([]);
  const [presets, setPresets] = useState([]);
  const [title, setTitle] = useState("");
  const [caseText, setCaseText] = useState("");
  const [job, setJob] = useState(null);
  const [running, setRunning] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pollRef = useRef(null);
  const logRef = useRef(null);

  useEffect(() => {
    api.get("/agents").then((r) => setAgents(r.data));
    api.get("/documents/presets").then((r) => setPresets(r.data)).catch(() => {});
    if (loc.state?.caseText) {
      setCaseText(loc.state.caseText);
      setTitle(loc.state.title || "");
    }
    return () => clearInterval(pollRef.current);
  }, [loc.state]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [job]);

  const poll = (jobId) => {
    pollRef.current = setInterval(async () => {
      const { data } = await api.get(`/orchestrator/run/${jobId}`);
      setJob(data);
      if (data.status === "completed" || data.status === "failed") {
        clearInterval(pollRef.current);
        setRunning(false);
        if (data.status === "completed") toast.success(`Analisi completata · punteggio medio ${data.avg_score}/100`);
        else toast.error("Analisi fallita: " + (data.error || ""));
      }
    }, 1500);
  };

  const run = async () => {
    if (caseText.trim().length < 40) { toast.error("Inserisci il testo del caso (min 40 caratteri)"); return; }
    setRunning(true);
    setJob({ status: "running", steps: [] });
    try {
      const { data } = await api.post("/orchestrator/run", { case_text: caseText, title: title || "Caso senza titolo" });
      poll(data.job_id);
    } catch (e) {
      setRunning(false);
      toast.error("Avvio non riuscito");
    }
  };

  const steps = job?.steps || [];
  const agentStatus = (id) => {
    let st = "idle";
    for (const s of steps) {
      if (s.agent === id && s.type === "agent_start") st = "running";
      if (s.agent === id && s.type === "agent_done") st = "done";
    }
    return st;
  };
  const agentOutput = (id) => job?.reports?.[id] || steps.find((s) => s.type === "agent_done" && s.agent === id)?.output;
  const synthesis = job?.synthesis;

  const loadPreset = (p) => { setCaseText(p.text); setTitle(p.filename); setPickerOpen(false); toast.success("Documento caricato nel bus"); };

  return (
    <div className="jp-fade-up" data-testid="orchestrator-view">
      <p className="jp-eyebrow text-slate-500">Bus di Orchestrazione Centrale</p>
      <h1 className="text-3xl sm:text-4xl font-serif font-bold text-slate-900 mt-1">Console Multi-Agente</h1>
      <p className="text-slate-500 mt-2 text-sm">Cinque agenti verticali analizzano il caso in cascata e sintetizzano un piano a doppio binario.</p>

      <Card className="p-5 border-slate-200 mt-6">
        <div className="flex items-center justify-between mb-3">
          <label className="jp-eyebrow text-slate-500">Caso in istruttoria</label>
          <div className="relative">
            <Button data-testid="load-preset-button" variant="outline" size="sm" onClick={() => setPickerOpen((v) => !v)}>
              <FileStack className="w-4 h-4 mr-1.5" /> Carica atto <ChevronDown className="w-3.5 h-3.5 ml-1" />
            </Button>
            {pickerOpen && (
              <div className="absolute right-0 mt-1 w-80 bg-white border border-slate-200 rounded-md shadow-lg z-20 p-1">
                {presets.map((p, i) => (
                  <button key={i} data-testid={`preset-item-${i}`} onClick={() => loadPreset(p)}
                    className="w-full text-left px-3 py-2 rounded hover:bg-slate-50 text-sm text-slate-700">
                    {p.filename}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <Input data-testid="case-title-input" placeholder="Titolo del caso" value={title}
          onChange={(e) => setTitle(e.target.value)} className="mb-3" />
        <Textarea data-testid="case-text-input" placeholder="Incolla qui delibera, contratto o nota di revoca…"
          value={caseText} onChange={(e) => setCaseText(e.target.value)} className="min-h-[120px] jp-mono text-xs" />
        <Button data-testid="cluster-a-run-orchestrator-button" onClick={run} disabled={running}
          className="mt-3 bg-slate-900 hover:bg-slate-800 text-white">
          {running ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Orchestrazione in corso…</> : <><Play className="w-4 h-4 mr-2" /> Avvia Cluster A</>}
        </Button>
      </Card>

      {/* Agent bus */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
        {AGENT_ORDER.map((id) => {
          const meta = agents.find((a) => a.id === id) || { name: id, role: "" };
          const Icon = iconFor(id);
          const c = colorFor(id);
          const st = agentStatus(id);
          return (
            <Card key={id} data-testid={`agent-card-${id}`}
              className={`p-4 border ${st === "done" ? c.border : "border-slate-200"} ${st === "running" ? "jp-pulse" : ""}`}>
              <div className={`w-9 h-9 rounded-md ${c.bg} flex items-center justify-center mb-2`}>
                <Icon className={`w-5 h-5 ${c.text}`} />
              </div>
              <p className="jp-mono text-[10px] text-slate-400">{id}</p>
              <p className="text-sm font-semibold text-slate-800 leading-tight">{meta.name}</p>
              <div className="mt-2 flex items-center gap-1.5 text-[11px]">
                {st === "idle" && <span className="text-slate-400">In attesa</span>}
                {st === "running" && <span className="flex items-center gap-1 text-blue-700"><Radio className="w-3 h-3 animate-pulse" /> Elaborazione</span>}
                {st === "done" && <span className="flex items-center gap-1 text-emerald-700"><CheckCircle2 className="w-3 h-3" /> Completato</span>}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Live log + outputs */}
      {job && (
        <div className="grid lg:grid-cols-2 gap-4 mt-4">
          <Card className="p-5 border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <Radio className="w-4 h-4 text-blue-700" />
              <h3 className="text-base font-serif font-semibold text-slate-900">Log del Bus</h3>
            </div>
            <div ref={logRef} className="space-y-1.5 max-h-72 overflow-y-auto jp-scroll">
              {steps.map((s, i) => (
                <div key={i} className="text-xs jp-mono flex gap-2 jp-fade-up" data-testid={`bus-log-${i}`}>
                  <span className="text-slate-400 shrink-0">{(s.ts || "").slice(11, 19)}</span>
                  <span className="text-slate-700">
                    {s.type === "bus" && s.message}
                    {s.type === "agent_start" && `▶ ${s.name} avviato`}
                    {s.type === "agent_done" && `✓ ${s.name} completato${s.fewshots_used ? ` · ${s.fewshots_used} few-shot` : ""}`}
                    {s.type === "evaluation" && "★ Evaluator: reflection loop eseguito"}
                    {s.type === "completed" && `● Sintesi completata (score ${s.avg_score}/100)`}
                    {s.type === "error" && `✗ Errore: ${s.message}`}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5 border-slate-200">
            <h3 className="text-base font-serif font-semibold text-slate-900 mb-3">Report degli agenti</h3>
            <div className="space-y-2 max-h-72 overflow-y-auto jp-scroll">
              {AGENT_ORDER.map((id) => {
                const out = agentOutput(id);
                if (!out) return null;
                const c = colorFor(id);
                return (
                  <details key={id} className="border border-slate-200 rounded-md" data-testid={`agent-output-${id}`}>
                    <summary className={`cursor-pointer px-3 py-2 text-sm font-medium ${c.text}`}>{id} · {out.sintesi ? out.sintesi.slice(0, 60) : "esito"}</summary>
                    <pre className="text-[11px] jp-mono text-slate-600 p-3 whitespace-pre-wrap break-words border-t border-slate-100">{JSON.stringify(out, null, 2)}</pre>
                  </details>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* Synthesis */}
      {synthesis && (
        <Card className="p-6 border-slate-200 mt-4 jp-fade-up" data-testid="synthesis-panel">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-amber-600" />
            <h3 className="text-xl font-serif font-semibold text-slate-900">Sintesi Strategica dell'Orchestratore</h3>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed mb-5">{synthesis.sintesi_esecutiva}</p>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-rose-50/50 border border-rose-100 rounded-md p-4">
              <p className="jp-eyebrow text-rose-700 mb-2">Diffida PEC</p>
              <p className="text-xs text-slate-700">{synthesis.piano_azione_doppio_binario?.diffida_pec}</p>
            </div>
            <div className="bg-blue-50/50 border border-blue-100 rounded-md p-4">
              <p className="jp-eyebrow text-blue-700 mb-2">Tavolo di Conciliazione</p>
              <p className="text-xs text-slate-700">{synthesis.piano_azione_doppio_binario?.tavolo_conciliazione}</p>
            </div>
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-md p-4">
              <p className="jp-eyebrow text-emerald-700 mb-2">Campagna Informativa</p>
              <p className="text-xs text-slate-700">{synthesis.piano_azione_doppio_binario?.campagna_informazione}</p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="jp-eyebrow text-slate-500">Danno totale stimato</span>
            <span className="text-2xl font-serif font-bold text-slate-900 jp-mono">{eur(synthesis.totale_danno_eur)}</span>
          </div>
        </Card>
      )}
    </div>
  );
}
