import asyncio
from sqlalchemy import text
from app.core.database import async_session_factory
import sys

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

async def fix_db():
    async with async_session_factory() as db:
        print("Connected to DB.")
        await db.execute(text("""
        CREATE TABLE IF NOT EXISTS concept_edges (
            id UUID PRIMARY KEY,
            topic_set_id UUID NOT NULL REFERENCES topic_sets(id) ON DELETE CASCADE,
            source_topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
            target_topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
            relationship_type VARCHAR(50) NOT NULL,
            evidence TEXT,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
        """))
        await db.commit()
        print("Table 'concept_edges' created.")

if __name__ == "__main__":
    asyncio.run(fix_db())
