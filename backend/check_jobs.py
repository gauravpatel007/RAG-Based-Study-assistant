import asyncio
import asyncpg
import sys

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

async def run():
    # Try IPv4 first
    try:
        conn = await asyncpg.connect('postgresql://postgres:postgres@127.0.0.1:5432/study_assistant', timeout=3)
    except Exception as e:
        conn = await asyncpg.connect('postgresql://postgres:postgres@[::1]:5432/study_assistant', timeout=3)
        
    jobs = await conn.fetch("SELECT id, type, status, error_code, progress FROM jobs WHERE type='generate_flashcards' ORDER BY created_at DESC LIMIT 5")
    for job in jobs:
        print(dict(job))
    await conn.close()

if __name__ == "__main__":
    asyncio.run(run())
