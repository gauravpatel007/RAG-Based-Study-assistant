import asyncio
from sqlalchemy import text
from app.core.database import engine

async def main():
    print("Connecting to DB to create comparisons table...")
    async with engine.begin() as conn:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS comparisons (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
                query VARCHAR(500) NOT NULL,
                document_ids JSONB NOT NULL,
                generated_comparison JSONB NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL
            );
        """))
    print("Table created successfully.")
    
    # Let's also stamp alembic so it knows we applied 0004
    async with engine.begin() as conn:
        try:
            await conn.execute(text("UPDATE alembic_version SET version_num='0004'"))
            print("Alembic stamped.")
        except Exception as e:
            print("Could not stamp alembic:", e)

if __name__ == "__main__":
    asyncio.run(main())
