"""Evolutionary long-term memory store (lightweight vector RAG over MongoDB).

Stores every analyzed document, validated reasoning, negotiation outcome and
user correction as a persistent memory. Retrieval uses a dependency-free
bag-of-words TF cosine similarity so it works without external vector servers.
"""
import re
import math
import uuid
from collections import Counter
from datetime import datetime, timezone

_TOKEN_RE = re.compile(r"[a-zàèéìòùA-Z0-9]{3,}", re.IGNORECASE)
_STOP = set("della dello delle degli agli alla alle dei del con per non che una uno gli les des the and are but not you your for this with from".split())


def _tokenize(text: str):
    return [t.lower() for t in _TOKEN_RE.findall(text or "") if t.lower() not in _STOP]


def _vec(text: str):
    return Counter(_tokenize(text))


def _cosine(a: Counter, b: Counter) -> float:
    if not a or not b:
        return 0.0
    common = set(a) & set(b)
    dot = sum(a[t] * b[t] for t in common)
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


class MemoryStore:
    def __init__(self, db):
        self.col = db.memory_vault

    async def add(self, kind: str, text: str, metadata: dict = None, agent_id: str = None, owner: str = None):
        doc = {
            "_id": str(uuid.uuid4()),
            "kind": kind,              # document | reflection | fewshot | negotiation | correction
            "agent_id": agent_id,
            "owner": owner,
            "text": text,
            "tokens": dict(_vec(text)),
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await self.col.insert_one(doc)
        doc.pop("tokens", None)
        return doc

    async def search(self, query: str, kind: str = None, agent_id: str = None, top_k: int = 5):
        q = _vec(query)
        filt = {}
        if kind:
            filt["kind"] = kind
        if agent_id:
            filt["agent_id"] = agent_id
        results = []
        async for m in self.col.find(filt):
            score = _cosine(q, Counter(m.get("tokens", {})))
            results.append((score, m))
        results.sort(key=lambda x: x[0], reverse=True)
        out = []
        for score, m in results[:top_k]:
            m.pop("tokens", None)
            m["score"] = round(score, 4)
            out.append(m)
        return out

    async def fewshots_for(self, agent_id: str, query: str, top_k: int = 2):
        """Return validated reasonings (few-shot examples) for an agent."""
        shots = await self.search(query, kind="fewshot", agent_id=agent_id, top_k=top_k)
        return [s for s in shots if s.get("score", 0) > 0.02]

    async def stats(self):
        pipeline = [{"$group": {"_id": "$kind", "count": {"$sum": 1}}}]
        agg = {row["_id"]: row["count"] async for row in self.col.aggregate(pipeline)}
        total = await self.col.count_documents({})
        return {"total": total, "by_kind": agg}

    async def list_recent(self, limit: int = 50):
        docs = []
        async for m in self.col.find().sort("created_at", -1).limit(limit):
            m.pop("tokens", None)
            docs.append(m)
        return docs
