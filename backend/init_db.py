import asyncio
from app.core.database import engine
from app.models.models import Base

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    print("Database initialized successfully.")

if __name__ == "__main__":
    asyncio.run(init_db())
