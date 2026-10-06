from uuid import UUID

import pytest
from sqlalchemy import select

from app import providers, worker
from app.core.database import async_session_factory
from app.models.models import Chat, Document
from app.vector_recovery import ensure_vectors
from test_application import chat, upload, index_all, local_providers  # noqa: F401


async def test_question_restores_lost_vectors_without_upload(signed, local_providers):
    cid, other = await chat(signed), await chat(signed)
    doc = await upload(signed, cid)
    other_doc = await upload(signed, other, 'Another private textbook.')
    await index_all()
    local_providers.records.clear()  # Simulate an empty vector store after restart.
    await signed.post(f'/api/v1/chats/{cid}/messages', json={'content': 'Explain backpropagation'})
    await worker.process_one()
    messages = (await signed.get(f'/api/v1/chats/{cid}/messages')).json()['items']
    assert messages[-1]['status'] == 'complete'
    assert messages[-1]['sources'][0]['document_id'] == doc['document_id']
    assert all(meta['document_id'] != other_doc['document_id'] for _, meta in local_providers.records.values())


async def test_existing_index_needs_no_embedding_and_missing_ids_repair(signed, local_providers, monkeypatch):
    cid = await chat(signed)
    doc = await upload(signed, cid)
    await index_all()
    async with async_session_factory() as db:
        owner = await db.get(Chat, UUID(cid))
    calls = []
    monkeypatch.setattr(providers, 'embed', lambda texts: calls.append(texts) or [[1.0, 0.0] for _ in texts])
    assert await ensure_vectors(user_id=owner.user_id, chat_id=UUID(cid), document_ids=[doc['document_id']]) == 0
    assert calls == []
    key, value = next(iter(local_providers.records.items()))
    del local_providers.records[key]
    local_providers.records['wrong-id'] = value  # Same count is not enough.
    assert await ensure_vectors(user_id=owner.user_id, chat_id=UUID(cid), document_ids=[doc['document_id']]) == 1
    assert key in local_providers.records and len(calls) == 1


async def test_repair_rejects_out_of_scope_and_deleted_documents(signed, local_providers):
    cid, other = await chat(signed), await chat(signed)
    doc = await upload(signed, cid)
    await index_all()
    async with async_session_factory() as db:
        owner = await db.get(Chat, UUID(cid))
    with pytest.raises(RuntimeError, match='SCOPE_MISMATCH'):
        await ensure_vectors(user_id=owner.user_id, chat_id=UUID(other), document_ids=[doc['document_id']])
    await signed.delete(f'/api/v1/documents/{doc["document_id"]}')
    local_providers.records.clear()
    with pytest.raises(RuntimeError, match='SCOPE_MISMATCH'):
        await ensure_vectors(user_id=owner.user_id, chat_id=UUID(cid), document_ids=[doc['document_id']])
    assert local_providers.records == {}


async def test_deletion_during_embedding_does_not_recreate_vectors(signed, local_providers, monkeypatch):
    cid = await chat(signed)
    doc = await upload(signed, cid)
    await index_all()
    local_providers.records.clear()
    async def before_batch(*args):
        await signed.delete(f'/api/v1/documents/{doc["document_id"]}')
    with pytest.raises(RuntimeError, match='SCOPE_MISMATCH'):
        await ensure_vectors(document_ids=[doc['document_id']], on_progress=before_batch)
    assert local_providers.records == {}
