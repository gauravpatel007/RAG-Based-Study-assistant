import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect('postgresql://postgres:postgres@localhost:5432/study_assistant')
    
    # fetch all versions
    rows = await conn.fetch('SELECT * FROM alembic_version')
    print("Before:", rows)
    
    # clear them
    await conn.execute('DELETE FROM alembic_version')
    
    # insert the desired current version
    await conn.execute("INSERT INTO alembic_version (version_num) VALUES ('0007_add_system_configs')")
    
    rows = await conn.fetch('SELECT * FROM alembic_version')
    print("After:", rows)
    
    await conn.close()

asyncio.run(main())
