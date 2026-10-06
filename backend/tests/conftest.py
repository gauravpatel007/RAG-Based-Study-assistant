import os
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["DEMO_MODE"] = "true"

import pytest
from httpx import AsyncClient, ASGITransport
from argon2 import PasswordHasher
from app.core.database import Base, engine, async_session_factory
from app.core.settings import settings
from app.models.models import User
from app.main import app
from app.api.routes import login_attempts

@pytest.fixture(autouse=True)
async def database(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "STORAGE_ROOT", tmp_path)
    login_attempts.clear()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    async with async_session_factory() as db:
        db.add_all([User(username=name, password_hash=PasswordHasher().hash("user")) for name in ["user", "other"]])
        await db.commit()
    yield

@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://localhost:8000") as client:
        yield client

@pytest.fixture
async def signed(client):
    assert (await client.post("/api/v1/auth/login", json={"username": "user", "password": "user"})).status_code == 200
    return client
