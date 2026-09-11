import { useEffect, useState } from "react";
import api from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { FileSignature, Wand2, FileDown, FileType, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Generator() {
  const [types, setTypes] = useState([]);
  const [tipo, setTipo] = useState("");
  const [destinatario, setDestinatario] = useState("");
  const [contesto, setContesto] = useState("");
  const [body, setBody] = useState("");
  const [label, setLabel] = useState("");
  const [gen, setGen] = useState(false);
  const [exp, setExp] = useState(false);

  useEffect(() => {
    api.get("/generator/types").then((r) => { setTypes(r.data); if (r.data[0]) setTipo(r.data[0].id); });
    api.get("/orchestrator/history").then((r) => {
      const done = (r.data || []).find((j) => j.status === "completed" && j.synthesis);
      if (done) setContesto(done.synthesis.sintesi_esecutiva || "");
    }).catch(() => {});
  }, []);

  const draft = async () => {
    if (contesto.trim().length < 20) { toast.error("Descrivi il contesto del caso"); return; }
    setGen(true); setBody("");
    try {
      const { data } = await api.post("/generator/draft", { tipo_atto: tipo, contesto, destinatario });
      setBody(data.body); setLabel(data.label);
      toast.success("Bozza generata da Agent A5");
    } catch { toast.error("Generazione non riuscita"); }
    finally { setGen(false); }
  };

  const doExport = async (format) => {
    if (!body) { toast.error("Genera prima la bozza"); return; }
    setExp(true);
    try {
      const res = await api.post("/generator/export",
        { title: label || "Atto giuridico", subtitle: "JUS-PATRIMONIUM · Cluster A", body, format },
        { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = `atto.${format}`; a.click();
      URL.revokeObjectURL(url);
      toast.success(`Esportato in ${format.toUpperCase()}`);
    } catch { toast.error("Export non riuscito"); }
    finally { setExp(false); }
  };

  return (
    <div className="jp-fade-up" data-testid="generator-view">
      <p className="jp-eyebrow text-slate-500">Agent A5 · Procedural Drafter</p>
      <h1 className="text-3xl sm:text-4xl font-serif font-bold text-slate-900 mt-1">Generatore Atti & PEC</h1>
      <p className="text-slate-500 mt-2 text-sm">Diffide ex art. 1454 c.c., ricorsi TAR, memorie ex art. 10-bis, segnalazioni Corte dei Conti. Export PDF/A e DOCX.</p>

      <div className="grid lg:grid-cols-5 gap-4 mt-6">
        <Card className="p-5 border-slate-200 lg:col-span-2">
          <label className="jp-eyebrow text-slate-500 block mb-1.5">Tipo di atto</label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger data-testid="atto-type-select" className="mb-3"><SelectValue placeholder="Seleziona…" /></SelectTrigger>
            <SelectContent>
              {types.map((t) => <SelectItem key={t.id} value={t.id} data-testid={`atto-type-${t.id}`}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <label className="jp-eyebrow text-slate-500 block mb-1.5">Destinatario</label>
          <Input data-testid="destinatario-input" value={destinatario} onChange={(e) => setDestinatario(e.target.value)}
            placeholder="Es. Comune di ___ — Dirigente Settore Cultura" className="mb-3" />
          <label className="jp-eyebrow text-slate-500 block mb-1.5">Contesto del caso</label>
          <Textarea data-testid="contesto-input" value={contesto} onChange={(e) => setContesto(e.target.value)}
            placeholder="Descrivi i fatti, l'atto contestato e le richieste…" className="min-h-[140px] text-xs" />
          <Button data-testid="generate-draft-button" onClick={draft} disabled={gen} className="mt-3 w-full bg-slate-900 hover:bg-slate-800 text-white">
            {gen ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Redazione in corso…</> : <><Wand2 className="w-4 h-4 mr-2" /> Genera bozza</>}
          </Button>
        </Card>

        <Card className="p-5 border-slate-200 lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileSignature className="w-4 h-4 text-purple-700" />
              <h3 className="text-base font-serif font-semibold text-slate-900">Bozza dell'atto</h3>
            </div>
            <div className="flex gap-2">
              <Button data-testid="export-pdf-action-button" size="sm" variant="outline" onClick={() => doExport("pdf")} disabled={exp || !body}>
                <FileDown className="w-3.5 h-3.5 mr-1.5" /> PDF
              </Button>
              <Button data-testid="export-docx-action-button" size="sm" variant="outline" onClick={() => doExport("docx")} disabled={exp || !body}>
                <FileType className="w-3.5 h-3.5 mr-1.5" /> DOCX
              </Button>
            </div>
          </div>
          {gen ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mb-2" /><p className="text-sm">Agent A5 sta redigendo l'atto…</p>
            </div>
          ) : (
            <Textarea data-testid="draft-body" value={body} onChange={(e) => setBody(e.target.value)}
              placeholder="La bozza generata apparirà qui e sarà modificabile prima dell'export." className="min-h-[420px] text-xs leading-relaxed" />
          )}
        </Card>
      </div>
    </div>
  );
}
