"""Ingestione comunicazioni informali: parsing WhatsApp/email + sanitizzazione PII (GDPR)."""
import re
import uuid

CLAUSOLA_2712 = (
    "Le risultanze delle interlocuzioni telematiche sopra riportate sono prodotte ai sensi dell'art. 2712 c.c. "
    "quali riproduzioni informatiche aventi piena efficacia probatoria dell'operato materiale e dell'affidamento "
    "ingenerato dall'Amministrazione."
)

CONSENT_TEXT = (
    "Dichiaro di essere partecipe diretto della conversazione caricata e di utilizzarla esclusivamente per finalità "
    "di tutela giudiziale e stragiudiziale ex art. 24 Costituzione e art. 2712 c.c."
)

# Riconoscimento numeri di telefono privati (con o senza prefisso internazionale).
_PHONE_RE = re.compile(r"(?<!\d)(\+?\d[\d\s().\-]{7,}\d)(?!\d)")
_CF_RE = re.compile(r"\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b", re.IGNORECASE)
_EMAIL_RE = re.compile(r"\b([A-Za-z0-9._%+\-]+)@([A-Za-z0-9.\-]+\.[A-Za-z]{2,})\b")

# Formati export WhatsApp piu' comuni.
_WA_RE = re.compile(
    r"^\[?\s*(\d{1,2}[/.]\d{1,2}[/.]\d{2,4})[,]?\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:[APap][Mm])?\s*\]?\s*[-\u2013]?\s*([^:]{1,60}?):\s?(.*)$"
)


def mask_pii(text: str) -> str:
    """Maschera numeri di telefono, codici fiscali ed email private preservando data/ora/ruolo/contenuto."""
    if not text:
        return ""

    def _mask_phone(m):
        raw = m.group(1)
        digits = re.sub(r"\D", "", raw)
        if len(digits) < 8:  # non e' un numero di telefono
            return raw
        prefix = ""
        if raw.strip().startswith("+"):
            prefix = "+" + digits[:2] + " "
            digits = digits[2:]
        visible = digits[:3]
        return f"{prefix}{visible} *** ****"

    out = _PHONE_RE.sub(_mask_phone, text)
    out = _CF_RE.sub("[COD. FISCALE OSCURATO]", out)
    out = _EMAIL_RE.sub(lambda m: m.group(1)[:2] + "***@" + m.group(2), out)
    return out


def parse_whatsapp(text: str):
    """Ritorna una lista di messaggi strutturati; [] se il testo non e' un export WhatsApp."""
    messages = []
    current = None
    for line in (text or "").splitlines():
        m = _WA_RE.match(line.strip())
        if m:
            if current:
                messages.append(current)
            data, ora, mittente, testo = m.groups()
            current = {"data": data, "ora": ora, "mittente": mittente.strip(), "testo": testo.strip()}
        elif current and line.strip():
            current["testo"] += "\n" + line.strip()
    if current:
        messages.append(current)
    # Scarta righe di sistema tipiche
    cleaned = []
    for msg in messages:
        low = msg["testo"].lower()
        if "crittografia end-to-end" in low or "messaggi e le chiamate sono" in low:
            continue
        cleaned.append(msg)
    return cleaned


def enrich_messages(messages, filename: str):
    """Aggiunge id univoco, riferimento al file sorgente e ruolo istituzionale rilevato."""
    role_kw = ["assessore", "dirigent", "sindaco", "funzionario", "ufficio tecnico", "geom", "arch.",
               "dott", "avv", "segretario", "responsabile", "comune", "soprintend"]
    out = []
    for msg in messages:
        mittente = (msg.get("mittente") or "").strip()
        low = mittente.lower()
        ruolo = msg.get("ruolo") or ""
        if not ruolo:
            for kw in role_kw:
                if kw in low:
                    ruolo = "Rappresentante istituzionale"
                    break
            else:
                ruolo = "Interlocutore"
        out.append({
            "uid": str(uuid.uuid4())[:8],
            "source": filename,
            "data": msg.get("data", ""),
            "ora": msg.get("ora", ""),
            "mittente": mittente,
            "ruolo": ruolo,
            "testo": msg.get("testo", ""),
        })
    return out
