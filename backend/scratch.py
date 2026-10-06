import asyncio
from sqlalchemy import select
from app.core.database import async_session_factory
from app.models.models import Job

async def main():
    async with async_session_factory() as db:
        job = await db.scalar(select(Job).where(Job.status == 'failed').order_by(Job.created_at.desc()))
        if job:
            print('Job ID:', job.id)
            print('Error:', job.error)
            print('Payload:', job.payload)
        else:
            print('No failed jobs')

if __name__ == '__main__':
    asyncio.run(main())
