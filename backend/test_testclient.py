import asyncio
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import async_session_factory
from sqlalchemy import select
from app.models.models import User, Chat, TopicSet
import uuid

async def test():
    # Find a user, chat, topic_set in the real db to test with
    async with async_session_factory() as db:
        user = (await db.scalars(select(User).limit(1))).first()
        if not user:
            print("No user found")
            return
        
        chat = (await db.scalars(select(Chat).where(Chat.user_id == user.id).limit(1))).first()
        if not chat:
            print("No chat found")
            return
            
        topic_set = (await db.scalars(select(TopicSet).where(TopicSet.chat_id == chat.id).limit(1))).first()
        if not topic_set:
            print("No topic set found")
            return

        print(f"Testing with user={user.id}, chat={chat.id}, topic_set={topic_set.id}")
        
        # Test the endpoint using test client!
        # We need to mock user_dep
        from app.api.routes import user_dep
        app.dependency_overrides[user_dep] = lambda: user
        
        client = TestClient(app)
        try:
            res = client.post(f"/api/v1/chats/{chat.id}/topic_sets/{topic_set.id}/mindmap/generate")
            print("Generate Status:", res.status_code)
            print("Generate Body:", res.text)
            
            res2 = client.get(f"/api/v1/chats/{chat.id}/topic_sets/{topic_set.id}/mindmap")
            print("GET Status:", res2.status_code)
            print("GET Body:", res2.text)
        except Exception as e:
            print("Exception occurred:")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
