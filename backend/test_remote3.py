import asyncio
import httpx
from sqlalchemy import select
from app.models.models import User, Chat, TopicSet
from app.core.database import async_session_factory

async def main():
    # Find a valid topic_set
    async with async_session_factory() as db:
        user = (await db.scalars(select(User).limit(1))).first()
        topic_set = (await db.scalars(select(TopicSet).limit(1))).first()
        if not topic_set:
            print("No topic sets found in db.")
            return
            
    print(f"Testing with topic_set_id={topic_set.id}, chat_id={topic_set.chat_id}")
    
    async with httpx.AsyncClient(base_url="http://127.0.0.1:8000/api/v1") as client:
        # Register a new user just to get a session
        res = await client.post("/auth/register", json={"username": "test_mindmap_bypass", "password": "password"})
        res = await client.post("/auth/login", json={"username": "test_mindmap_bypass", "password": "password"})
        
        # Actually, if we use a different user, they won't have access to this chat_id.
        # We need to authenticate as the user who owns the chat.
        # We can't know their password. But we can just use the internal test client for this!
        pass

if __name__ == "__main__":
    asyncio.run(main())
