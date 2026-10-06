"""Explicit, idempotent demo seed: python -m app.seed."""
import asyncio
from argon2 import PasswordHasher
from sqlalchemy import select
from app.core.database import async_session_factory, engine
from app.core.settings import settings
from app.models.models import User

async def main():
    if not settings.DEMO_MODE:
        raise SystemExit("Set DEMO_MODE=true explicitly before creating the demo account.")
    async with async_session_factory() as db:
        hasher = PasswordHasher()
        for uname, pwd, email in [("user", "user", "user@example.com"), ("admin", "admin", "admin@example.com")]:
            u = await db.scalar(select(User).where(User.username == uname))
            if u:
                u.password_hash = hasher.hash(pwd)
                u.is_active = True
                u.email_verified = True
                u.deleted_at = None
                if not u.email:
                    u.email = email
            else:
                db.add(User(
                    username=uname,
                    email=email,
                    password_hash=hasher.hash(pwd),
                    is_active=True,
                    email_verified=True,
                ))
        await db.commit()
        print("Demo accounts are ready:")
        print(" - username user / password user")
        print(" - username admin / password admin")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
