import asyncio
import os
import sys
import traceback

sys.path.append(os.path.join(os.path.dirname(__file__), '../../backend'))

from app.core.database import async_session_factory
from app.models.models import Job
from app.worker import generate_presentation

async def run_latest_job():
    async with async_session_factory() as db:
        from sqlalchemy import select
        rows = (await db.scalars(select(Job).where(Job.type=='generate_presentation').order_by(Job.created_at.desc()).limit(1))).all()
        if not rows:
            print("No jobs")
            return
        job_id = rows[0].id
        print(f"Running job {job_id}")
    
    try:
        await generate_presentation(job_id)
        print("Success!")
    except Exception as e:
        traceback.print_exc()

asyncio.run(run_latest_job())
