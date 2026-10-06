import os
import asyncio
from argon2 import PasswordHasher
from sqlalchemy import select
from app.core.database import async_session_factory, engine
from app.models.models import User
# pyrefly: ignore [missing-import]
import nest_asyncio

nest_asyncio.apply()

os.environ["DEMO_MODE"] = "true"

async def main():
    try:
        async with async_session_factory() as db:
            if not await db.scalar(select(User).where(User.username == "admin")):
                db.add(User(username="admin", password_hash=PasswordHasher().hash("admin")))
                await db.commit()
                print("Admin user created")
            else:
                print("Admin already exists")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
