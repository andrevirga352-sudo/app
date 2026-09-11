"""Server-side generation of legal acts as PDF/A-style PDF and DOCX."""
import io
from datetime import datetime, timezone
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER, TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors
from docx import Document
from docx.shared import Pt, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH


def _protocol():
    now = datetime.now(timezone.utc)
    return f"JP-{now.strftime('%Y%m%d-%H%M%S')}"


def build_pdf(title: str, subtitle: str, body: str) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=2.2 * cm, bottomMargin=2 * cm,
                            leftMargin=2.4 * cm, rightMargin=2.4 * cm, title=title)
    styles = getSampleStyleSheet()
    h = ParagraphStyle("H", parent=styles["Title"], fontName="Times-Bold", fontSize=15, leading=19, alignment=TA_CENTER)
    sub = ParagraphStyle("S", parent=styles["Normal"], fontName="Times-Roman", fontSize=10, textColor="#475569", alignment=TA_CENTER)
    meta = ParagraphStyle("M", parent=styles["Normal"], fontName="Courier", fontSize=8, textColor="#64748B", alignment=TA_RIGHT)
    p = ParagraphStyle("P", parent=styles["Normal"], fontName="Times-Roman", fontSize=11, leading=16, alignment=TA_JUSTIFY, spaceAfter=8)
    story = [
        Paragraph(f"Protocollo n. {_protocol()} &mdash; {datetime.now(timezone.utc).strftime('%d/%m/%Y')}", meta),
        Spacer(1, 6),
        Paragraph(title, h),
        Spacer(1, 4),
        Paragraph(subtitle, sub),
        Spacer(1, 16),
    ]
    for para in body.split("\n"):
        para = para.strip()
        if para:
            story.append(Paragraph(para.replace("&", "&amp;"), p))
        else:
            story.append(Spacer(1, 6))
    doc.build(story)
    buf.seek(0)
    return buf.read()


def build_docx(title: str, subtitle: str, body: str) -> bytes:
    buf = io.BytesIO()
    document = Document()
    for section in document.sections:
        section.top_margin = Cm(2.2)
        section.bottom_margin = Cm(2)
        section.left_margin = Cm(2.4)
        section.right_margin = Cm(2.4)
    style = document.styles["Normal"]
    style.font.name = "Times New Roman"
    style.font.size = Pt(11)

    meta = document.add_paragraph()
    meta.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r = meta.add_run(f"Protocollo n. {_protocol()} — {datetime.now(timezone.utc).strftime('%d/%m/%Y')}")
    r.font.size = Pt(8)

    ht = document.add_heading(title, level=1)
    ht.alignment = WD_ALIGN_PARAGRAPH.CENTER
    st = document.add_paragraph()
    st.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sr = st.add_run(subtitle)
    sr.italic = True
    sr.font.size = Pt(10)
    document.add_paragraph()

    for para in body.split("\n"):
        para = para.strip()
        if para:
            pp = document.add_paragraph(para)
            pp.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    document.save(buf)
    buf.seek(0)
    return buf.read()


def _fmt_eur(n):
    try:
        return "€ {:,.0f}".format(float(n or 0)).replace(",", ".")
    except Exception:
        return "€ 0"


def build_casefile_pdf(cf: dict) -> bytes:
    """Fascicolo Tecnico Unificato pre-istruito per il legale convenzionato (PDF/A-style)."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm,
                            leftMargin=2.2 * cm, rightMargin=2.2 * cm, title="Fascicolo Tecnico Unificato")
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("H1", parent=styles["Title"], fontName="Times-Bold", fontSize=15, alignment=TA_CENTER)
    sub = ParagraphStyle("Sub", parent=styles["Normal"], fontName="Times-Roman", fontSize=10, textColor="#475569", alignment=TA_CENTER)
    meta = ParagraphStyle("Meta", parent=styles["Normal"], fontName="Courier", fontSize=8, textColor="#64748B", alignment=TA_RIGHT)
    sec = ParagraphStyle("Sec", parent=styles["Heading2"], fontName="Times-Bold", fontSize=12, textColor="#0F2027", spaceBefore=12, spaceAfter=6)
    p = ParagraphStyle("P", parent=styles["Normal"], fontName="Times-Roman", fontSize=10, leading=14, alignment=TA_JUSTIFY, spaceAfter=5)
    small = ParagraphStyle("Sm", parent=styles["Normal"], fontName="Times-Roman", fontSize=8.5, leading=11)

    snap = cf.get("snapshot") or {}
    reports = snap.get("reports") or {}
    synth = snap.get("synthesis") or {}

    def esc(t):
        return str(t or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    def make_table(header, rows, widths):
        data = [header] + rows
        t = Table(data, colWidths=widths, repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F2027")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Times-Bold"),
            ("FONTNAME", (0, 1), (-1, -1), "Times-Roman"),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F1F4F7")]),
            ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        return t

    story = [
        Paragraph(f"Protocollo Fascicolo n. {cf.get('protocol', _protocol())} — {datetime.now(timezone.utc).strftime('%d/%m/%Y')}", meta),
        Spacer(1, 4),
        Paragraph("FASCICOLO TECNICO UNIFICATO", h1),
        Paragraph("Pre-istruttoria documentale a supporto del legale convenzionato — non costituisce parere legale", sub),
        Spacer(1, 12),
    ]

    # 1. Scheda di sintesi
    story.append(Paragraph("1. Scheda di Sintesi", sec))
    story.append(Paragraph(f"<b>Ente richiedente:</b> {esc(cf.get('owner_name'))} ({esc(cf.get('owner_email'))})", p))
    story.append(Paragraph(f"<b>Oggetto:</b> {esc(cf.get('title'))}", p))
    if synth.get("sintesi_esecutiva"):
        story.append(Paragraph(f"<b>Cronistoria e sintesi:</b> {esc(synth.get('sintesi_esecutiva'))}", p))
    rischi = synth.get("rischi_procedurali") or []
    if rischi:
        story.append(Paragraph("Scadenze perentorie e rischi procedurali:", p))
        rows = [[Paragraph(esc(r.get("rischio")), small), esc(r.get("scadenza_giorni")), esc(r.get("gravita"))] for r in rischi[:8]]
        story.append(make_table(["Rischio / termine", "Giorni", "Gravità"], rows, [11 * cm, 2.2 * cm, 2.8 * cm]))

    # 2. Vizi amministrativi e violazioni contrattuali
    story.append(Paragraph("2. Tabella Analitica dei Vizi e delle Violazioni", sec))
    vizi_rows = []
    for v in (reports.get("A1", {}).get("vizi") or [])[:8]:
        vizi_rows.append([Paragraph(esc(v.get("tipo")), small), Paragraph(esc(v.get("norma_violata")), small), esc(v.get("gravita"))])
    for c in (reports.get("A2", {}).get("clausole") or []):
        if str(c.get("stato", "")).lower() == "violata":
            vizi_rows.append([Paragraph("Inadempimento: " + esc(c.get("clausola")), small), Paragraph(esc(c.get("riferimento")), small), "alta"])
    if vizi_rows:
        story.append(make_table(["Vizio / Inadempimento", "Riferimento normativo", "Gravità"], vizi_rows, [7.5 * cm, 6 * cm, 2.5 * cm]))
    else:
        story.append(Paragraph("Nessun vizio strutturato disponibile nello snapshot dell'analisi.", p))

    # 3. Prospetto estimativo del pregiudizio
    story.append(Paragraph("3. Prospetto Estimativo del Pregiudizio Economico (stima equitativa ex art. 1226 c.c.)", sec))
    voci = synth.get("matrice_danno") or [{"voce": x.get("voce"), "importo_eur": x.get("importo_eur")} for x in (reports.get("A4", {}).get("voci") or [])]
    if voci:
        rows = [[Paragraph(esc(x.get("voce")), small), _fmt_eur(x.get("importo_eur"))] for x in voci[:12]]
        rows.append([Paragraph("<b>TOTALE STIMATO</b>", small), _fmt_eur(synth.get("totale_danno_eur") or sum(float(x.get("importo_eur") or 0) for x in voci))])
        story.append(make_table(["Voce di pregiudizio", "Importo stimato"], rows, [12.5 * cm, 3.5 * cm]))
    else:
        story.append(Paragraph("Prospetto estimativo non disponibile.", p))

    # 4. Traccia dell'atto suggerito
    story.append(Paragraph("4. Traccia dell'Atto Suggerito", sec))
    for s in (reports.get("A5", {}).get("strumenti_consigliati") or [])[:5]:
        story.append(Paragraph(f"• <b>{esc(s.get('atto'))}</b> — {esc(s.get('fondamento'))} (tempistica: {esc(s.get('tempistica'))}, priorità: {esc(s.get('priorita'))})", p))
    draft = cf.get("edited_draft") or cf.get("draft") or reports.get("A5", {}).get("bozza_incipit")
    if draft:
        story.append(Spacer(1, 4))
        story.append(Paragraph("Bozza tecnica di auto-compilazione:", p))
        for para in str(draft).split("\n"):
            if para.strip():
                story.append(Paragraph(esc(para), small))

    # 5. Allegati
    story.append(Paragraph("5. Allegati Originali (estratto)", sec))
    allegato = snap.get("case_text") or "Nessun allegato testuale disponibile."
    for para in str(allegato)[:3000].split("\n"):
        if para.strip():
            story.append(Paragraph(esc(para), small))

    story.append(Spacer(1, 14))
    story.append(Paragraph("<i>Documento di pre-istruttoria tecnica generato automaticamente. Non costituisce consulenza legale né atto giudiziario ai sensi della L. 247/2012. Se ne raccomanda il vaglio da parte di un legale abilitato.</i>", small))

    doc.build(story)
    buf.seek(0)
    return buf.read()
