import { useEffect, useState } from "react";
import api from "../lib/api";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  FileText, Network, ShieldAlert, Database, Loader2, TrendingUp, Gavel, Clock,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";

const eur = (n) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);
const gravColor = { alta: "#be123c", media: "#d97706", bassa: "#047857" };

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/dashboard").then((r) => setData(r.data)).catch(() => setData(null));
  }, []);

  if (!data)
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  const stats = [
    { label: "Documenti PA", value: data.total_documents, icon: FileText, testid: "stat-documents" },
    { label: "Analisi Cluster A", value: data.total_runs, icon: Network, testid: "stat-runs" },
    { label: "Rischi attivi", value: (data.risks || []).length, icon: ShieldAlert, testid: "stat-risks" },
    { label: "Dataset JSONL", value: data.dataset_count, icon: Database, testid: "stat-dataset" },
  ];

  const memChart = Object.entries(data.memory_stats?.by_kind || {}).map(([k, v]) => ({ name: k, value: v }));
  const memColors = { document: "#1e3a8a", fewshot: "#047857", reflection: "#7c3aed", negotiation: "#d97706", correction: "#be123c" };

  return (
    <div className="jp-fade-up" data-testid="dashboard-view">
      <p className="jp-eyebrow text-slate-500">Cluster A · Legal & Administrative Justice</p>
      <h1 className="text-3xl sm:text-4xl font-serif font-bold text-slate-900 mt-1">Quadro Generale & Rischio</h1>
      <p className="text-slate-500 mt-2 text-sm">
        {data.last_case ? <>Ultimo caso analizzato: <span className="text-slate-700 font-medium">{data.last_case}</span></> : "Nessuna analisi ancora eseguita — avvia la Console Multi-Agente."}
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} data-testid={s.testid} className="p-5 border-slate-200">
              <Icon className="w-5 h-5 text-slate-400" />
              <p className="text-3xl font-serif font-bold text-slate-900 mt-3">{s.value ?? 0}</p>
              <p className="text-xs text-slate-500 mt-1">{s.label}</p>
            </Card>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <Card className="p-6 border-slate-200 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <h3 className="text-lg font-serif font-semibold text-slate-900">Mappa dei Rischi Procedurali</h3>
          </div>
          {(data.risks || []).length === 0 ? (
            <p className="text-sm text-slate-400 py-6">Nessun rischio rilevato. Esegui un'analisi per popolare lo scadenziario.</p>
          ) : (
            <div className="space-y-2.5">
              {data.risks.map((r, i) => (
                <div key={i} className="flex items-center justify-between border-l-4 pl-3 py-2 bg-slate-50/60 rounded-r"
                  style={{ borderColor: gravColor[r.gravita] || "#64748b" }} data-testid={`risk-row-${i}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{r.rischio}</p>
                    <p className="text-[11px] jp-mono text-slate-500 uppercase">Gravità: {r.gravita}</p>
                  </div>
                  <Badge variant="outline" className="jp-mono text-xs shrink-0 gap-1">
                    <Clock className="w-3 h-3" /> {r.scadenza_giorni ?? "—"} gg
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6 border-slate-200">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-800" />
            <h3 className="text-lg font-serif font-semibold text-slate-900">Danno stimato</h3>
          </div>
          <p className="text-3xl font-serif font-bold text-slate-900 jp-mono">{eur(data.total_damage_eur)}</p>
          <p className="text-xs text-slate-500 mt-1 mb-4">Ultima matrice di quantificazione</p>
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-4 h-4 text-purple-700" />
            <h4 className="text-sm font-semibold text-slate-800">Memoria evolutiva</h4>
          </div>
          {memChart.length === 0 ? (
            <p className="text-xs text-slate-400">Vault vuoto</p>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={memChart} layout="vertical" margin={{ left: 10, right: 10 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: "#64748b" }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {memChart.map((e, i) => <Cell key={i} fill={memColors[e.name] || "#94a3b8"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card className="p-6 border-slate-200 mt-4">
        <div className="flex items-center gap-2 mb-4">
          <Gavel className="w-4 h-4 text-slate-700" />
          <h3 className="text-lg font-serif font-semibold text-slate-900">Quadro di Vulnerabilità della P.A.</h3>
        </div>
        {(data.vulnerabilities || []).length === 0 ? (
          <p className="text-sm text-slate-400">I punti deboli degli atti comunali appariranno dopo l'analisi orchestrata.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {data.vulnerabilities.map((v, i) => (
              <div key={i} className="border border-slate-200 rounded-md p-3" data-testid={`vuln-card-${i}`}>
                <Badge className="jp-mono text-[10px] mb-1.5" style={{ background: gravColor[v.impatto] || "#64748b", color: "white" }}>
                  impatto {v.impatto}
                </Badge>
                <p className="text-sm text-slate-800 font-medium">{v.punto_debole}</p>
                <p className="text-xs text-slate-500 mt-1">{v.atto}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
