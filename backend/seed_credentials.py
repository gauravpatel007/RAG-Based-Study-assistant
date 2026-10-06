import asyncio
import os
from argon2 import PasswordHasher
from sqlalchemy import select, or_

# Ensure DEMO_MODE is true
os.environ["DEMO_MODE"] = "true"

from app.core.database import async_session_factory, engine
from app.models.models import User, UserProfile, UserPreferences

async def seed_users():
    hasher = PasswordHasher()
    user_hash = hasher.hash("user")
    admin_hash = hasher.hash("admin")

    async with async_session_factory() as db:
        # 1. Setup 'user'
        user_res = await db.execute(select(User).where(User.username == "user"))
        u = user_res.scalars().first()
        if u:
            print(f"Updating existing user '{u.username}' (id: {u.id})")
            u.password_hash = user_hash
            u.is_active = True
            u.email_verified = True
            u.deleted_at = None
            if "gmail.com-" in u.email:
                u.email = "user@example.com"
        else:
            print("Creating user 'user'")
            u = User(
                username="user",
                email="user@example.com",
                password_hash=user_hash,
                is_active=True,
                email_verified=True,
            )
            db.add(u)
            await db.flush()

        # 2. Setup 'admin'
        admin_res = await db.execute(select(User).where(User.username == "admin"))
        a = admin_res.scalars().first()
        if a:
            print(f"Updating existing admin '{a.username}' (id: {a.id})")
            a.password_hash = admin_hash
            a.is_active = True
            a.email_verified = True
            a.deleted_at = None
            if "gmail.com-" in a.email:
                a.email = "admin@example.com"
        else:
            print("Creating admin 'admin'")
            a = User(
                username="admin",
                email="admin@example.com",
                password_hash=admin_hash,
                is_active=True,
                email_verified=True,
            )
            db.add(a)
            await db.flush()

        await db.commit()
        print("Successfully configured 'user' and 'admin' accounts!")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(seed_users())
