import { useEffect, useState } from "react";
import api from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Database, Search, Download, Brain, Sparkles, FileJson, Loader2 } from "lucide-react";
import { toast } from "sonner";

const KIND_STYLE = {
  document: { c: "bg-blue-100 text-blue-800", label: "Documento" },
  fewshot: { c: "bg-emerald-100 text-emerald-800", label: "Few-shot" },
  reflection: { c: "bg-purple-100 text-purple-800", label: "Reflection" },
  negotiation: { c: "bg-amber-100 text-amber-800", label: "Negoziato" },
  correction: { c: "bg-rose-100 text-rose-800", label: "Correzione" },
};

export default function Vault() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [dataset, setDataset] = useState({ count: 0, samples: [] });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);

  const load = () => {
    api.get("/vault/stats").then((r) => setStats(r.data));
    api.get("/vault/recent").then((r) => setRecent(r.data));
    api.get("/vault/dataset/preview").then((r) => setDataset(r.data));
  };
  useEffect(load, []);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const { data } = await api.post("/vault/search", { query });
      setResults(data);
    } catch { toast.error("Ricerca non riuscita"); }
    finally { setSearching(false); }
  };

  const downloadDataset = async () => {
    try {
      const res = await api.get("/vault/dataset", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = "training_dataset.jsonl"; a.click();
      URL.revokeObjectURL(url);
      toast.success("Dataset JSONL scaricato");
    } catch { toast.error("Download non riuscito"); }
  };

  const list = results ?? recent;

  return (
    <div className="jp-fade-up" data-testid="vault-view">
      <p className="jp-eyebrow text-slate-500">Continuous Self-Improvement · Episodic Memory</p>
      <h1 className="text-3xl sm:text-4xl font-serif font-bold text-slate-900 mt-1">Vault Memoria Evolutiva (RAG)</h1>
      <p className="text-slate-500 mt-2 text-sm">Base di conoscenza vettoriale condivisa, reflection loop e pipeline di auto-fine-tuning JSONL.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <Card className="p-5 border-slate-200">
          <Brain className="w-5 h-5 text-purple-700" />
          <p className="text-3xl font-serif font-bold text-slate-900 mt-3" data-testid="vault-total">{stats?.total ?? 0}</p>
          <p className="text-xs text-slate-500 mt-1">Memorie totali</p>
        </Card>
        <Card className="p-5 border-slate-200">
          <Sparkles className="w-5 h-5 text-emerald-700" />
          <p className="text-3xl font-serif font-bold text-slate-900 mt-3">{stats?.by_kind?.fewshot ?? 0}</p>
          <p className="text-xs text-slate-500 mt-1">Few-shot convalidati</p>
        </Card>
        <Card className="p-5 border-slate-200">
          <Database className="w-5 h-5 text-blue-800" />
          <p className="text-3xl font-serif font-bold text-slate-900 mt-3">{stats?.by_kind?.reflection ?? 0}</p>
          <p className="text-xs text-slate-500 mt-1">Reflection logs</p>
        </Card>
        <Card className="p-5 border-slate-200">
          <FileJson className="w-5 h-5 text-amber-600" />
          <p className="text-3xl font-serif font-bold text-slate-900 mt-3">{dataset.count}</p>
          <p className="text-xs text-slate-500 mt-1">Coppie training JSONL</p>
        </Card>
      </div>

      <Card className="p-6 border-slate-200 mt-4">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-slate-600" />
          <h3 className="text-base font-serif font-semibold text-slate-900">Vector Search Tester</h3>
        </div>
        <div className="flex gap-2">
          <Input data-testid="vault-search-input" value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()} placeholder="Es. revoca concessione preavviso semestrale…" />
          <Button data-testid="vault-search-button" onClick={search} disabled={searching} className="bg-slate-900 hover:bg-slate-800 text-white shrink-0">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
          {results && <Button variant="ghost" onClick={() => { setResults(null); setQuery(""); }}>Reset</Button>}
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <Card className="p-6 border-slate-200 lg:col-span-2">
          <h3 className="text-base font-serif font-semibold text-slate-900 mb-4">
            {results ? "Risultati di ricerca semantica" : "Memorie recenti"}
          </h3>
          <div className="space-y-2 max-h-[420px] overflow-y-auto jp-scroll">
            {list.length === 0 && <p className="text-sm text-slate-400">Nessuna memoria. Esegui un'analisi orchestrata per popolare il vault.</p>}
            {list.map((m, i) => {
              const ks = KIND_STYLE[m.kind] || { c: "bg-slate-100 text-slate-700", label: m.kind };
              return (
                <div key={m._id || i} className="border border-slate-200 rounded-md p-3" data-testid={`memory-item-${i}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <Badge className={`jp-mono text-[10px] ${ks.c} border-0`}>{ks.label}{m.agent_id ? ` · ${m.agent_id}` : ""}</Badge>
                    {m.score !== undefined && <span className="jp-mono text-[10px] text-slate-400">sim {m.score}</span>}
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-3 break-words">{m.text}</p>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6 border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <FileJson className="w-4 h-4 text-amber-600" />
            <h3 className="text-base font-serif font-semibold text-slate-900">Dataset Auto-Fine-Tuning</h3>
          </div>
          <p className="text-xs text-slate-500 mb-3">Ogni workflow completato diventa una coppia Instruction-Tuning (JSONL) per LoRA/QLoRA periodico.</p>
          <Button data-testid="download-dataset-button" onClick={downloadDataset} disabled={dataset.count === 0}
            variant="outline" className="w-full mb-4">
            <Download className="w-4 h-4 mr-2" /> Scarica .jsonl ({dataset.count})
          </Button>
          <div className="space-y-2 max-h-64 overflow-y-auto jp-scroll">
            {dataset.samples.map((s, i) => (
              <pre key={i} className="text-[10px] jp-mono text-slate-500 bg-slate-50 rounded p-2 whitespace-pre-wrap break-words border border-slate-100" data-testid={`dataset-sample-${i}`}>
                {JSON.stringify({ instruction: s.instruction, input: (s.input || "").slice(0, 80) + "…" }, null, 1)}
              </pre>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
