import asyncio
from sqlalchemy import select
from app.models.models import Job, TopicSet
from app.core.database import async_session_factory

async def test():
    async with async_session_factory() as db:
        try:
            res = await db.execute(select(Job).where(Job.payload["topic_set_id"].as_string() == "test"))
            print("Query executed successfully")
        except Exception as e:
            print("Query failed:", str(e))

if __name__ == "__main__":
    asyncio.run(test())
