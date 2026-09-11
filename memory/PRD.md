# JUS-PATRIMONIUM — PRD

## Problema originale
Piattaforma web collaborativa multi-agente per la tutela legale, valorizzazione strategica e gestione di
patrimoni culturali ed etno-antropologici in contenzioso/partenariato con la Pubblica Amministrazione.
Rete di Cluster Operativi (5 agenti IA verticali ciascuno) con Bus di Orchestrazione Centrale, memoria
evolutiva (Vector RAG + Reflection + dataset JSONL per auto-fine-tuning), connettori LLM.

## Scelte utente
- MVP: **Cluster A (Legal & Administrative Justice)** completo + dashboard + orchestratore.
- Auth: email/password (JWT).
- Export: PDF + DOCX.
- Framework di self-improvement & episodic memory.
- LLM: Emergent Universal Key.

## Architettura
- **Backend** FastAPI + MongoDB (Motor). Moduli: `server.py` (API), `agents.py` (Cluster A + Evaluator + Orchestratore),
  `memory.py` (vector RAG bag-of-words/cosine su MongoDB), `docgen.py` (PDF reportlab / DOCX python-docx).
- **LLM**: emergentintegrations `LlmChat`, modello `openai/gpt-5.4-mini` (scelto per costo/latenza).
  Tutte le chiamate serializzate con `asyncio.Semaphore(1)` (Universal Key = concorrenza 1).
- **Frontend** React (react-router, sonner, recharts, shadcn/ui, Tailwind). Tema istituzionale Swiss/Archival,
  font Cinzel + Inter + JetBrains Mono.

## Cluster A — 5 agenti
- A1 Administrative Auditor · A2 Contractual Breach Specialist · A3 Third-Sector & Subsidy Expert ·
  A4 Damages & Restitution Quantifier · A5 Court & Procedural Drafter · + Evaluator Agent (reflection).

## Implementato (2026-06)
- Auth JWT (cookie httpOnly), registrazione, login, seed admin + demo lawyer. Fix race-condition su `/auth/me`.
- Ruoli: user (ETS), lawyer (portale convenzionati), admin (gestione rete legali).
- Dashboard: stat, mappa rischi procedurali, quadro vulnerabilità PA, danno stimato, grafico memoria.
- Analisi Documentale: upload PDF/DOCX/TXT (estrazione testo), paste, atti preset, fascicolo utente.
- Orchestratore: run asincrono (BackgroundTask) con polling, bus visualizer 5 agenti, log live,
  report per agente, Evaluator batch, sintesi strategica a doppio binario. **Provato E2E con score 92.2.**
- Matrice del Danno: tabella editabile, totale live, salvataggio, export PDF.
- Generatore Atti: diffida/ricorso TAR/memoria/Corte dei Conti/accesso atti/PEC, draft LLM, export PDF+DOCX.
- Vault Memoria: stats, ricerca vettoriale, memorie recenti, preview + download dataset JSONL.

### Modulo Compliance & Rete Avvocati Convenzionati (Human-in-the-Loop) — 2026-06
- Disclaimer: footer globale + dialog "Note Legali" (no consulenza ex L.247/2012 / art.348 c.p.).
- Gate download obbligatorio (checkbox non pre-selezionata) prima di export bozze/stime (Generator, Stima Peritale).
- Terminologia adeguata: Audit Documentale, Stima Peritale del Pregiudizio Economico, Bozze Tecniche & Memorie Partecipative.
- "Richiedi Asseverazione": genera il Fascicolo Tecnico Unificato (PDF/A) con sintesi, tabella vizi/violazioni, prospetto danni, traccia atto, allegati; inviato in-app alla rete.
- Portale Avvocati `/lawyer-portal`: pratiche ricevute, revisione a due colonne, flusso stati (Inviata → In Revisione → Asseverata / Integrazioni → Pronto PEC), tariffario flat €250 + IVA, download fascicolo.
- Admin `/app/rete-legali`: crea/invita legali convenzionati, monitora fascicoli in rete.
- Testato E2E: backend 26/26, frontend tutti i flussi (iteration_2).

## Stato integrazioni
- Universal Key operativa ma **credito esaurito durante i test** (budget $0.40). Necessario top-up per i flussi LLM
  (Orchestratore + Generatore draft). Tutti gli altri flussi funzionano senza LLM.

## Backlog
- P0: Persistenza esiti negoziazione + correzioni utente come memorie (kind negotiation/correction).
- P1: Cluster B (Curatela/Museale) e Cluster C (Strategia/Trasparenza) — 10 agenti aggiuntivi.
- P1: Vero vector DB (Qdrant/ChromaDB) + embeddings; pipeline LoRA/QLoRA reale.
- P2: Scadenziario con notifiche; PDF/A conforme; firma/protocollo digitale.
