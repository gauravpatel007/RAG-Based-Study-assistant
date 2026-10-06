import asyncio
from uuid import uuid4
from sqlalchemy.ext.asyncio import create_async_engine, async_session_factory
from app.models.models import Job, Base
import traceback

async def main():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    SessionLocal = async_session_factory(engine)
    async with SessionLocal() as db:
        user_id = uuid4()
        chat_id = uuid4()
        topic_set_id = uuid4()
        
        try:
            job = Job(
                user_id=user_id,
                chat_id=chat_id,
                type="generate_concept_map",
                payload={"topic_set_id": str(topic_set_id), "corpus_version": 1}
            )
            db.add(job)
            await db.commit()
            print("Job created:", job.id)
        except Exception as e:
            print("Error!")
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
