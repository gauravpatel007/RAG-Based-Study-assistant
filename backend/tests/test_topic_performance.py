import json
from types import SimpleNamespace
from uuid import UUID

import pytest
from sqlalchemy import select

from app import providers, worker
from app.core.database import async_session_factory
from app.models.models import Document, DocumentChunk, Job, TopicSet
from app.topic_generation import prepare_batch, parse_topics
from test_application import chat, upload, index_all, local_providers  # noqa: F401


def test_small_range_is_one_bounded_request():
    rows = [SimpleNamespace(text=f"Heading {i}: A short explanation of the subject.") for i in range(8)]
    batch, prompt, schema, tokens = prepare_batch(rows, 0, 4, 4096)
    assert len(batch) == 8
    assert schema["properties"]["topics"]["maxItems"] == 4
    assert len(json.dumps(prompt).encode()) + tokens + 256 <= 4096


@pytest.mark.parametrize("indices", [[-1], [8], [True], [], "0"])
def test_invalid_citations_are_rejected(indices):
    with pytest.raises(RuntimeError, match="INVALID_TOPIC_OUTPUT"):
        parse_topics(json.dumps({"topics": [{"t": "Topic", "d": "Definition", "r": "Reason", "s": indices}]}), 2, 4)


async def test_progress_before_inference_and_single_pass_completion(signed, local_providers, monkeypatch):
    cid = await chat(signed)
    doc = await upload(signed, cid)
    await index_all()
    response = await signed.post(f"/api/v1/chats/{cid}/topic-sets", json={"document_ids": [doc["document_id"]], "count": 4})
    tid, jid = response.json()["topic_set_id"], UUID(response.json()["job_id"])
    pending = (await signed.get(f"/api/v1/topic-sets/{tid}")).json()
    assert pending["covered_pages"] == {"processed": 0, "total": 1}
    assert pending["job_status"] == "pending"
    calls = []

    async def generate(*args, **kwargs):
        calls.append(kwargs)
        async with async_session_factory() as db:
            item, job = await db.get(TopicSet, UUID(tid)), await db.get(Job, jid)
            assert item.covered_pages == {"processed": 0, "total": 1}
            assert job.progress["stage"] == "preparing_model"
        yield '{"topics":['
        async with async_session_factory() as db:
            job = await db.get(Job, jid)
            assert job.progress["stage"] == "generating_topics"
            assert job.progress["generated_chars"] > 0
        yield '{"t":"Chain rule","d":"Computes gradients.","r":"Core concept.","s":[0]}]}'

    monkeypatch.setattr(providers, "generate", generate)
    await worker.process_one()
    completed = (await signed.get(f"/api/v1/topic-sets/{tid}")).json()
    assert completed["status"] == completed["job_status"] == "complete"
    assert completed["covered_pages"] == {"processed": 1, "total": 1}
    assert len(calls) == 1
    cached = await signed.post(f"/api/v1/chats/{cid}/topic-sets", json={"document_ids": [doc["document_id"]], "count": 4})
    assert cached.json() == response.json()


async def test_long_chunks_complete_without_reindexing(signed, local_providers, monkeypatch):
    cid = await chat(signed)
    doc = await upload(signed, cid)
    await index_all()
    async with async_session_factory() as db:
        document = await db.get(Document, UUID(doc["document_id"]))
        chunk = await db.scalar(select(DocumentChunk).where(DocumentChunk.document_id == document.id))
        chunk.text = "A long textbook excerpt. " * 65
        for page in range(2, 22):
            db.add(DocumentChunk(document_id=document.id, index_version=document.active_index_version,
                chunk_index=page * 10000, page_number=page, text=f"Page {page}. " + "Another long excerpt. " * 65,
                start_offset=0, end_offset=1400, token_count=200, vector_id=f"extra-{page}"))
        document.page_count = 21
        await db.commit()
    def forbidden(*args, **kwargs):
        raise AssertionError("Topics must reuse stored upload text")
    for name in ["embed", "encoder", "collection"]:
        monkeypatch.setattr(providers, name, forbidden)
    monkeypatch.setattr(worker, "extract_page", forbidden)
    calls = []
    async def generate(prompt, **kwargs):
        calls.append(prompt)
        yield json.dumps({"topics": [{"t": f"Topic {i}", "d": "Evidence", "r": "Study", "s": [0]} for i in range(15)]})
    monkeypatch.setattr(providers, "generate", generate)
    response = await signed.post(f"/api/v1/chats/{cid}/topic-sets", json={"document_ids": [doc["document_id"]], "count": 15, "page_range": {"start": 5, "end": 21}})
    await worker.process_one()
    item = (await signed.get(f"/api/v1/topic-sets/{response.json()['topic_set_id']}")).json()
    assert item["status"] == "complete"
    assert len(calls) == 1 and len(item["topics"]) == 15
    assert item["covered_pages"]["total"] == 17
    assert item["covered_pages"]["processed"] <= 17
    assert all(5 <= source["page_number"] <= 21 for topic in item["topics"] for source in topic["sources_json"]["sources"])


async def test_cancellation_does_not_publish_partial_topics(signed, local_providers, monkeypatch):
    cid = await chat(signed)
    doc = await upload(signed, cid)
    await index_all()
    response = await signed.post(f"/api/v1/chats/{cid}/topic-sets", json={"document_ids": [doc["document_id"]]})
    jid = UUID(response.json()["job_id"])
    async def generate(*args, **kwargs):
        async with async_session_factory() as db:
            job = await db.get(Job, jid)
            job.cancel_requested = True
            await db.commit()
        yield '{"topics":[]}'
    monkeypatch.setattr(providers, "generate", generate)
    await worker.process_one()
    item = (await signed.get(f"/api/v1/topic-sets/{response.json()['topic_set_id']}")).json()
    assert item["status"] == "cancelled" and item["topics"] == []


@pytest.mark.parametrize("count", [1, 15, 30])
def test_large_unicode_scope_fits_one_request(count):
    rows = [SimpleNamespace(text=(f"Topic {i}: \u0a97\u0ac1\u0a9c quoted \"text\"\n" * 500)) for i in range(50)]
    batch, prompt, schema, tokens = prepare_batch(rows, 0, count, 4096)
    assert len(json.dumps(prompt, ensure_ascii=False).encode()) + tokens + 256 <= 4096
    assert batch[0] is rows[0] and batch[-1] is rows[-1]
    assert schema["properties"]["topics"]["maxItems"] == count


def test_two_topics_one_page_keeps_fast_request_budget():
    text = "Self-attention relates tokens. Positional encoding preserves word order."
    row = SimpleNamespace(text=text)
    batch, prompt, schema, tokens = prepare_batch([row], 0, 2, 4096)
    assert batch == [row]
    assert prompt[1]["content"] == "[0] " + text
    assert schema["properties"]["topics"]["maxItems"] == 2
    assert tokens == 210  # Preserve the existing small-request output budget.
