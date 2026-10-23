import asyncio
from sqlalchemy import text
from app.core.database import engine

async def run():
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE notes ADD COLUMN title VARCHAR(200)"))
        except Exception as e: print("title:", e)
        try:
            await conn.execute(text("ALTER TABLE notes ADD COLUMN tag VARCHAR(30)"))
        except Exception as e: print("tag:", e)
        try:
            await conn.execute(text("ALTER TABLE notes ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE NOT NULL"))
        except Exception as e: print("is_pinned:", e)
        try:
            await conn.execute(text("ALTER TABLE notes ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL"))
        except Exception as e: print("updated_at:", e)
        try:
            await conn.execute(text("ALTER TABLE notes ALTER COLUMN selected_text DROP NOT NULL"))
        except Exception as e: print("selected_text:", e)
    print("Database updated!")
    await engine.dispose()

asyncio.run(run())
