import asyncio
from sqlalchemy import select
from app.core.database import async_session_factory
from app.models.models import SystemConfig

async def get_settings():
    async with async_session_factory() as db:
        res = (await db.scalars(select(SystemConfig).where(SystemConfig.key.in_(['LLM_CONTEXT_TOKENS', 'LLM_MAX_OUTPUT_TOKENS', 'TOP_K'])))).all()
        return [(r.key, r.value) for r in res]

if __name__ == "__main__":
    print(asyncio.run(get_settings()))
