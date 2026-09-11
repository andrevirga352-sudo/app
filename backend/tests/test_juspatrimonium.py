"""Backend regression tests for JUS-PATRIMONIUM."""
import os
import time
import io
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://patrimonio-agenti.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@juspatrimonium.it"
ADMIN_PASSWORD = "Patrimonio2026!"


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["email"] == ADMIN_EMAIL
    return s


# ---------------- Auth ----------------
class TestAuth:
    def test_root(self):
        r = requests.get(f"{API}/", timeout=15)
        assert r.status_code == 200
        assert "JUS-PATRIMONIUM" in r.json()["message"]

    def test_admin_login(self, admin_session):
        r = admin_session.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_login_bad(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_me_unauth(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 401

    def test_register_and_login(self):
        s = requests.Session()
        email = f"test_user_{int(time.time())}@example.com"
        r = s.post(f"{API}/auth/register", json={"email": email, "password": "Passw0rd!", "name": "TestUser"}, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == email.lower()
        # verify cookie session works
        r2 = s.get(f"{API}/auth/me", timeout=15)
        assert r2.status_code == 200
        assert r2.json()["email"] == email
        # duplicate
        r3 = requests.post(f"{API}/auth/register", json={"email": email, "password": "Passw0rd!"}, timeout=15)
        assert r3.status_code == 400


# ---------------- Documents ----------------
class TestDocuments:
    def test_presets(self, admin_session):
        r = admin_session.get(f"{API}/documents/presets", timeout=15)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list) and len(arr) >= 3
        assert "text" in arr[0]

    def test_paste_and_list(self, admin_session):
        r = admin_session.post(f"{API}/documents/paste",
                               json={"title": "TEST_doc", "text": "Testo di prova per contenzioso PA"}, timeout=15)
        assert r.status_code == 200
        did = r.json()["id"]
        r2 = admin_session.get(f"{API}/documents", timeout=15)
        assert r2.status_code == 200
        assert any(d["id"] == did for d in r2.json())

    def test_upload_txt(self, admin_session):
        files = {"file": ("test.txt", io.BytesIO(b"Contenuto file di test PA"), "text/plain")}
        r = admin_session.post(f"{API}/documents/upload", files=files, timeout=20)
        assert r.status_code == 200
        assert r.json()["chars"] > 0


# ---------------- Agents / Dashboard ----------------
class TestMisc:
    def test_agents_list(self, admin_session):
        r = admin_session.get(f"{API}/agents", timeout=15)
        assert r.status_code == 200
        arr = r.json()
        assert len(arr) == 5
        ids = {a["id"] for a in arr}
        assert ids == {"A1", "A2", "A3", "A4", "A5"}

    def test_dashboard(self, admin_session):
        r = admin_session.get(f"{API}/dashboard", timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in ["total_documents", "total_runs", "completed_runs", "risks", "total_damage_eur",
                  "vulnerabilities", "memory_stats", "dataset_count"]:
            assert k in d


# ---------------- Damage ----------------
class TestDamage:
    def test_template_and_save(self, admin_session):
        r = admin_session.get(f"{API}/damage/template", timeout=15)
        assert r.status_code == 200
        voci = r.json()["voci"]
        assert len(voci) >= 3
        voci[0]["importo_eur"] = 1500.5
        voci[1]["importo_eur"] = 2000
        r2 = admin_session.post(f"{API}/damage/save", json={"voci": voci}, timeout=15)
        assert r2.status_code == 200
        assert abs(r2.json()["totale_eur"] - 3500.5) < 0.01


# ---------------- Generator ----------------
class TestGenerator:
    def test_types(self, admin_session):
        r = admin_session.get(f"{API}/generator/types", timeout=15)
        assert r.status_code == 200
        assert len(r.json()) >= 5

    def test_export_pdf(self, admin_session):
        r = admin_session.post(f"{API}/generator/export",
                               json={"title": "TEST Atto", "subtitle": "sub", "body": "Corpo test.", "format": "pdf"},
                               timeout=30)
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"

    def test_export_docx(self, admin_session):
        r = admin_session.post(f"{API}/generator/export",
                               json={"title": "TEST Atto", "body": "Corpo test.", "format": "docx"},
                               timeout=30)
        assert r.status_code == 200
        assert r.content[:2] == b"PK"

    def test_draft_llm(self, admin_session):
        # LLM call, allow long timeout
        r = admin_session.post(f"{API}/generator/draft",
                               json={"tipo_atto": "diffida", "contesto": "Comune revoca concessione chiostro.",
                                     "destinatario": "Comune di X"},
                               timeout=90)
        assert r.status_code == 200, r.text
        body = r.json().get("body", "")
        assert isinstance(body, str) and len(body) > 50


# ---------------- Vault ----------------
class TestVault:
    def test_stats(self, admin_session):
        r = admin_session.get(f"{API}/vault/stats", timeout=15)
        assert r.status_code == 200

    def test_recent(self, admin_session):
        r = admin_session.get(f"{API}/vault/recent", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_search(self, admin_session):
        r = admin_session.post(f"{API}/vault/search", json={"query": "revoca concessione"}, timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_dataset_preview(self, admin_session):
        r = admin_session.get(f"{API}/vault/dataset/preview", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "count" in d and "samples" in d


# ---------------- Orchestrator (E2E, slow) ----------------
class TestOrchestrator:
    def test_run_full_flow(self, admin_session):
        preset_text = ("COMUNE DI X - Delibera n.42/2024 - Revoca in autotutela della concessione dei locali "
                       "del Chiostro di San Francesco all'APS 'Carretto Siciliano ETS'. Motivazione per relationem, "
                       "senza esplicita ragione di pubblico interesse. Convenzione ex art.151 D.Lgs.42/2004, "
                       "durata 9 anni, recesso 6 mesi. Beni etno-antropologici vincolati.")
        r = admin_session.post(f"{API}/orchestrator/run",
                               json={"case_text": preset_text, "title": "TEST_run"}, timeout=15)
        assert r.status_code == 200, r.text
        job_id = r.json()["job_id"]
        assert r.json()["status"] == "running"

        # poll up to ~200s
        deadline = time.time() + 220
        status = "running"
        job = None
        while time.time() < deadline:
            time.sleep(6)
            rp = admin_session.get(f"{API}/orchestrator/run/{job_id}", timeout=20)
            assert rp.status_code == 200
            job = rp.json()
            status = job.get("status")
            if status in ("completed", "failed"):
                break

        assert status == "completed", f"Orchestrator did not complete: status={status}, error={job.get('error') if job else 'n/a'}"
        assert "synthesis" in job and job["synthesis"]
        assert "reports" in job
        for aid in ["A1", "A2", "A3", "A4", "A5"]:
            assert aid in job["reports"], f"Missing agent {aid} report"
        # bus steps
        types = {s.get("type") for s in job.get("steps", [])}
        assert "agent_done" in types
        assert "completed" in types
