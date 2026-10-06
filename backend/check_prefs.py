import asyncio
import asyncpg

async def get_prefs():
    try:
        conn = await asyncpg.connect('postgresql://postgres:postgres@localhost:5432/study_assistant')
        rows = await conn.fetch("SELECT * FROM user_preferences")
        print([dict(r) for r in rows])
        await conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(get_prefs())
