import asyncio
import httpx

async def test():
    # Attempt to log in to get a token, or simply call an endpoint and observe the error.
    async with httpx.AsyncClient() as client:
        # Let's try to just hit the endpoint without auth. We should get 401. If we get 500, it's a huge clue!
        url = "http://127.0.0.1:8009/api/v1/chats/12345678-1234-5678-1234-567812345678/topic_sets/12345678-1234-5678-1234-567812345678/mindmap/generate"
        res = await client.post(url)
        print("Status:", res.status_code)
        print("Body:", res.text)

if __name__ == "__main__":
    asyncio.run(test())
