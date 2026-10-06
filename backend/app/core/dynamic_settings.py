import asyncio
from datetime import datetime, timezone
from typing import Any
from sqlalchemy import select
from app.core.database import async_session_factory as AsyncSessionLocal
from app.models.models import SystemConfig
from app.core.settings import settings as env_settings

class DynamicSettings:
    def __init__(self):
        self._cache = {}
        self._last_fetched = None
        self._ttl_seconds = 3
        self._lock = asyncio.Lock()

    async def refresh_cache(self):
        async with self._lock:
            now = datetime.now(timezone.utc)
            if self._last_fetched and (now - self._last_fetched).total_seconds() < self._ttl_seconds:
                return
            
            async with AsyncSessionLocal() as session:
                result = await session.execute(select(SystemConfig))
                configs = result.scalars().all()
                self._cache = {c.key: c.value for c in configs}
                self._last_fetched = now

    async def get(self, key: str, default: Any = None) -> Any:
        try:
            await self.refresh_cache()
            if key in self._cache:
                return self._cache[key]
        except Exception:
            pass
        return getattr(env_settings, key, default)

    async def get_all(self):
        try:
            await self.refresh_cache()
        except Exception:
            pass
        return {
            "LLM_MODEL": await self.get("LLM_MODEL", env_settings.LLM_MODEL),
            "LLM_CONTEXT_TOKENS": await self.get("LLM_CONTEXT_TOKENS", env_settings.LLM_CONTEXT_TOKENS),
            "LLM_MAX_OUTPUT_TOKENS": await self.get("LLM_MAX_OUTPUT_TOKENS", env_settings.LLM_MAX_OUTPUT_TOKENS),
            "LLM_TEMPERATURE": await self.get("LLM_TEMPERATURE", env_settings.LLM_TEMPERATURE),
            "RETRIEVAL_MAX_DISTANCE": await self.get("RETRIEVAL_MAX_DISTANCE", env_settings.RETRIEVAL_MAX_DISTANCE),
            "CHUNK_SIZE": await self.get("CHUNK_SIZE", 200),
            "CHUNK_OVERLAP": await self.get("CHUNK_OVERLAP", 30),
            "TOP_K": await self.get("TOP_K", 12),
            "RERANKER_ENABLED": await self.get("RERANKER_ENABLED", env_settings.RERANKER_ENABLED),
            "BM25_ENABLED": await self.get("BM25_ENABLED", env_settings.BM25_ENABLED),
            "SEMANTIC_TOP_K": await self.get("SEMANTIC_TOP_K", env_settings.SEMANTIC_TOP_K),
            "BM25_TOP_K": await self.get("BM25_TOP_K", env_settings.BM25_TOP_K),
            "RERANKER_TOP_N": await self.get("RERANKER_TOP_N", env_settings.RERANKER_TOP_N),
        }

    async def set(self, key: str, value: Any, user_id=None):
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(SystemConfig).where(SystemConfig.key == key))
            config = result.scalars().first()
            if config:
                config.value = value
                config.updated_by = user_id
            else:
                config = SystemConfig(key=key, value=value, updated_by=user_id)
                session.add(config)
            await session.commit()
            
        async with self._lock:
            self._cache[key] = value

dyn_settings = DynamicSettings()

async def sync_settings_to_global():
    while True:
        try:
            configs = await dyn_settings.get_all()
            from app.core.settings import settings
            for k, v in configs.items():
                if hasattr(settings, k):
                    setattr(settings, k, v)
        except Exception as e:
            pass # ignore db errors during sync
        await asyncio.sleep(10)

