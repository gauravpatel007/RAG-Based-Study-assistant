"""Explicit recovery command after resolving unavailable dependencies."""
import asyncio
from sqlalchemy import update
from app.models.models import Job
from app.core.database import async_session_factory, engine
from app.worker import recover

async def main():
    await recover()
    async with async_session_factory() as db:
        result = await db.execute(update(Job).where(Job.type.in_(["cleanup_document", "cleanup_chat"]), Job.status == "failed")
                                  .values(status="pending", attempts=0, lease_until=None))
        await db.commit()
        print(f"Requeued {result.rowcount} failed cleanup jobs. Start the worker to complete them.")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
