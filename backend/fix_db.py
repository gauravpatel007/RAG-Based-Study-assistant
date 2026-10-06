import asyncio
import asyncpg
import sys
from asyncpg import Connection

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

async def fix_db():
    try:
        conn: Connection = await asyncpg.connect('postgresql://postgres:postgres@127.0.0.1:5432/study_assistant', timeout=3)
    except Exception:
        conn = await asyncpg.connect('postgresql://postgres:postgres@[::1]:5432/study_assistant', timeout=3)
    
    print("Connected to DB.")
    
    # Create concept_edges table
    await conn.execute("""
    CREATE TABLE IF NOT EXISTS concept_edges (
        id UUID PRIMARY KEY,
        topic_set_id UUID NOT NULL REFERENCES topic_sets(id) ON DELETE CASCADE,
        source_topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
        target_topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
        relationship_type VARCHAR(50) NOT NULL,
        evidence TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    """)
    print("Table 'concept_edges' created.")
    
    await conn.close()

if __name__ == "__main__":
    asyncio.run(fix_db())
