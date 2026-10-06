import asyncio
from sqlalchemy import select
from app.core.database import async_session_factory
from app.models.models import Document, DocumentChunk

async def check_chunks():
    async with async_session_factory() as db:
        # Get the latest document
        doc = (await db.scalars(select(Document).order_by(Document.created_at.desc()).limit(1))).first()
        if not doc:
            print("No docs found")
            return
        print(f"Latest doc: {doc.original_filename}")
        chunks = (await db.scalars(select(DocumentChunk).where(DocumentChunk.document_id == doc.id))).all()
        print(f"Total chunks: {len(chunks)}")
        if chunks:
            sizes = [len(c.text) for c in chunks]
            print(f"Max chunk size (chars): {max(sizes)}")
            print(f"Min chunk size (chars): {min(sizes)}")
            print(f"Avg chunk size (chars): {sum(sizes)/len(sizes)}")
            tokens = [c.token_count for c in chunks]
            print(f"Max tokens: {max(tokens)}")
            print(f"Min tokens: {min(tokens)}")

if __name__ == "__main__":
    asyncio.run(check_chunks())
