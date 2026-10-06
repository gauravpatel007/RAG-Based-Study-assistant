import asyncio
import asyncpg

async def get_settings():
    try:
        conn = await asyncpg.connect('postgresql://postgres:postgres@localhost:5432/study_assistant')
        rows = await conn.fetch("SELECT key, value FROM system_configs WHERE key LIKE 'LLM_%' OR key = 'TOP_K'")
        print([dict(r) for r in rows])
        await conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(get_settings())
