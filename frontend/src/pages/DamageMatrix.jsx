import { useEffect, useState } from "react";
import api from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Calculator, Save, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

const eur = (n) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);

export default function DamageMatrix() {
  const [voci, setVoci] = useState([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.get("/damage/template").then((r) => setVoci(r.data.voci));
  }, []);

  const total = voci.reduce((s, v) => s + (parseFloat(v.importo_eur) || 0), 0);
  const setImporto = (i, val) => setVoci((prev) => prev.map((v, idx) => (idx === i ? { ...v, importo_eur: val } : v)));

  const save = async () => {
    try {
      await api.post("/damage/save", { voci: voci.map((v) => ({ ...v, importo_eur: parseFloat(v.importo_eur) || 0 })) });
      toast.success(`Matrice salvata · totale ${eur(total)}`);
    } catch { toast.error("Salvataggio non riuscito"); }
  };

  const exportPdf = async () => {
    setExporting(true);
    const body = [
      "MATRICE DI QUANTIFICAZIONE DEL DANNO E DELL'INDENNIZZO",
      "",
      ...voci.map((v) => `• ${v.voce}\n  Criterio: ${v.criterio} — Rif.: ${v.norma}\n  Importo: ${eur(parseFloat(v.importo_eur) || 0)}`),
      "",
      `TOTALE COMPLESSIVO: ${eur(total)}`,
    ].join("\n");
    try {
      const res = await api.post("/generator/export",
        { title: "Matrice di Quantificazione del Danno", subtitle: "Danno patrimoniale ed extracontrattuale", body, format: "pdf" },
        { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = "matrice_danno.pdf"; a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF esportato");
    } catch { toast.error("Export non riuscito"); }
    finally { setExporting(false); }
  };

  return (
    <div className="jp-fade-up" data-testid="damage-matrix-view">
      <p className="jp-eyebrow text-slate-500">Agent A4 · Damages Quantifier</p>
      <h1 className="text-3xl sm:text-4xl font-serif font-bold text-slate-900 mt-1">Matrice di Quantificazione del Danno</h1>
      <p className="text-slate-500 mt-2 text-sm">Simulatore tabellare del danno erariale ed extracontrattuale ex artt. 1223, 1226 c.c. e 21-quinquies L. 241/90.</p>

      <Card className="p-0 border-slate-200 mt-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-left">
              <th className="px-4 py-3 font-semibold text-slate-600">Voce di danno</th>
              <th className="px-4 py-3 font-semibold text-slate-600 hidden sm:table-cell">Norma</th>
              <th className="px-4 py-3 font-semibold text-slate-600 text-right">Importo (€)</th>
            </tr>
          </thead>
          <tbody>
            {voci.map((v, i) => (
              <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50" data-testid={`damage-row-${i}`}>
                <td className="px-4 py-3">
                  <p className="text-slate-800 font-medium">{v.voce}</p>
                  <p className="text-xs text-slate-500">{v.criterio}</p>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell"><span className="jp-mono text-xs text-slate-500">{v.norma}</span></td>
                <td className="px-4 py-3 text-right">
                  <Input data-testid={`damage-input-${i}`} type="number" value={v.importo_eur}
                    onChange={(e) => setImporto(i, e.target.value)} className="w-32 ml-auto text-right jp-mono" placeholder="0" />
                </td>
              </tr>
            ))}
            <tr className="bg-slate-900 text-white">
              <td className="px-4 py-3 font-serif font-semibold" colSpan={2}>Totale complessivo</td>
              <td className="px-4 py-3 text-right jp-mono font-bold text-lg" data-testid="damage-total">{eur(total)}</td>
            </tr>
          </tbody>
        </table>
      </Card>

      <div className="flex gap-3 mt-4">
        <Button data-testid="damage-matrix-calculate-btn" onClick={save} className="bg-slate-900 hover:bg-slate-800 text-white">
          <Save className="w-4 h-4 mr-2" /> Salva matrice
        </Button>
        <Button data-testid="export-pdf-action-button" onClick={exportPdf} variant="outline" disabled={exporting}>
          {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />} Esporta PDF
        </Button>
      </div>
    </div>
  );
}
