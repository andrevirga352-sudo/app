import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "./ui/dialog";
import { Checkbox } from "./ui/checkbox";
import { Button } from "./ui/button";
import { ShieldCheck, ScrollText } from "lucide-react";

export const DISCLAIMER_SHORT =
  "Software di pre-istruttoria documentale, supporto organizzativo e calcolo estimativo. Non eroga consulenza legale né attività riservata ex L. 247/2012.";

export const GATE_TEXT =
  "Dichiaro di aver compreso che il presente documento è una traccia tecnica generata mediante algoritmi e modelli linguistici a supporto dell'auto-compilazione e non costituisce parere legale né atto giudiziario. Per l'uso formale dinanzi alle autorità si raccomanda il vaglio di un legale abilitato.";

export function NoteLegaliDialog({ children }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg" data-testid="note-legali-dialog">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-blue-800" /> Note Legali e Limitazione di Responsabilità
          </DialogTitle>
        </DialogHeader>
        <div className="text-sm text-slate-600 leading-relaxed space-y-3 max-h-[60vh] overflow-y-auto jp-scroll">
          <p>
            La piattaforma <strong>JUS-PATRIMONIUM</strong> è un <strong>software di pre-istruttoria documentale,
            supporto organizzativo e calcolo estimativo</strong>. Elabora documenti caricati dall'utente producendo
            report tecnici, stime peritali e tracce di auto-compilazione mediante algoritmi e modelli linguistici.
          </p>
          <p>
            La piattaforma <strong>non eroga consulenza legale, pareri giuridici né attività professionale riservata</strong>
            agli avvocati ai sensi della Legge 31 dicembre 2012, n. 247 e non integra in alcun modo l'esercizio della
            professione forense (art. 348 c.p.).
          </p>
          <p>
            Gli output (audit documentali, report di pre-istruttoria tecnica, bozze di memoria partecipativa, stime
            peritali del pregiudizio economico) costituiscono meri strumenti tecnici di ausilio e <strong>non hanno
            valore di atto giudiziario</strong>. Per l'utilizzo formale dinanzi alle autorità si raccomanda il vaglio e
            l'asseverazione di un legale abilitato, eventualmente tramite la Rete Avvocati Convenzionati.
          </p>
          <p className="text-xs text-slate-400">
            L'utente è responsabile della verifica dei dati inseriti e delle valutazioni operate autonomamente.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function LegalGate({ open, onOpenChange, onConfirm, title = "Accettazione obbligatoria" }) {
  const [checked, setChecked] = useState(false);
  useEffect(() => { if (!open) setChecked(false); }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="legal-gate-dialog">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-600" /> {title}
          </DialogTitle>
          <DialogDescription className="text-slate-600 leading-relaxed pt-2">{GATE_TEXT}</DialogDescription>
        </DialogHeader>
        <label className="flex items-start gap-3 mt-2 cursor-pointer">
          <Checkbox data-testid="legal-gate-checkbox" checked={checked} onCheckedChange={(v) => setChecked(!!v)} className="mt-0.5" />
          <span className="text-sm text-slate-700">Ho letto e compreso la presente dichiarazione.</span>
        </label>
        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button data-testid="legal-gate-confirm-button" disabled={!checked}
            className="bg-slate-900 hover:bg-slate-800 text-white"
            onClick={() => { onConfirm?.(); onOpenChange(false); }}>
            Conferma e procedi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Footer() {
  return (
    <footer className="mt-10 border-t border-slate-200 pt-5 pb-8" data-testid="global-footer">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
          <strong className="text-slate-500">JUS-PATRIMONIUM</strong> — {DISCLAIMER_SHORT}
        </p>
        <NoteLegaliDialog>
          <button data-testid="note-legali-link" className="text-xs jp-mono uppercase tracking-wide text-blue-800 hover:underline shrink-0">
            Note Legali e Limitazione di Responsabilità
          </button>
        </NoteLegaliDialog>
      </div>
    </footer>
  );
}
