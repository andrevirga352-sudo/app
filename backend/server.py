from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import io
import uuid
import json
import logging
import asyncio
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
import pypdf
from docx import Document as DocxReader
from bson import ObjectId
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List

import agents as ag
from memory import MemoryStore
import docgen

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]
memory = MemoryStore(db)

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"

app = FastAPI(title="JUS-PATRIMONIUM API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("juspatrimonium")


# ------------------------- Auth helpers -------------------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(uid: str, email: str) -> str:
    payload = {"sub": uid, "email": email, "type": "access",
               "exp": datetime.now(timezone.utc) + timedelta(minutes=60)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def create_refresh_token(uid: str) -> str:
    payload = {"sub": uid, "type": "refresh",
               "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=3600, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=604800, path="/")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Non autenticato")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Tipo token non valido")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Utente non trovato")
        user["id"] = str(user["_id"])
        user.pop("_id", None)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token scaduto")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token non valido")


# ------------------------- Models -------------------------
class RegisterInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = "Operatore"


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class CaseInput(BaseModel):
    title: str
    text: str


class RunInput(BaseModel):
    case_text: str
    title: str = "Caso senza titolo"


class DamageInput(BaseModel):
    voci: List[dict] = []


class DraftInput(BaseModel):
    tipo_atto: str
    contesto: str
    destinatario: str = ""


class ExportInput(BaseModel):
    title: str
    subtitle: str = ""
    body: str
    format: str = "pdf"


class MemoryAddInput(BaseModel):
    kind: str
    text: str
    agent_id: Optional[str] = None
    metadata: dict = {}


class SearchInput(BaseModel):
    query: str
    kind: Optional[str] = None


# ------------------------- Auth routes -------------------------
@api.post("/auth/register")
async def register(data: RegisterInput, response: Response):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email già registrata")
    doc = {"email": email, "password_hash": hash_password(data.password), "name": data.name,
           "role": "user", "created_at": datetime.now(timezone.utc).isoformat()}
    res = await db.users.insert_one(doc)
    uid = str(res.inserted_id)
    set_auth_cookies(response, create_access_token(uid, email), create_refresh_token(uid))
    return {"id": uid, "email": email, "name": data.name, "role": "user"}


@api.post("/auth/login")
async def login(data: LoginInput, response: Response):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenziali non valide")
    uid = str(user["_id"])
    set_auth_cookies(response, create_access_token(uid, email), create_refresh_token(uid))
    return {"id": uid, "email": email, "name": user.get("name"), "role": user.get("role", "user")}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@api.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Nessun refresh token")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Tipo token non valido")
        response.set_cookie("access_token", create_access_token(payload["sub"], ""),
                            httponly=True, secure=True, samesite="none", max_age=3600, path="/")
        return {"ok": True}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Refresh token non valido")


# ------------------------- Agents metadata -------------------------
@api.get("/agents")
async def list_agents():
    return [{"id": k, "name": v["name"], "role": v["role"], "color": v["color"], "icon": v["icon"]}
            for k, v in ag.CLUSTER_A.items()]


# ------------------------- Documents -------------------------
def _extract_text(filename: str, content: bytes) -> str:
    name = filename.lower()
    try:
        if name.endswith(".pdf"):
            reader = pypdf.PdfReader(io.BytesIO(content))
            return "\n".join((p.extract_text() or "") for p in reader.pages)
        if name.endswith(".docx"):
            d = DocxReader(io.BytesIO(content))
            return "\n".join(p.text for p in d.paragraphs)
        return content.decode("utf-8", errors="ignore")
    except Exception as e:
        return f"[Estrazione fallita: {e}]"


@api.post("/documents/upload")
async def upload_document(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    content = await file.read()
    text = _extract_text(file.filename, content)
    doc = {"_id": str(uuid.uuid4()), "owner": user["id"], "filename": file.filename,
           "text": text, "chars": len(text), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.documents.insert_one(doc)
    await memory.add("document", text[:5000], metadata={"filename": file.filename}, owner=user["id"])
    return {"id": doc["_id"], "filename": file.filename, "chars": len(text), "preview": text[:600]}


@api.post("/documents/paste")
async def paste_document(data: CaseInput, user: dict = Depends(get_current_user)):
    _id = str(uuid.uuid4())
    doc = {"_id": _id, "owner": user["id"], "filename": data.title,
           "text": data.text, "chars": len(data.text), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.documents.insert_one(doc)
    await memory.add("document", data.text[:5000], metadata={"filename": data.title}, owner=user["id"])
    return {"id": _id, "filename": data.title, "chars": len(data.text), "preview": data.text[:600]}


@api.get("/documents")
async def list_documents(user: dict = Depends(get_current_user)):
    out = []
    async for d in db.documents.find({"owner": user["id"]}).sort("created_at", -1):
        out.append({"id": d["_id"], "filename": d["filename"], "chars": d.get("chars", 0),
                    "preview": (d.get("text") or "")[:300], "created_at": d["created_at"]})
    return out


PRESET_DOCS = [
    {
        "filename": "Delibera Comunale n. 42_2024 - Revoca Concessione Chiostro San Francesco.pdf",
        "text": ("COMUNE DI ______ - DELIBERAZIONE DI GIUNTA N. 42 del 12/03/2024. "
                 "Oggetto: revoca in autotutela della concessione dei locali del Chiostro di San Francesco "
                 "all'Associazione di Promozione Sociale 'Carretto Siciliano ETS'. "
                 "La Giunta, vista la nota del Dirigente prot. 8891, considerato il mutato interesse pubblico, "
                 "DELIBERA la revoca della concessione con preavviso di giorni 30. "
                 "La motivazione richiama per relationem la nota dirigenziale senza esplicitare le ragioni di pubblico interesse. "
                 "Non risulta acquisita perizia dell'Ufficio Tecnico né ricognizione catastale dei beni. "
                 "Il contratto di partenariato prevedeva durata novennale e preavviso semestrale per il recesso.")
    },
    {
        "filename": "Convenzione Partenariato Speciale PSPP art.151 - APS Carretto Siciliano.docx",
        "text": ("CONVENZIONE DI PARTENARIATO SPECIALE PUBBLICO-PRIVATO ex art. 151 c.3 D.Lgs. 42/2004. "
                 "Tra il Comune di ______ e l'APS 'Carretto Siciliano ETS'. Art. 2 Durata: anni nove (9). "
                 "Art. 5 Recesso: ciascuna parte può recedere con preavviso di mesi sei (6) mediante PEC. "
                 "Art. 7 Obblighi dell'Ente: messa a disposizione dei locali del Chiostro e di un magazzino per lo "
                 "stoccaggio dei carretti siciliani e dei cartelloni dei cantastorie. "
                 "Art. 9 Sbigliettamento: proventi ripartiti nella misura del 75% all'APS e 25% al Comune. "
                 "Art. 12 Foro competente: TAR territorialmente competente. Clausola compromissoria esclusa.")
    },
    {
        "filename": "Nota Soprintendenza - Vincolo etno-antropologico carretti.pdf",
        "text": ("SOPRINTENDENZA ABAP - Nota prot. 2231/2023. Oggetto: dichiarazione di interesse etno-antropologico "
                 "ex D.Lgs. 42/2004 dei carretti siciliani e dei cartelloni dei cantastorie della collezione dell'APS. "
                 "Si raccomanda la conservazione in ambienti idonei con controllo microclimatico. "
                 "Lo stoccaggio in depositi non condizionati espone i manufatti lignei e cartacei a rischio di degrado.")
    },
]


@api.get("/documents/presets")
async def list_presets(user: dict = Depends(get_current_user)):
    return [{"filename": p["filename"], "preview": p["text"][:300], "text": p["text"]} for p in PRESET_DOCS]


# ------------------------- Orchestrator (multi-agent bus) -------------------------
async def _run_orchestration(job_id: str, case_text: str, owner: str):
    async def push(step: dict):
        step["ts"] = datetime.now(timezone.utc).isoformat()
        await db.orchestration_jobs.update_one({"_id": job_id}, {"$push": {"steps": step}})

    reports = {}
    try:
        # Wave 1: A1, A2, A3 analyze in parallel (serialized at the LLM boundary by agents.LLM_SEM)
        await push({"type": "bus", "message": "Orchestratore: avvio Cluster A — ingestione documentale completata"})
        wave1 = ["A1", "A2", "A3"]
        for aid in wave1:
            await push({"type": "agent_start", "agent": aid, "name": ag.CLUSTER_A[aid]["name"]})

        async def do_agent(aid):
            shots = await memory.fewshots_for(aid, case_text)
            out = await ag.run_agent(aid, f"{job_id}-{aid}", f"Documento/caso:\n{case_text[:6000]}", fewshots=shots)
            return aid, out, len(shots)

        results = await asyncio.gather(*[do_agent(a) for a in wave1])
        for aid, out, nshots in results:
            reports[aid] = out
            await push({"type": "agent_done", "agent": aid, "name": ag.CLUSTER_A[aid]["name"],
                        "output": out, "fewshots_used": nshots})

        # Wave 2: A4 damages, using A1-A3 context
        await push({"type": "agent_start", "agent": "A4", "name": ag.CLUSTER_A["A4"]["name"]})
        ctx4 = case_text[:3000] + "\n\nReport agenti precedenti:\n" + json.dumps(reports, ensure_ascii=False)[:3500]
        shots4 = await memory.fewshots_for("A4", case_text)
        reports["A4"] = await ag.run_agent("A4", f"{job_id}-A4", ctx4, fewshots=shots4)
        await push({"type": "agent_done", "agent": "A4", "name": ag.CLUSTER_A["A4"]["name"],
                    "output": reports["A4"], "fewshots_used": len(shots4)})

        # Wave 3: A5 drafter, using all context
        await push({"type": "agent_start", "agent": "A5", "name": ag.CLUSTER_A["A5"]["name"]})
        ctx5 = case_text[:2500] + "\n\nReport completo agenti:\n" + json.dumps(reports, ensure_ascii=False)[:4500]
        shots5 = await memory.fewshots_for("A5", case_text)
        reports["A5"] = await ag.run_agent("A5", f"{job_id}-A5", ctx5, fewshots=shots5)
        await push({"type": "agent_done", "agent": "A5", "name": ag.CLUSTER_A["A5"]["name"],
                    "output": reports["A5"], "fewshots_used": len(shots5)})

        # Evaluator (reflection / self-learning) — single batch call
        await push({"type": "bus", "message": "Evaluator Agent: valutazione qualità e aderenza giuridica"})
        ev_batch = await ag.run_evaluator_batch(f"{job_id}-eval", reports)
        evaluations = ev_batch.get("valutazioni", {}) if isinstance(ev_batch, dict) else {}
        for aid in ["A1", "A2", "A3", "A4", "A5"]:
            ev = evaluations.get(aid, {})
            if ev.get("convalida_fewshot"):
                await memory.add("fewshot", json.dumps(reports[aid], ensure_ascii=False)[:2500],
                                 agent_id=aid, owner=owner,
                                 metadata={"punteggio": ev.get("punteggio"), "agent": ag.CLUSTER_A[aid]["name"]})
            await memory.add("reflection", json.dumps({aid: ev}, ensure_ascii=False)[:2000], agent_id=aid, owner=owner)
        await push({"type": "evaluation", "evaluations": evaluations})

        # Central synthesis
        await push({"type": "bus", "message": "Orchestratore Centrale: sintesi strategica a doppio binario"})
        synthesis = await ag.run_orchestrator_synthesis(f"{job_id}-synth", reports, case_text)

        # JSONL training pair logging (auto self-improvement dataset)
        jsonl_line = json.dumps({
            "instruction": "Analizza il caso di contenzioso con la P.A. e genera quadro di vulnerabilità, matrice del danno e piano d'azione.",
            "input": case_text[:3000],
            "output": synthesis,
        }, ensure_ascii=False)
        await db.training_dataset.insert_one({"_id": str(uuid.uuid4()), "owner": owner,
                                              "line": jsonl_line, "created_at": datetime.now(timezone.utc).isoformat()})

        avg_score = round(sum(e.get("punteggio", 0) for e in evaluations.values()) / max(len(evaluations), 1), 1)
        await db.orchestration_jobs.update_one({"_id": job_id}, {"$set": {
            "status": "completed", "reports": reports, "evaluations": evaluations,
            "synthesis": synthesis, "avg_score": avg_score,
            "completed_at": datetime.now(timezone.utc).isoformat()}})
        await push({"type": "completed", "avg_score": avg_score})
    except Exception as e:
        logger.exception("Orchestration failed")
        msg = str(e)
        if "Budget has been exceeded" in msg or "RateLimitError" in msg:
            msg = "Credito Universal Key esaurito. Aggiungi balance da Profilo → Manage plan → Universal Key → Add Balance, poi riprova."
        await db.orchestration_jobs.update_one({"_id": job_id}, {"$set": {"status": "failed", "error": msg}})
        await push({"type": "error", "message": msg})


@api.post("/orchestrator/run")
async def start_run(data: RunInput, background: BackgroundTasks, user: dict = Depends(get_current_user)):
    job_id = str(uuid.uuid4())
    await db.orchestration_jobs.insert_one({
        "_id": job_id, "owner": user["id"], "title": data.title, "case_text": data.case_text,
        "status": "running", "steps": [], "created_at": datetime.now(timezone.utc).isoformat()})
    background.add_task(_run_orchestration, job_id, data.case_text, user["id"])
    return {"job_id": job_id, "status": "running"}


@api.get("/orchestrator/run/{job_id}")
async def get_run(job_id: str, user: dict = Depends(get_current_user)):
    job = await db.orchestration_jobs.find_one({"_id": job_id, "owner": user["id"]})
    if not job:
        raise HTTPException(status_code=404, detail="Run non trovata")
    job.pop("_id", None)
    job["job_id"] = job_id
    return job


@api.get("/orchestrator/history")
async def run_history(user: dict = Depends(get_current_user)):
    out = []
    async for j in db.orchestration_jobs.find({"owner": user["id"]}).sort("created_at", -1).limit(20):
        out.append({"job_id": j["_id"], "title": j.get("title"), "status": j.get("status"),
                    "avg_score": j.get("avg_score"), "created_at": j.get("created_at"),
                    "synthesis": j.get("synthesis")})
    return out


# ------------------------- Dashboard -------------------------
@api.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    total_docs = await db.documents.count_documents({"owner": user["id"]})
    total_runs = await db.orchestration_jobs.count_documents({"owner": user["id"]})
    completed = await db.orchestration_jobs.count_documents({"owner": user["id"], "status": "completed"})
    last = await db.orchestration_jobs.find_one({"owner": user["id"], "status": "completed"}, sort=[("created_at", -1)])
    risks, total_damage, vulnerabilities = [], 0, []
    if last and last.get("synthesis"):
        s = last["synthesis"]
        risks = s.get("rischi_procedurali", [])
        total_damage = s.get("totale_danno_eur", 0)
        vulnerabilities = s.get("quadro_vulnerabilita_pa", [])
    mem_stats = await memory.stats()
    dataset_count = await db.training_dataset.count_documents({"owner": user["id"]})
    return {"total_documents": total_docs, "total_runs": total_runs, "completed_runs": completed,
            "risks": risks, "total_damage_eur": total_damage, "vulnerabilities": vulnerabilities,
            "memory_stats": mem_stats, "dataset_count": dataset_count,
            "last_case": last.get("title") if last else None}


# ------------------------- Damage matrix -------------------------
DEFAULT_DAMAGE = [
    {"voce": "Lavoro materiale soci (valutazione equitativa art. 1226 c.c.)", "criterio": "ore x tariffa figurativa", "norma": "art. 1226 c.c.", "importo_eur": 0},
    {"voce": "Valore locativo figurativo magazzini privati occupati", "criterio": "canone mensile x mesi", "norma": "art. 2041 c.c.", "importo_eur": 0},
    {"voce": "Lucro cessante da sbigliettamento (quota 75%)", "criterio": "incasso medio x quota", "norma": "art. 1223 c.c.", "importo_eur": 0},
    {"voce": "Indennizzo da revoca legittima", "criterio": "danno emergente", "norma": "art. 21-quinquies L. 241/1990", "importo_eur": 0},
    {"voce": "Oneri di custodia bene vincolato", "criterio": "costi conservazione", "norma": "D.Lgs. 42/2004", "importo_eur": 0},
]


@api.get("/damage/template")
async def damage_template(user: dict = Depends(get_current_user)):
    return {"voci": DEFAULT_DAMAGE}


@api.post("/damage/save")
async def damage_save(data: DamageInput, user: dict = Depends(get_current_user)):
    total = sum(float(v.get("importo_eur", 0) or 0) for v in data.voci)
    doc = {"_id": str(uuid.uuid4()), "owner": user["id"], "voci": data.voci, "totale_eur": total,
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.damage_matrices.insert_one(doc)
    return {"id": doc["_id"], "totale_eur": total}


# ------------------------- Document generator -------------------------
ATTI = {
    "diffida": "Diffida ad adempiere ex art. 1454 c.c. (con termine per l'adempimento)",
    "ricorso_tar": "Ricorso al TAR con istanza cautelare (sospensiva) avverso atto di revoca",
    "memoria": "Memoria partecipativa / osservazioni al preavviso di diniego ex art. 10-bis L. 241/1990",
    "corte_conti": "Segnalazione di danno erariale alla Procura Regionale della Corte dei Conti",
    "accesso_atti": "Istanza di accesso agli atti (L. 241/1990) e accesso civico generalizzato (D.Lgs. 33/2013)",
    "pec_messa_mora": "PEC di messa in mora e diffida formale all'Ente inadempiente",
}


@api.get("/generator/types")
async def generator_types(user: dict = Depends(get_current_user)):
    return [{"id": k, "label": v} for k, v in ATTI.items()]


@api.post("/generator/draft")
async def generator_draft(data: DraftInput, user: dict = Depends(get_current_user)):
    label = ATTI.get(data.tipo_atto, data.tipo_atto)
    system = (
        "Sei A5 - Court & Procedural Drafter, redattore di atti giuridici italiani. "
        f"Redigi il testo completo e formale di: {label}. "
        "Usa struttura, formule di rito, riferimenti normativi corretti e linguaggio giuridico professionale. "
        "Restituisci SOLO il corpo del documento in testo semplice (niente JSON, niente markdown), "
        "pronto per protocollazione."
    )
    shots = await memory.fewshots_for("A5", data.contesto)
    if shots:
        system += "\n\nEsempi virtuosi convalidati:\n" + "\n---\n".join(s["text"][:1200] for s in shots)
    from emergentintegrations.llm.chat import LlmChat
    chat = LlmChat(api_key=ag.EMERGENT_LLM_KEY, session_id=f"draft-{uuid.uuid4()}", system_message=system) \
        .with_model(ag.MODEL_PROVIDER, ag.MODEL_NAME).with_params(max_tokens=2500)
    prompt = f"Destinatario: {data.destinatario or 'Amministrazione competente'}\n\nContesto del caso:\n{data.contesto}"
    try:
        body = await ag.llm_send(chat, prompt)
    except Exception as e:
        if "Budget has been exceeded" in str(e) or "RateLimitError" in str(e):
            raise HTTPException(status_code=402, detail="Credito Universal Key esaurito. Aggiungi balance da Profilo → Manage plan → Universal Key → Add Balance.")
        raise HTTPException(status_code=502, detail="Generazione non riuscita. Riprova.")
    doc_id = str(uuid.uuid4())
    await db.generated_docs.insert_one({"_id": doc_id, "owner": user["id"], "tipo": data.tipo_atto,
                                        "label": label, "body": body,
                                        "created_at": datetime.now(timezone.utc).isoformat()})
    return {"id": doc_id, "label": label, "body": body}


@api.post("/generator/export")
async def generator_export(data: ExportInput, user: dict = Depends(get_current_user)):
    if data.format == "docx":
        content = docgen.build_docx(data.title, data.subtitle, data.body)
        media = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ext = "docx"
    else:
        content = docgen.build_pdf(data.title, data.subtitle, data.body)
        media = "application/pdf"
        ext = "pdf"
    fname = "".join(c for c in data.title if c.isalnum() or c in " -_")[:40].strip().replace(" ", "_") or "atto"
    return StreamingResponse(io.BytesIO(content), media_type=media,
                             headers={"Content-Disposition": f'attachment; filename="{fname}.{ext}"'})


# ------------------------- Memory Vault -------------------------
@api.get("/vault/stats")
async def vault_stats(user: dict = Depends(get_current_user)):
    return await memory.stats()


@api.get("/vault/recent")
async def vault_recent(user: dict = Depends(get_current_user)):
    return await memory.list_recent(60)


@api.post("/vault/search")
async def vault_search(data: SearchInput, user: dict = Depends(get_current_user)):
    return await memory.search(data.query, kind=data.kind, top_k=8)


@api.post("/vault/add")
async def vault_add(data: MemoryAddInput, user: dict = Depends(get_current_user)):
    return await memory.add(data.kind, data.text, metadata=data.metadata, agent_id=data.agent_id, owner=user["id"])


@api.get("/vault/dataset")
async def vault_dataset(user: dict = Depends(get_current_user)):
    lines = []
    async for d in db.training_dataset.find({"owner": user["id"]}).sort("created_at", -1).limit(200):
        lines.append(d["line"])
    content = "\n".join(lines)
    return StreamingResponse(io.BytesIO(content.encode("utf-8")), media_type="application/jsonl",
                             headers={"Content-Disposition": 'attachment; filename="training_dataset.jsonl"'})


@api.get("/vault/dataset/preview")
async def vault_dataset_preview(user: dict = Depends(get_current_user)):
    lines = []
    async for d in db.training_dataset.find({"owner": user["id"]}).sort("created_at", -1).limit(10):
        lines.append(json.loads(d["line"]))
    count = await db.training_dataset.count_documents({"owner": user["id"]})
    return {"count": count, "samples": lines}


# ------------------------- Compliance: Case files & Lawyer network -------------------------
STATUS_FLOW = ["inviata", "in_revisione", "asseverata", "integrazioni", "pronto_pec"]
TARIFFA_FLAT = "€ 250,00 + IVA a fascicolo"


class CaseFileCreate(BaseModel):
    draft_body: str = ""
    draft_label: str = ""
    tipo_atto: str = ""
    job_id: Optional[str] = None
    note: str = ""


class CaseFileUpdate(BaseModel):
    status: Optional[str] = None
    edited_draft: Optional[str] = None
    note: Optional[str] = None
    assign_self: bool = False


class LawyerCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = "Avvocato Convenzionato"


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Riservato all'amministratore")
    return user


async def require_lawyer(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") not in ("lawyer", "admin"):
        raise HTTPException(status_code=403, detail="Riservato ai legali convenzionati")
    return user


def _clean(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = doc.pop("_id", None)
    return doc


@api.post("/casefiles")
async def create_casefile(data: CaseFileCreate, user: dict = Depends(get_current_user)):
    if data.job_id:
        job = await db.orchestration_jobs.find_one({"_id": data.job_id, "owner": user["id"]})
    else:
        job = await db.orchestration_jobs.find_one({"owner": user["id"], "status": "completed"}, sort=[("created_at", -1)])
    snapshot = {}
    if job:
        snapshot = {"title": job.get("title"), "case_text": job.get("case_text"),
                    "reports": job.get("reports"), "synthesis": job.get("synthesis"),
                    "avg_score": job.get("avg_score")}
    now = datetime.now(timezone.utc).isoformat()
    title = data.draft_label or (job.get("title") if job else "Fascicolo tecnico")
    cf = {"_id": str(uuid.uuid4()), "owner": user["id"], "owner_name": user.get("name"),
          "owner_email": user.get("email"), "title": title, "tipo_atto": data.tipo_atto,
          "draft": data.draft_body, "edited_draft": "", "note": data.note, "snapshot": snapshot,
          "protocol": f"FTU-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}",
          "status": "inviata", "assigned_lawyer": None, "assigned_lawyer_name": None,
          "tariffa": TARIFFA_FLAT, "history": [{"status": "inviata", "by": user.get("name"), "ts": now}],
          "created_at": now, "updated_at": now}
    await db.casefiles.insert_one(cf)
    return {"id": cf["_id"], "status": "inviata", "protocol": cf["protocol"]}


@api.get("/casefiles")
async def list_casefiles(user: dict = Depends(get_current_user)):
    if user.get("role") in ("lawyer", "admin"):
        q = {}
    else:
        q = {"owner": user["id"]}
    out = []
    async for cf in db.casefiles.find(q).sort("created_at", -1):
        s = cf.get("snapshot") or {}
        out.append({"id": cf["_id"], "title": cf.get("title"), "status": cf.get("status"),
                    "owner_name": cf.get("owner_name"), "owner_email": cf.get("owner_email"),
                    "tipo_atto": cf.get("tipo_atto"), "protocol": cf.get("protocol"),
                    "assigned_lawyer_name": cf.get("assigned_lawyer_name"),
                    "avg_score": s.get("avg_score"), "totale_danno_eur": (s.get("synthesis") or {}).get("totale_danno_eur"),
                    "tariffa": cf.get("tariffa"), "created_at": cf.get("created_at"), "updated_at": cf.get("updated_at")})
    return out


@api.get("/casefiles/{cf_id}")
async def get_casefile(cf_id: str, user: dict = Depends(get_current_user)):
    cf = await db.casefiles.find_one({"_id": cf_id})
    if not cf:
        raise HTTPException(status_code=404, detail="Fascicolo non trovato")
    if user.get("role") not in ("lawyer", "admin") and cf.get("owner") != user["id"]:
        raise HTTPException(status_code=403, detail="Accesso negato")
    return _clean(cf)


@api.patch("/casefiles/{cf_id}")
async def update_casefile(cf_id: str, data: CaseFileUpdate, user: dict = Depends(require_lawyer)):
    cf = await db.casefiles.find_one({"_id": cf_id})
    if not cf:
        raise HTTPException(status_code=404, detail="Fascicolo non trovato")
    now = datetime.now(timezone.utc).isoformat()
    updates = {"updated_at": now}
    if data.assign_self:
        updates["assigned_lawyer"] = user["id"]
        updates["assigned_lawyer_name"] = user.get("name")
        if cf.get("status") == "inviata":
            updates["status"] = "in_revisione"
    if data.status:
        if data.status not in STATUS_FLOW:
            raise HTTPException(status_code=400, detail="Stato non valido")
        updates["status"] = data.status
    if data.edited_draft is not None:
        updates["edited_draft"] = data.edited_draft
    if data.note is not None:
        updates["lawyer_note"] = data.note
    hist = cf.get("history", [])
    hist.append({"status": updates.get("status", cf.get("status")), "by": user.get("name"), "ts": now})
    updates["history"] = hist
    await db.casefiles.update_one({"_id": cf_id}, {"$set": updates})
    cf.update(updates)
    return _clean(cf)


@api.get("/casefiles/{cf_id}/pdf")
async def casefile_pdf(cf_id: str, user: dict = Depends(get_current_user)):
    cf = await db.casefiles.find_one({"_id": cf_id})
    if not cf:
        raise HTTPException(status_code=404, detail="Fascicolo non trovato")
    if user.get("role") not in ("lawyer", "admin") and cf.get("owner") != user["id"]:
        raise HTTPException(status_code=403, detail="Accesso negato")
    content = docgen.build_casefile_pdf(cf)
    fname = (cf.get("protocol") or "fascicolo")
    return StreamingResponse(io.BytesIO(content), media_type="application/pdf",
                             headers={"Content-Disposition": f'attachment; filename="{fname}.pdf"'})


@api.post("/admin/lawyers")
async def create_lawyer(data: LawyerCreate, admin: dict = Depends(require_admin)):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email già registrata")
    await db.users.insert_one({"email": email, "password_hash": hash_password(data.password),
                               "name": data.name, "role": "lawyer",
                               "created_at": datetime.now(timezone.utc).isoformat()})
    return {"email": email, "name": data.name, "role": "lawyer"}


@api.get("/admin/lawyers")
async def list_lawyers(admin: dict = Depends(require_admin)):
    out = []
    async for u in db.users.find({"role": "lawyer"}).sort("created_at", -1):
        cnt = await db.casefiles.count_documents({"assigned_lawyer": str(u["_id"])})
        out.append({"id": str(u["_id"]), "email": u["email"], "name": u.get("name"),
                    "created_at": u.get("created_at"), "pratiche_assegnate": cnt})
    return out


@api.get("/compliance/info")
async def compliance_info(user: dict = Depends(get_current_user)):
    return {"tariffa": TARIFFA_FLAT, "status_flow": STATUS_FLOW}


@api.get("/")
async def root():
    return {"message": "JUS-PATRIMONIUM API attiva", "cluster": "A - Legal & Administrative Justice"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000"), "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_pw = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({"email": admin_email, "password_hash": hash_password(admin_pw),
                                   "name": "Amministratore", "role": "admin",
                                   "created_at": datetime.now(timezone.utc).isoformat()})
        logger.info("Admin seeded: %s", admin_email)
    elif not verify_password(admin_pw, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_pw)}})
    # Seed a demo convenzionato lawyer for the portal
    lawyer_email = "legale@juspatrimonium.it"
    if not await db.users.find_one({"email": lawyer_email}):
        await db.users.insert_one({"email": lawyer_email, "password_hash": hash_password("Legale2026!"),
                                   "name": "Avv. Demo Convenzionato", "role": "lawyer",
                                   "created_at": datetime.now(timezone.utc).isoformat()})
        logger.info("Demo lawyer seeded: %s", lawyer_email)


@app.on_event("shutdown")
async def shutdown():
    client.close()
