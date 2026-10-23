import asyncio
import os
import sys

# add backend path to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), '../../backend'))

from app.core.database import async_session_factory
from app.models.models import Job
from sqlalchemy import select

async def get_latest_error():
    async with async_session_factory() as db:
        rows = (await db.scalars(select(Job).where(Job.type=='generate_presentation').order_by(Job.created_at.desc()).limit(1))).all()
        if rows:
            print("Job ID:", rows[0].id)
            print("Status:", rows[0].status)
            print("Error Code:", rows[0].error_code)
        else:
            print("no jobs found")

asyncio.run(get_latest_error())
