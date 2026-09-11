"""Server-side generation of legal acts as PDF/A-style PDF and DOCX."""
import io
from datetime import datetime, timezone
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER, TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
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
