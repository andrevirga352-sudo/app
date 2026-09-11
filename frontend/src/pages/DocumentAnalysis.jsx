import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { UploadCloud, FileText, Send, Loader2, Library, ClipboardPaste } from "lucide-react";
import { toast } from "sonner";

export default function DocumentAnalysis() {
  const nav = useNavigate();
  const fileRef = useRef(null);
  const [presets, setPresets] = useState([]);
  const [docs, setDocs] = useState([]);
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [uploading, setUploading] = useState(false);

  const refresh = () => api.get("/documents").then((r) => setDocs(r.data)).catch(() => {});
  useEffect(() => {
    api.get("/documents/presets").then((r) => setPresets(r.data)).catch(() => {});
    refresh();
  }, []);

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", f);
    try {
      const { data } = await api.post("/documents/upload", form, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`"${data.filename}" acquisito (${data.chars} caratteri)`);
      refresh();
    } catch { toast.error("Upload non riuscito"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const savePaste = async () => {
    if (pasteText.trim().length < 20) { toast.error("Testo troppo breve"); return; }
    try {
      const { data } = await api.post("/documents/paste", { title: pasteTitle || "Testo incollato", text: pasteText });
      toast.success("Documento salvato");
      setPasteText(""); setPasteTitle(""); refresh();
    } catch { toast.error("Salvataggio non riuscito"); }
  };

  const toOrchestrator = (title, text) => nav("/app/orchestrator", { state: { title, caseText: text } });

  return (
    <div className="jp-fade-up" data-testid="document-analysis-view">
      <p className="jp-eyebrow text-slate-500">Ingestione Documentale</p>
      <h1 className="text-3xl sm:text-4xl font-serif font-bold text-slate-900 mt-1">Analisi Documentale PA</h1>
      <p className="text-slate-500 mt-2 text-sm">Carica delibere, contratti concessori e note di revoca. PDF, DOCX e testo supportati.</p>

      <div className="grid lg:grid-cols-2 gap-4 mt-6">
        <Card className="p-6 border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <UploadCloud className="w-4 h-4 text-blue-800" />
            <h3 className="text-base font-serif font-semibold text-slate-900">Carica file</h3>
          </div>
          <div data-testid="document-upload-dropzone" onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors">
            {uploading ? <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /> :
              <><UploadCloud className="w-8 h-8 mx-auto text-slate-400" /><p className="text-sm text-slate-500 mt-2">Clicca per selezionare un file<br /><span className="text-xs jp-mono">.pdf · .docx · .txt</span></p></>}
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" hidden onChange={onFile} data-testid="file-input" />
        </Card>

        <Card className="p-6 border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardPaste className="w-4 h-4 text-emerald-700" />
            <h3 className="text-base font-serif font-semibold text-slate-900">Incolla testo</h3>
          </div>
          <Input data-testid="paste-title-input" placeholder="Titolo documento" value={pasteTitle}
            onChange={(e) => setPasteTitle(e.target.value)} className="mb-2" />
          <Textarea data-testid="paste-text-input" placeholder="Incolla il contenuto dell'atto…" value={pasteText}
            onChange={(e) => setPasteText(e.target.value)} className="min-h-[110px] jp-mono text-xs" />
          <Button data-testid="save-paste-button" onClick={savePaste} className="mt-2 bg-slate-900 hover:bg-slate-800 text-white">Salva documento</Button>
        </Card>
      </div>

      <Card className="p-6 border-slate-200 mt-4">
        <div className="flex items-center gap-2 mb-4">
          <Library className="w-4 h-4 text-purple-700" />
          <h3 className="text-base font-serif font-semibold text-slate-900">Fascicolo di prova (atti preimpostati)</h3>
        </div>
        <div className="space-y-2">
          {presets.map((p, i) => (
            <div key={i} className="flex items-center justify-between gap-3 border border-slate-200 rounded-md p-3" data-testid={`preset-doc-${i}`}>
              <div className="flex items-start gap-3 min-w-0">
                <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{p.filename}</p>
                  <p className="text-xs text-slate-500 truncate">{p.preview}</p>
                </div>
              </div>
              <Button data-testid={`analyze-preset-${i}`} size="sm" variant="outline" className="shrink-0"
                onClick={() => toOrchestrator(p.filename, p.text)}>
                <Send className="w-3.5 h-3.5 mr-1.5" /> Analizza
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {docs.length > 0 && (
        <Card className="p-6 border-slate-200 mt-4">
          <h3 className="text-base font-serif font-semibold text-slate-900 mb-4">Documenti caricati</h3>
          <div className="space-y-2">
            {docs.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 border border-slate-200 rounded-md p-3" data-testid={`user-doc-${d.id}`}>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{d.filename}</p>
                  <p className="text-xs text-slate-500 truncate">{d.preview}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="jp-mono text-[10px]">{d.chars} car.</Badge>
                  <Button size="sm" variant="outline" onClick={() => toOrchestrator(d.filename, d.preview)}>
                    <Send className="w-3.5 h-3.5 mr-1.5" /> Analizza
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
