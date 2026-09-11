import { useEffect, useRef, useState } from "react";
import api from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import {
  MessagesSquare, UploadCloud, Loader2, Info, ScanSearch, ShieldCheck, Copy, FileWarning, Scale,
} from "lucide-react";
import { toast } from "sonner";

export default function Communications() {
  const fileRef = useRef(null);
  const [consent, setConsent] = useState(false);
  const [consentText, setConsentText] = useState("");
  const [list, setList] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const refresh = () => api.get("/communications").then((r) => setList(r.data)).catch(() => {});
  useEffect(() => {
    refresh();
    api.get("/compliance/consent-text").then((r) => setConsentText(r.data.consent)).catch(() => {});
    api.get("/communications/analyses/latest").then((r) => r.data && setAnalysis(r.data)).catch(() => {});
  }, []);

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!consent) { toast.error("Accetta la dichiarazione di conformità privacy per procedere"); if (fileRef.current) fileRef.current.value = ""; return; }
    setUploading(true);
    const form = new FormData();
    form.append("file", f);
    form.append("consent", "true");
    try {
      const { data } = await api.post("/communications/upload", form, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`"${data.filename}": ${data.message_count} messaggi estratti e sanitizzati (GDPR)`);
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Caricamento non riuscito");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const analyze = async () => {
    if (list.length === 0) { toast.error("Carica almeno una comunicazione"); return; }
    setAnalyzing(true);
    try {
      const { data } = await api.post("/communications/analyze", {});
      setAnalysis(data);
      toast.success("Contraddittorio rilevato: prospetto probatorio generato");
    } catch (err) { toast.error(err.response?.data?.detail || "Analisi non riuscita"); }
    finally { setAnalyzing(false); }
  };

  const copyClause = () => {
    navigator.clipboard.writeText(analysis?.clausola_2712 || "");
    toast.success("Clausola ex art. 2712 c.c. copiata");
  };

  return (
    <div className="jp-fade-up" data-testid="communications-view">
      <p className="jp-eyebrow text-slate-500">Agent A6 · Contraddittorio · Cronistoria Probatoria ex art. 2712 c.c.</p>
      <h1 className="text-3xl sm:text-4xl font-serif font-bold text-slate-900 mt-1">Comunicazioni Informali e Interlocuzioni Istituzionali</h1>
      <p className="text-slate-500 mt-2 text-sm">Acquisizione, sanitizzazione GDPR ed estrazione probatoria di chat WhatsApp, email e screenshot con funzionari della P.A.</p>

      <div className="grid lg:grid-cols-2 gap-4 mt-6">
        <Card className="p-6 border-slate-200">
          <div className="flex items-start gap-2 bg-blue-50/60 border border-blue-100 rounded-md p-3 mb-4" data-testid="comm-guide-tooltip">
            <Info className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />
            <p className="text-xs text-slate-600 leading-relaxed">
              Carica l'esportazione chat o gli screenshot rilevanti (accordi verbali, rassicurazioni, sopralluoghi concordati
              con assessori o dirigenti). I dati personali non rilevanti verranno automaticamente mascherati a norma GDPR.
            </p>
          </div>

          <label className="flex items-start gap-3 mb-4 cursor-pointer">
            <Checkbox data-testid="comm-consent-checkbox" checked={consent} onCheckedChange={(v) => setConsent(!!v)} className="mt-0.5" />
            <span className="text-xs text-slate-700 leading-relaxed">
              {consentText || "Dichiaro di essere partecipe diretto della conversazione caricata e di utilizzarla esclusivamente per finalità di tutela giudiziale e stragiudiziale ex art. 24 Costituzione e art. 2712 c.c."}
            </span>
          </label>

          <div data-testid="comm-upload-dropzone" onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${consent ? "border-slate-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30" : "border-slate-200 opacity-50 cursor-not-allowed"}`}>
            {uploading ? <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /> :
              <><UploadCloud className="w-8 h-8 mx-auto text-slate-400" />
                <p className="text-sm text-slate-500 mt-2">Carica chat / screenshot / thread email<br /><span className="text-xs jp-mono">.txt · .pdf · .png · .jpg</span></p></>}
          </div>
          <input ref={fileRef} type="file" accept=".txt,.pdf,.png,.jpg,.jpeg" hidden onChange={onFile} data-testid="comm-file-input" />
        </Card>

        <Card className="p-6 border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-serif font-semibold text-slate-900">Comunicazioni acquisite</h3>
            <Button data-testid="analyze-contradiction-button" size="sm" onClick={analyze} disabled={analyzing || list.length === 0}
              className="bg-slate-900 hover:bg-slate-800 text-white">
              {analyzing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ScanSearch className="w-4 h-4 mr-1.5" />}
              Analizza Contraddittorio
            </Button>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto jp-scroll">
            {list.length === 0 && <p className="text-sm text-slate-400 py-6 text-center">Nessuna comunicazione acquisita.</p>}
            {list.map((c) => (
              <div key={c.id} className="flex items-center justify-between border border-slate-200 rounded-md p-3" data-testid={`comm-item-${c.id}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <MessagesSquare className="w-4 h-4 text-cyan-700 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{c.filename}</p>
                    <p className="text-[11px] jp-mono text-slate-500 uppercase">{c.source_type}</p>
                  </div>
                </div>
                <Badge variant="outline" className="jp-mono text-[10px] shrink-0">{c.message_count} msg</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {analysis && (
        <Card className="p-6 border-slate-200 mt-4 jp-fade-up" data-testid="probative-table">
          <div className="flex items-center gap-2 mb-3">
            <FileWarning className="w-5 h-5 text-rose-600" />
            <h3 className="text-xl font-serif font-semibold text-slate-900">Prospetto Comunicazioni Informali</h3>
          </div>
          {analysis.sintesi && <p className="text-sm text-slate-700 leading-relaxed mb-4">{analysis.sintesi}</p>}

          {(analysis.discrepanze || []).length > 0 && (
            <div className="grid sm:grid-cols-2 gap-2 mb-5">
              {analysis.discrepanze.map((d, i) => (
                <div key={i} className="border-l-4 border-rose-400 bg-rose-50/50 rounded-r px-3 py-2" data-testid={`discrepanza-${i}`}>
                  <p className="text-sm font-medium text-slate-800">{d.tipo}</p>
                  <p className="text-xs text-slate-600">{d.descrizione}</p>
                  {d.norma && <p className="text-[11px] jp-mono text-rose-700 mt-1">{d.norma}</p>}
                </div>
              ))}
            </div>
          )}

          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-900 text-white text-left">
                  <th className="px-3 py-2 font-semibold">Data e Ora</th>
                  <th className="px-3 py-2 font-semibold">Interlocutore / Ruolo</th>
                  <th className="px-3 py-2 font-semibold">Estratto saliente</th>
                  <th className="px-3 py-2 font-semibold">Rilevanza probatoria / vizio</th>
                </tr>
              </thead>
              <tbody>
                {(analysis.prospetto || []).map((r, i) => (
                  <tr key={i} className="border-b border-slate-100 even:bg-slate-50/50" data-testid={`prospetto-row-${i}`}>
                    <td className="px-3 py-2 jp-mono whitespace-nowrap align-top text-slate-600">{r.data_ora}</td>
                    <td className="px-3 py-2 align-top font-medium text-slate-800">{r.interlocutore}</td>
                    <td className="px-3 py-2 align-top text-slate-700">{r.estratto}</td>
                    <td className="px-3 py-2 align-top text-slate-700">{r.rilevanza_vizio}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 bg-slate-50 border border-slate-200 rounded-md p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="jp-eyebrow text-slate-500 flex items-center gap-1.5"><Scale className="w-3.5 h-3.5" /> Clausola di produzione ex art. 2712 c.c.</p>
              <Button data-testid="copy-clause-button" size="sm" variant="ghost" onClick={copyClause} className="h-7">
                <Copy className="w-3.5 h-3.5 mr-1.5" /> Copia
              </Button>
            </div>
            <p className="text-xs text-slate-600 italic leading-relaxed">{analysis.clausola_2712}</p>
          </div>

          <p className="text-xs text-slate-400 mt-4 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Il prospetto confluisce automaticamente nel Fascicolo Tecnico Unificato inviato al legale.
          </p>
        </Card>
      )}
    </div>
  );
}
