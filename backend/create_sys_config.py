import asyncio
from app.core.database import engine
from sqlalchemy import text

async def main():
    print("Engine created. Connecting to DB...")
    async with engine.begin() as conn:
        print("Connected. Altering tables...")
        
        queries = [
            """
            CREATE TABLE IF NOT EXISTS system_configs (
                key VARCHAR(100) PRIMARY KEY,
                value JSON NOT NULL,
                description VARCHAR(500),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
                updated_by UUID
            );
            """
        ]
        
        for q in queries:
            try:
                await conn.execute(text(q))
                print(f"Executed: {q}")
            except Exception as e:
                print(f"Error executing {q}: {e}")
                
    print("Done.")

if __name__ == "__main__":
    asyncio.run(main())
