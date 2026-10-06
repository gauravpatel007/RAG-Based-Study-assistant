import asyncio
import asyncpg
import sys

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

async def main():
    print("Connecting to DB...")
    # Try IPv4 first
    try:
        conn = await asyncpg.connect('postgresql://postgres:postgres@127.0.0.1:5432/study_assistant', timeout=3)
    except Exception as e:
        print("IPv4 failed:", e)
        # Try IPv6
        conn = await asyncpg.connect('postgresql://postgres:postgres@[::1]:5432/study_assistant', timeout=3)
        
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS comparisons (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
            query VARCHAR(500) NOT NULL,
            document_ids JSONB NOT NULL,
            generated_comparison JSONB NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL
        );
    """)
    try:
        await conn.execute("UPDATE alembic_version SET version_num='0004'")
    except Exception:
        pass
    print("Table created.")
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
