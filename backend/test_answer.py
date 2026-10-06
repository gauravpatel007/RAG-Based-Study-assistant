import asyncio
import os
import sys

# Add backend directory to sys.path so 'app' can be imported
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import select
from app.core.database import async_session_factory
from app.models.models import Job
from app.worker import answer

async def main():
    async with async_session_factory() as db:
        # Get the latest failed generate_answer job
        job = await db.scalar(
            select(Job)
            .where(Job.status == 'failed', Job.type == 'generate_answer')
            .order_by(Job.created_at.desc())
        )
        if not job:
            print("No failed generate_answer jobs found.")
            return
            
        print(f"Found failed job: {job.id}")
        
    try:
        # Run answer directly to see the unhandled exception traceback
        await answer(job.id)
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
