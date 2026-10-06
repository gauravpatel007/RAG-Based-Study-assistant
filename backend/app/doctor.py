import asyncio
import json
import httpx
from sqlalchemy import select, func
from app.core.database import async_session_factory, engine
from app.core.settings import settings
from app.models.models import Job

async def main():
    report = {"frontend_build": (settings.FRONTEND_DIST / "index.html").is_file(),
              "ocr_english": (settings.TESSDATA_PREFIX / "eng.traineddata").is_file()}
    try:
        async with async_session_factory() as db:
            await db.execute(select(1))
            report["database"] = "ready"
            report["pending_jobs"] = await db.scalar(select(func.count()).select_from(Job).where(Job.status == "pending"))
            report["failed_jobs"] = await db.scalar(select(func.count()).select_from(Job).where(Job.status == "failed"))
    except Exception as exc:
        report["database"] = type(exc).__name__
    try:
        from app import providers
        providers.reranker()
        report["reranker"] = "ready"
    except Exception as exc:
        report["reranker"] = type(exc).__name__
    async with httpx.AsyncClient(timeout=3) as client:
        for name, url in [("api", "http://127.0.0.1:8000/api/v1/health/ready"),
                          ("chroma", f"http://{settings.CHROMA_HOST}:{settings.CHROMA_PORT}/api/v2/heartbeat"),
                          ("ollama", settings.OLLAMA_BASE_URL + "/api/tags")]:
            try:
                response = await client.get(url)
                response.raise_for_status()
                report[name] = response.json()
            except Exception as exc:
                report[name] = type(exc).__name__
    print(json.dumps(report, indent=2))
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
