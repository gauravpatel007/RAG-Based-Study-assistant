"""Explicit online preparation; regular inference uses the offline cache."""
import asyncio
import os
os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
from pathlib import Path
import httpx
from app.core.settings import settings

async def main():
    from sentence_transformers import SentenceTransformer, CrossEncoder
    print("Caching the local embedding model...", flush=True)
    await asyncio.to_thread(SentenceTransformer, settings.EMBEDDING_MODEL, device="cpu",
                            cache_folder=str(settings.STORAGE_ROOT / "models"))
    
    print("Caching the cross-encoder reranker model...", flush=True)
    await asyncio.to_thread(CrossEncoder, settings.RERANKER_MODEL, device="cpu",
                            cache_folder=str(settings.STORAGE_ROOT / "models"))
    print("Pulling the local answer model through Ollama...", flush=True)
    async with httpx.AsyncClient(timeout=3600) as client:
        response = await client.post(settings.OLLAMA_BASE_URL + "/api/pull", json={"model": settings.LLM_MODEL, "stream": False})
        response.raise_for_status()
        if response.json().get("error"):
            raise RuntimeError(response.json()["error"])
    print("Both local models are available.", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
