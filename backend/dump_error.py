import sys
import os

# Add the virtual environment site-packages to sys.path
venv_path = r"g:\Languages\Projects\LLM Chatbot\LLM A1\backend\.venv\Lib\site-packages"
sys.path.append(venv_path)

import asyncio
# pyrefly: ignore [missing-import]
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def main():
    engine = create_async_engine("postgresql+asyncpg://postgres:postgres@localhost:5432/study_assistant")
    async with engine.begin() as conn:
        result = await conn.execute(text("SELECT error_code FROM jobs WHERE type='generate_answer' AND status='failed' ORDER BY created_at DESC LIMIT 5"))
        rows = result.fetchall()
        for row in rows:
            print("ERROR CODE:", row[0])
            
if __name__ == "__main__":
    asyncio.run(main())
