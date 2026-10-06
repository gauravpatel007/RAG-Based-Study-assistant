import asyncio
from app.core.database import async_session_factory
from app.models.models import User
from argon2 import PasswordHasher
from sqlalchemy import select

async def main():
    passwords = PasswordHasher()
    hashed = passwords.hash("admin")
    
    async with async_session_factory() as db:
        result = await db.execute(select(User).where(User.username == 'admin'))
        admin_user = result.scalar_one_or_none()
        
        if admin_user:
            print("Admin already exists. Updating password to 'admin'")
            admin_user.hashed_password = hashed
            await db.commit()
        else:
            print("Creating admin user with username 'admin' and password 'admin'")
            admin_user = User(
                username="admin",
                email="admin@example.com",
                hashed_password=hashed,
                is_active=True
            )
            db.add(admin_user)
            await db.commit()
            print("Admin created.")

if __name__ == "__main__":
    asyncio.run(main())
