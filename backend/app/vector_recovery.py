"""Restore missing vectors from durable SQL chunks without re-uploading or OCR.

Run `python -m app.vector_recovery` with the worker stopped for a full audit.
Question processing also verifies and repairs its own document scope on demand.
"""
import asyncio
import logging
from uuid import UUID

from sqlalchemy import select, text

from app import providers
from app.core.database import async_session_factory, engine
from app.core.settings import settings
from app.models.models import Chat, Document, DocumentChunk

log = logging.getLogger("study.vectors")


async def ensure_vectors(*, user_id=None, chat_id=None, document_ids=None, on_progress=None):
    index = await asyncio.to_thread(providers.collection)
    query = select(Document).join(Chat, Document.chat_id == Chat.id).where(Document.status == "ready", Document.deleted_at.is_(None), Chat.deleted_at.is_(None))
    if user_id is not None:
        query = query.where(Document.user_id == user_id, Chat.user_id == user_id)
    if chat_id is not None:
        query = query.where(Document.chat_id == chat_id)
    if document_ids is not None:
        query = query.where(Document.id.in_([UUID(str(i)) for i in document_ids]))
    async with async_session_factory() as db:
        documents = (await db.scalars(query)).all()
    if document_ids is not None and len(documents) != len(set(document_ids)):
        raise RuntimeError("SCOPE_MISMATCH")
    restored = 0
    for doc in documents:
        async with async_session_factory() as db:
            chunks = (await db.scalars(select(DocumentChunk).where(DocumentChunk.document_id == doc.id,
                DocumentChunk.index_version == doc.active_index_version).order_by(DocumentChunk.chunk_index))).all()
        if not chunks:
            raise RuntimeError("INDEX_UNAVAILABLE: Stored document text is missing. Reprocess this document.")
        scope = {"$and": [{"user_id": str(doc.user_id)}, {"chat_id": str(doc.chat_id)},
                          {"document_id": str(doc.id)}, {"index_version": str(doc.active_index_version)}]}
        existing = set((await asyncio.to_thread(index.get, where=scope, include=[]))["ids"])
        missing = [c for c in chunks if str(c.id) not in existing]
        for offset in range(0, len(missing), settings.EMBEDDING_BATCH_SIZE):
            batch = missing[offset:offset + settings.EMBEDDING_BATCH_SIZE]
            if on_progress:
                await on_progress(restored, len(missing))
            vectors = await asyncio.to_thread(providers.embed, [c.text for c in batch])
            # Deletion and reindex activation also lock the chat. Do not recreate
            # vectors for a document that was removed while embeddings loaded.
            async with async_session_factory() as db:
                chat = await db.scalar(select(Chat).where(Chat.id == doc.chat_id).with_for_update())
                current = await db.get(Document, doc.id)
                if not chat or chat.deleted_at or not current or current.deleted_at or current.status != "ready" or current.active_index_version != doc.active_index_version:
                    raise RuntimeError("SCOPE_MISMATCH")
                await asyncio.to_thread(index.upsert, ids=[str(c.id) for c in batch], embeddings=vectors,
                    documents=[c.text for c in batch], metadatas=[{
                        "user_id": str(doc.user_id), "chat_id": str(doc.chat_id), "document_id": str(doc.id),
                        "index_version": str(doc.active_index_version), "page_number": c.page_number,
                        "chunk_index": c.chunk_index,
                    } for c in batch])
                await db.commit()
            restored += len(batch)
        actual = set((await asyncio.to_thread(index.get, where=scope, include=[]))["ids"])
        if not {str(c.id) for c in chunks}.issubset(actual):
            raise RuntimeError("INDEX_UNAVAILABLE: Could not restore the document search index. Retry shortly.")
        if missing:
            log.info("Restored %s vectors for document=%s", len(missing), doc.id)
    return restored


async def main():
    logging.basicConfig(level=logging.INFO)
    try:
        async with engine.connect() as lock:
            if engine.dialect.name == "postgresql":
                if not await lock.scalar(text("SELECT pg_try_advisory_lock(71904269)")):
                    raise SystemExit("Stop the study worker before running a full vector repair.")
                await lock.commit()
            print(f"Restored {await ensure_vectors()} missing vectors.")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
