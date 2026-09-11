"""Cluster A — Legal & Administrative Justice: 5 vertical AI agents + Evaluator.

Each agent has a dedicated Italian role prompt and returns STRUCTURED JSON.
Agents communicate via the central orchestration bus (see server.py).
LLM calls go through the Emergent Universal Key (Claude Sonnet).
"""
import os
import json
import re
import asyncio
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
MODEL_PROVIDER = "openai"
MODEL_NAME = "gpt-5.4-mini"

# Emergent Universal Key enforces concurrency = 1 -> serialize all LLM calls.
LLM_SEM = asyncio.Semaphore(1)


async def llm_send(chat, text: str):
    async with LLM_SEM:
        return await chat.send_message(UserMessage(text=text))


async def llm_send_message(chat, message: UserMessage):
    async with LLM_SEM:
        return await chat.send_message(message)

JSON_CONTRACT = (
    "\n\nRispondi ESCLUSIVAMENTE con un oggetto JSON valido, senza testo fuori dal JSON, "
    "senza markdown, senza ```. Usa la lingua italiana giuridica formale ma SII CONCISO: "
    "ogni descrizione al massimo 2 frasi. Limita gli array a un massimo di 4 elementi."
)

CLUSTER_A = {
    "A1": {
        "name": "Administrative Auditor",
        "role": "Revisore degli atti amministrativi della P.A.",
        "color": "blue",
        "icon": "FileCheck2",
        "system": (
            "Sei A1 - Administrative Auditor, giurista esperto di diritto amministrativo italiano. "
            "Scansioni delibere di Giunta, determine dirigenziali e note protocollate per rilevare: "
            "vizi di incompetenza, eccesso di potere, carenza/difetto di motivazione (art. 3 L. 241/1990), "
            "sviamento di potere, violazione dell'autotutela (artt. 21-quinquies e 21-nonies L. 241/1990) e "
            "violazioni del D.Lgs. 36/2023. "
            "Per ogni vizio fornisci la norma violata, la gravità e una sintesi motivata." + JSON_CONTRACT +
            '\nSchema: {"vizi":[{"tipo":"","norma_violata":"","descrizione":"","gravita":"alta|media|bassa"}],'
            '"sintesi":"","punteggio_illegittimita":0-100}'
        ),
    },
    "A2": {
        "name": "Contractual Breach Specialist",
        "role": "Specialista inadempimenti contrattuali PPP",
        "color": "amber",
        "icon": "AlertTriangle",
        "system": (
            "Sei A2 - Contractual Breach Specialist. Monitori il rispetto delle clausole dei contratti di "
            "partenariato pubblico-privato: durata, recesso unilaterale, preavvisi (es. semestrale), obblighi di "
            "fornitura locali, clausole arbitrali/di foro. Individui inadempimenti e termini violati." + JSON_CONTRACT +
            '\nSchema: {"clausole":[{"clausola":"","obbligo":"","stato":"rispettata|violata|a rischio","riferimento":""}],'
            '"termini_temporali":[{"descrizione":"","scadenza":"","giorni_residui":0}],"sintesi":""}'
        ),
    },
    "A3": {
        "name": "Third-Sector & Subsidy Expert",
        "role": "Esperto Terzo Settore e co-progettazione",
        "color": "emerald",
        "icon": "Handshake",
        "system": (
            "Sei A3 - Third-Sector & Subsidy Expert. Presidii l'applicazione degli artt. 55-56 del Codice del Terzo "
            "Settore (D.Lgs. 117/2017) su co-progettazione e amministrazione condivisa, e la giurisprudenza della "
            "Corte Costituzionale (Sentenza 131/2020). Valuti la legittimità del rapporto e i profili di sussidiarietà." + JSON_CONTRACT +
            '\nSchema: {"profili":[{"tema":"","norma":"","valutazione":"","opportunita":""}],'
            '"giurisprudenza_rilevante":[{"riferimento":"","principio":""}],"sintesi":""}'
        ),
    },
    "A4": {
        "name": "Damages & Restitution Quantifier",
        "role": "Quantificatore del danno e indennizzo",
        "color": "rose",
        "icon": "Calculator",
        "system": (
            "Sei A4 - Damages & Restitution Quantifier. Quantifichi il danno risarcibile anche senza fatture dirette: "
            "valutazione equitativa del lavoro dei soci (art. 1226 c.c.), valore locativo figurativo di magazzini privati "
            "occupati, lucro cessante da sbigliettamento (quota 75%), indennizzo ex art. 21-quinquies L. 241/1990. "
            "Fornisci importi numerici in euro con criterio di calcolo esplicito." + JSON_CONTRACT +
            '\nSchema: {"voci":[{"voce":"","criterio":"","norma":"","importo_eur":0}],'
            '"totale_eur":0,"note_metodologiche":""}'
        ),
    },
    "A5": {
        "name": "Court & Procedural Drafter",
        "role": "Redattore atti e memorie processuali",
        "color": "purple",
        "icon": "ScrollText",
        "system": (
            "Sei A5 - Court & Procedural Drafter. Redigi bozze formali di: memorie partecipative, diffide ad adempiere "
            "ex art. 1454 c.c., ricorsi giurisdizionali al TAR con istanza cautelare, segnalazioni di danno erariale alla "
            "Corte dei Conti. Indichi lo strumento giuridico ottimale e i punti di forza." + JSON_CONTRACT +
            '\nSchema: {"strumenti_consigliati":[{"atto":"","fondamento":"","tempistica":"","priorita":"alta|media|bassa"}],'
            '"bozza_incipit":"","sintesi":""}'
        ),
    },
}

EVALUATOR_SYSTEM = (
    "Sei l'Evaluator Agent (Supervisore) del sistema JUS-PATRIMONIUM. Valuti la qualità e l'aderenza giuridica "
    "degli output dei 5 agenti operativi del Cluster A. Per ciascun agente assegni un punteggio 0-100 e indichi se "
    "l'output è convalidabile come esempio virtuoso (few-shot)." + JSON_CONTRACT +
    '\nSchema: {"valutazioni":{"A1":{"punteggio":0-100,"convalida_fewshot":true|false,"commento":""},'
    '"A2":{...},"A3":{...},"A4":{...},"A5":{...}},"punteggio_medio":0-100}'
)

ORCHESTRATOR_SYSTEM = (
    "Sei l'Orchestratore Centrale del Cluster A. Unifichi i report dei 5 agenti verticali e generi la sintesi "
    "strategica per il contenzioso/partenariato con la P.A." + JSON_CONTRACT +
    '\nSchema: {"quadro_vulnerabilita_pa":[{"punto_debole":"","atto":"","impatto":"alto|medio|basso"}],'
    '"matrice_danno":[{"voce":"","importo_eur":0}],"totale_danno_eur":0,'
    '"piano_azione_doppio_binario":{"diffida_pec":"","tavolo_conciliazione":"","campagna_informazione":""},'
    '"rischi_procedurali":[{"rischio":"","scadenza_giorni":0,"gravita":"alta|media|bassa"}],'
    '"sintesi_esecutiva":""}'
)


def _extract_json(text: str):
    if not text:
        return {"_raw": ""}
    t = text.strip()
    t = re.sub(r"^```(json)?", "", t).strip()
    t = re.sub(r"```$", "", t).strip()
    try:
        return json.loads(t)
    except Exception:
        m = re.search(r"\{.*\}", t, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                pass
        repaired = _repair_json(t)
        if repaired is not None:
            return repaired
    return {"_raw": text}


def _repair_json(t: str):
    """Best-effort repair of truncated JSON by closing open brackets/strings."""
    start = t.find("{")
    if start == -1:
        return None
    s = t[start:]
    in_str, esc, stack = False, False, []
    for ch in s:
        if esc:
            esc = False
            continue
        if ch == "\\":
            esc = True
            continue
        if ch == '"':
            in_str = not in_str
        elif not in_str:
            if ch in "{[":
                stack.append(ch)
            elif ch in "}]":
                if stack:
                    stack.pop()
    fixed = s.rstrip().rstrip(",")
    if in_str:
        fixed += '"'
    for opener in reversed(stack):
        fixed += "}" if opener == "{" else "]"
    try:
        return json.loads(fixed)
    except Exception:
        return None


async def run_agent(agent_id: str, session_id: str, user_text: str, fewshots=None, max_tokens: int = 2400):
    agent = CLUSTER_A[agent_id]
    system = agent["system"]
    if fewshots:
        examples = "\n\n".join(f"[ESEMPIO VIRTUOSO CONVALIDATO]\n{s['text']}" for s in fewshots)
        system = system + "\n\nApprendi da questi esempi convalidati in passato:\n" + examples
    chat = (
        LlmChat(api_key=EMERGENT_LLM_KEY, session_id=session_id, system_message=system)
        .with_model(MODEL_PROVIDER, MODEL_NAME)
        .with_params(max_tokens=max_tokens)
    )
    resp = await llm_send(chat, user_text)
    return _extract_json(resp)


async def run_evaluator_batch(session_id: str, reports: dict, max_tokens: int = 1400):
    chat = (
        LlmChat(api_key=EMERGENT_LLM_KEY, session_id=session_id, system_message=EVALUATOR_SYSTEM)
        .with_model(MODEL_PROVIDER, MODEL_NAME)
        .with_params(max_tokens=max_tokens)
    )
    names = {k: CLUSTER_A[k]["name"] for k in reports}
    text = ("Valuta i seguenti output degli agenti del Cluster A.\n"
            f"Nomi agenti: {json.dumps(names, ensure_ascii=False)}\n\n"
            f"Output:\n{json.dumps(reports, ensure_ascii=False)[:9000]}")
    resp = await llm_send(chat, text)
    return _extract_json(resp)


async def run_orchestrator_synthesis(session_id: str, agent_reports: dict, case_text: str, max_tokens: int = 2200):
    chat = (
        LlmChat(api_key=EMERGENT_LLM_KEY, session_id=session_id, system_message=ORCHESTRATOR_SYSTEM)
        .with_model(MODEL_PROVIDER, MODEL_NAME)
        .with_params(max_tokens=max_tokens)
    )
    text = (
        "Contesto del caso:\n" + case_text[:4000] +
        "\n\nReport dei 5 agenti (JSON):\n" + json.dumps(agent_reports, ensure_ascii=False)[:8000]
    )
    resp = await llm_send(chat, text)
    return _extract_json(resp)



# ------------------------- A6: Sotto-agente Contraddittorio (comunicazioni informali) -------------------------
CONTRADICTION_AGENT = {
    "id": "A6", "name": "Cross-Examination & Bad-Faith Detector", "color": "cyan", "icon": "MessagesSquare",
    "role": "Rilevamento malafede e lesione del legittimo affidamento",
}

CONTRADICTION_SYSTEM = (
    "Sei A6 - Cross-Examination & Bad-Faith Detector del Cluster A. Confronti cronologicamente le comunicazioni "
    "informali (WhatsApp/email) con i rappresentanti della P.A. e gli atti formali (delibere, note di revoca, determine). "
    "Rilevi discrepanze critiche: (a) rassicurazioni scritte su spazi/date/rinvii seguite da atti di revoca improvvisa "
    "(violazione buona fede e leale collaborazione ex art. 1 L. 241/1990); (b) consapevolezza preventiva dei funzionari "
    "circa stato/mole/natura dei beni (esclusione dell'errore scusabile). Per ogni messaggio rilevante compili una riga "
    "del prospetto probatorio." + JSON_CONTRACT +
    '\nSchema: {"discrepanze":[{"tipo":"","descrizione":"","norma":""}],'
    '"prospetto":[{"data_ora":"","interlocutore":"","estratto":"","rilevanza_vizio":""}],"sintesi":""}'
)

TRANSCRIBE_SYSTEM = (
    "Trascrivi FEDELMENTE il contenuto testuale di questo screenshot di una conversazione (WhatsApp/email/SMS). "
    "Riporta ogni messaggio su una riga nel formato: [data ora] Mittente: testo. "
    "Se data/ora non sono visibili, ometti le parentesi. Non aggiungere commenti: solo la trascrizione."
)

STRUCTURE_SYSTEM = (
    "Estrai i singoli messaggi dal testo di una conversazione (email/chat) e restituiscili strutturati." + JSON_CONTRACT +
    '\nSchema: {"messaggi":[{"data":"","ora":"","mittente":"","ruolo":"","testo":""}]}'
)


async def transcribe_image(session_id: str, image_base64: str, max_tokens: int = 1500) -> str:
    chat = (
        LlmChat(api_key=EMERGENT_LLM_KEY, session_id=session_id, system_message=TRANSCRIBE_SYSTEM)
        .with_model(MODEL_PROVIDER, MODEL_NAME).with_params(max_tokens=max_tokens)
    )
    msg = UserMessage(text="Trascrivi la conversazione nello screenshot.", file_contents=[ImageContent(image_base64=image_base64)])
    return await llm_send_message(chat, msg)


async def structure_messages(session_id: str, raw_text: str, max_tokens: int = 2000):
    chat = (
        LlmChat(api_key=EMERGENT_LLM_KEY, session_id=session_id, system_message=STRUCTURE_SYSTEM)
        .with_model(MODEL_PROVIDER, MODEL_NAME).with_params(max_tokens=max_tokens)
    )
    out = _extract_json(await llm_send(chat, raw_text[:8000]))
    return out.get("messaggi", []) if isinstance(out, dict) else []


async def run_contradiction(session_id: str, messages: list, acts_text: str, max_tokens: int = 2600):
    chat = (
        LlmChat(api_key=EMERGENT_LLM_KEY, session_id=session_id, system_message=CONTRADICTION_SYSTEM)
        .with_model(MODEL_PROVIDER, MODEL_NAME).with_params(max_tokens=max_tokens)
    )
    conv = "\n".join(f"[{m.get('data','')} {m.get('ora','')}] {m.get('mittente','')} ({m.get('ruolo','')}): {m.get('testo','')}" for m in messages)[:6000]
    text = f"ATTI FORMALI DELLA P.A.:\n{(acts_text or 'n.d.')[:4000]}\n\nCOMUNICAZIONI INFORMALI (cronologiche):\n{conv}"
    return _extract_json(await llm_send(chat, text))
