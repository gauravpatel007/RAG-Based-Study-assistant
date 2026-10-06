import asyncio
import httpx

async def main():
    async with httpx.AsyncClient(base_url="http://127.0.0.1:8000/api/v1") as client:
        # Register
        res = await client.post("/auth/register", json={"username": "testuser_mindmap3", "password": "password"})
        if res.status_code not in (200, 201) and "already exists" not in res.text:
            print("Register failed:", res.text)
        
        # Login
        res = await client.post("/auth/login", json={"username": "testuser_mindmap3", "password": "password"})
        if res.status_code != 200:
            print("Login failed:", res.text)
            return
        
        # Create chat
        res = await client.post("/chats", json={"title": "Test Chat"})
        if res.status_code not in (200, 201):
            print("Create chat failed:", res.text)
            return
        chat_id = res.json()["id"]
        
        # Create TopicSet (extract)
        res = await client.post(f"/chats/{chat_id}/topic-sets", json={"document_ids": [], "count": 15})
        if res.status_code not in (200, 201, 202):
            print("Create topic set failed:", res.text)
        else:
            topic_set_id = res.json()["topic_set_id"]
            print("Created topic set:", topic_set_id)
            
            # Now try to generate mindmap
            res = await client.post(f"/chats/{chat_id}/topic_sets/{topic_set_id}/mindmap/generate")
            print("Generate mindmap status:", res.status_code)
            print("Generate mindmap body:", res.text)
            
            # Now try to GET mindmap
            res = await client.get(f"/chats/{chat_id}/topic_sets/{topic_set_id}/mindmap")
            print("GET mindmap status:", res.status_code)
            print("GET mindmap body:", res.text)

if __name__ == "__main__":
    asyncio.run(main())
