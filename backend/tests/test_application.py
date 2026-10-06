from uuid import UUID
import json
import pymupdf
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from app.main import app
from app.core.database import async_session_factory
from app.models.models import Job, Document, Message
from app import worker, providers
from app.rag import intent, clean_text

async def chat(client):
    response = await client.post("/api/v1/chats", json={})
    assert response.status_code == 201, response.text
    return response.json()["id"]

def pdf_bytes(text="Backpropagation computes neural network gradients using the chain rule."):
    with pymupdf.open() as pdf:
        page = pdf.new_page()
        page.insert_text((72, 72), text)
        return pdf.tobytes()

async def upload(client, chat_id, text=None):
    response = await client.post(f"/api/v1/chats/{chat_id}/documents", files={"file": ("book.pdf", pdf_bytes(text) if text else pdf_bytes(), "application/pdf")})
    assert response.status_code == 202, response.text
    return response.json()

async def test_auth_session_logout_and_invalid_credentials(client):
    assert (await client.get("/api/v1/chats")).status_code == 401
    assert (await client.post("/api/v1/auth/login", json={"username": "user", "password": "bad"})).status_code == 401
    response = await client.post("/api/v1/auth/login", json={"username": "user", "password": "user"})
    assert "HttpOnly" in response.headers["set-cookie"]
    assert (await client.get("/api/v1/auth/me")).json()["username"] == "user"
    assert (await client.post("/api/v1/auth/logout")).status_code == 204
    assert (await client.get("/api/v1/auth/me")).status_code == 401

async def test_origin_and_login_rate_limit(client):
    assert (await client.post("/api/v1/auth/login", json={"username": "user", "password": "user"}, headers={"Origin": "https://evil.example"})).status_code == 403
    for _ in range(10):
        await client.post("/api/v1/auth/login", json={"username": "user", "password": "bad"})
    assert (await client.post("/api/v1/auth/login", json={"username": "user", "password": "bad"})).status_code == 429

async def test_user_isolation_files_topics_and_jobs(signed):
    cid = await chat(signed)
    doc = await upload(signed, cid)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://localhost:8000") as other:
        await other.post("/api/v1/auth/login", json={"username": "other", "password": "user"})
        for path in [f"chats/{cid}", f"chats/{cid}/messages", f"chats/{cid}/documents", f"chats/{cid}/topic-sets",
                     f"documents/{doc['document_id']}/file", f"jobs/{doc['job_id']}", f"jobs/{doc['job_id']}/events"]:
            assert (await other.get("/api/v1/" + path)).status_code == 404, path
        assert (await other.delete(f"/api/v1/chats/{cid}")).status_code == 404
        assert (await other.get("/api/v1/documents")).json()["items"] == []

async def test_upload_validation_duplicate_and_range(signed):
    cid = await chat(signed)
    assert (await signed.post(f"/api/v1/chats/{cid}/documents", files={"file": ("fake.pdf", b"not pdf")})).status_code == 422
    data = pdf_bytes()
    first = (await signed.post(f"/api/v1/chats/{cid}/documents", files={"file": ("book.pdf", data, "application/pdf")})).json()
    second = (await signed.post(f"/api/v1/chats/{cid}/documents", files={"file": ("book.pdf", data, "application/pdf")})).json()
    assert first["document_id"] == second["document_id"]
    assert second["duplicate"]
    response = await signed.get(f"/api/v1/documents/{first['document_id']}/file", headers={"Range": "bytes=0-9"})
    assert response.status_code == 206
    assert len(response.content) == 10

async def test_greeting_memory_and_idempotency(signed):
    cid, second = await chat(signed), await chat(signed)
    from uuid import uuid4
    body = {"content": "Who are you?", "client_request_id": str(uuid4())}
    response = await signed.post(f"/api/v1/chats/{cid}/messages", json=body)
    assert response.status_code == 202, response.text
    again = await signed.post(f"/api/v1/chats/{cid}/messages", json=body)
    assert response.json() == again.json()
    assert await worker.process_one()
    messages = (await signed.get(f"/api/v1/chats/{cid}/messages")).json()["items"]
    assert len(messages) == 2 and "study assistant" in messages[1]["content"]
    assert (await signed.get(f"/api/v1/chats/{second}/messages")).json()["items"] == []

async def test_no_document_and_quiz(signed):
    cid = await chat(signed)
    for question, expected in [("Explain physics", "Upload a PDF"), ("Generate MCQs", "later update")]:
        await signed.post(f"/api/v1/chats/{cid}/messages", json={"content": question})
        await worker.process_one()
        rows = (await signed.get(f"/api/v1/chats/{cid}/messages")).json()["items"]
        assert expected in rows[-1]["content"]

class Tokenizer:
    def __call__(self, text, **kwargs):
        import re
        return {"offset_mapping": [(m.start(), m.end()) for m in re.finditer(r"\S+", text)]}
    def encode(self, text, **kwargs):
        return list(range(len(text.split()) + 2))

class Encoder:
    tokenizer = Tokenizer()

class Index:
    def __init__(self):
        self.records = {}
        self.last_filter = None
    def upsert(self, ids, embeddings, documents, metadatas):
        for id, doc, meta in zip(ids, documents, metadatas):
            self.records[id] = (doc, meta)
    def matches(self, metadata, where):
        if "$and" in where:
            return all(self.matches(metadata, w) for w in where["$and"])
        return all(metadata.get(k) in v["$in"] if isinstance(v, dict) else metadata.get(k) == v for k, v in where.items())
    def get(self, where, **kwargs):
        return {"ids": [id for id, (_, m) in self.records.items() if self.matches(m, where)]}
    def query(self, where, **kwargs):
        self.last_filter = where
        ids = self.get(where)["ids"]
        return {"ids": [ids], "distances": [[0.1] * len(ids)]}
    def delete(self, where):
        for id in self.get(where)["ids"]:
            del self.records[id]

@pytest.fixture
def local_providers(monkeypatch):
    index = Index()
    monkeypatch.setattr(providers, "encoder", lambda: Encoder())
    monkeypatch.setattr(providers, "embed", lambda texts: [[1.0, 0.0] for _ in texts])
    monkeypatch.setattr(providers, "collection", lambda: index)
    async def generate(*args, **kwargs):
        if kwargs.get("structured"):
            yield json.dumps({"topics": [{"t": "Chain rule", "d": "Computes gradients.", "r": "Core definition in the excerpt.", "s": [0]}]})
        else:
            yield "Backpropagation uses the chain rule. [S1]"
    async def complete(*args, **kwargs):
        return json.dumps({"topics": [{"title": "Chain rule", "description": "Computes gradients.", "importance_reason": "Core definition in the excerpt.", "source_indices": [0]}]})
    monkeypatch.setattr(providers, "generate", generate)
    monkeypatch.setattr(providers, "complete", complete)
    return index

async def index_all():
    for _ in range(6):
        if not await worker.process_one():
            break

async def test_index_rag_citations_topics_and_delete(signed, local_providers):
    cid, other = await chat(signed), await chat(signed)
    doc = await upload(signed, cid)
    await upload(signed, other, "Quantum physics is not a neural network.")
    await index_all()
    docs = (await signed.get(f"/api/v1/chats/{cid}/documents")).json()["items"]
    assert docs[0]["status"] == "ready"
    response = await signed.post(f"/api/v1/chats/{cid}/messages", json={"content": "Explain backpropagation"})
    await worker.process_one()
    messages = (await signed.get(f"/api/v1/chats/{cid}/messages")).json()["items"]
    assert messages[-1]["status"] == "complete", messages
    assert messages[-1]["sources"][0]["document_id"] == doc["document_id"]
    assert {"chat_id": cid} in local_providers.last_filter["$and"]
    events = await signed.get(f"/api/v1/jobs/{response.json()['job_id']}/events")
    assert "event: snapshot" in events.text
    response = await signed.post(f"/api/v1/chats/{cid}/topic-sets", json={"document_ids": [doc["document_id"]]})
    assert response.status_code == 202, response.text
    await index_all()
    topics = (await signed.get(f"/api/v1/chats/{cid}/topic-sets")).json()["items"]
    assert topics[0]["status"] == "complete" and topics[0]["topics"][0]["title"] == "Chain rule"
    assert (await signed.delete(f"/api/v1/documents/{doc['document_id']}")).status_code == 202
    assert (await signed.get(f"/api/v1/documents/{doc['document_id']}/file")).status_code == 404
    await index_all()
    assert all(m["document_id"] != doc["document_id"] for _, m in local_providers.records.values())
    sources = (await signed.get(f"/api/v1/chats/{cid}/messages")).json()["items"][-1]["sources"]
    assert sources[0]["document_id"] is None and sources[0]["excerpt"] == ""

async def test_invalid_scope_and_cancellation(signed, local_providers):
    cid, other = await chat(signed), await chat(signed)
    doc = await upload(signed, other)
    await index_all()
    assert (await signed.post(f"/api/v1/chats/{cid}/messages", json={"content": "Explain", "document_ids": [doc["document_id"]]})).status_code == 422
    response = await signed.post(f"/api/v1/chats/{cid}/messages", json={"content": "Hello"})
    jid = response.json()["job_id"]
    await signed.post(f"/api/v1/jobs/{jid}/cancel")
    await worker.process_one()
    assert (await signed.get(f"/api/v1/jobs/{jid}")).json()["status"] == "cancelled"

def test_intent_and_cleaning():
    assert intent("Hi, explain photosynthesis") == "document"
    assert intent("How are you?") == "greeting"
    assert clean_text("back-\npropagation   computes\n\n\ngradients") == "backpropagation computes\n\ngradients"

def test_chunk_limits_and_source_offsets():
    from app.rag import chunks
    text = " ".join(f"word{i}" for i in range(700))
    pieces = list(chunks(text, Tokenizer()))
    assert len(pieces) > 3
    assert all(p["token_count"] <= 256 and text[p["start_offset"]:p["end_offset"]] == p["text"] for p in pieces)
    assert pieces[-1]["end_offset"] == len(text)
