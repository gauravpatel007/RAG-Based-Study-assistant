"""Lazy local providers: the API can start without loading models into RAM."""
import json
from functools import lru_cache
import httpx
from app.core.settings import settings

@lru_cache(maxsize=1)
def encoder():
    import torch
    torch.set_num_threads(4)
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(settings.EMBEDDING_MODEL, device="cpu", local_files_only=True,
                               cache_folder=str(settings.STORAGE_ROOT / "models"))

@lru_cache(maxsize=1)
def reranker():
    import torch
    torch.set_num_threads(4)
    from sentence_transformers import CrossEncoder
    return CrossEncoder(settings.RERANKER_MODEL, device="cpu", local_files_only=True,
                        cache_folder=str(settings.STORAGE_ROOT / "models"))

def rerank(query: str, passages: list[str]) -> list[float]:
    model = reranker()
    pairs = [(query, p) for p in passages]
    return model.predict(pairs, show_progress_bar=False).tolist()

@lru_cache(maxsize=1)
def collection():
    import chromadb
    client = chromadb.HttpClient(host=settings.CHROMA_HOST, port=settings.CHROMA_PORT)
    return client.get_or_create_collection(settings.CHROMA_COLLECTION, embedding_function=None,
                                         metadata={"hnsw:space": "cosine"})

def embed(texts):
    return encoder().encode(texts, batch_size=settings.EMBEDDING_BATCH_SIZE, normalize_embeddings=True).tolist()

from app.core.dynamic_settings import dyn_settings

class UsageMetrics:
    def __init__(self):
        self.input_tokens = 0
        self.output_tokens = 0
        self.duration_ms = 0

async def generate(messages, structured=False, *, max_tokens=None, metrics: UsageMetrics = None):
    """Yield only answer content; never use cloud fallbacks or execute model tools."""
    llm_model = await dyn_settings.get("LLM_MODEL", settings.LLM_MODEL)
    if ":cloud" in llm_model or llm_model.endswith("-cloud"):
        raise RuntimeError("CLOUD_MODEL_DISABLED")
    messages = [dict(message) for message in messages]

    llm_context_tokens = await dyn_settings.get("LLM_CONTEXT_TOKENS", settings.LLM_CONTEXT_TOKENS)
    llm_max_output_tokens = await dyn_settings.get("LLM_MAX_OUTPUT_TOKENS", settings.LLM_MAX_OUTPUT_TOKENS)
    llm_temperature = await dyn_settings.get("LLM_TEMPERATURE", settings.LLM_TEMPERATURE)

    body = {"model": llm_model, "messages": messages, "stream": True,
            "keep_alive": "15m",
            "options": {"num_ctx": llm_context_tokens, "num_predict": max_tokens or llm_max_output_tokens,
                        "temperature": llm_temperature}}
    if structured:
        body["format"] = structured if isinstance(structured, dict) else "json"
        body["options"]["temperature"] = 0
    async with httpx.AsyncClient(timeout=httpx.Timeout(settings.MODEL_TIMEOUT_SECONDS, connect=5), proxy=None, trust_env=False) as client:
        async with client.stream("POST", settings.OLLAMA_BASE_URL + "/api/chat", json=body) as response:
            if response.status_code != 200:
                await response.aread()
                raise RuntimeError(f"Ollama Error: {response.text}")
            response.raise_for_status()
            buffer = ""
            in_think = False
            async for line in response.aiter_lines():
                if line:
                    event = json.loads(line)
                    if event.get("error"):
                        raise RuntimeError("MODEL_ERROR")
                    if event.get("done") and metrics:
                        metrics.input_tokens = event.get("prompt_eval_count", 0)
                        metrics.output_tokens = event.get("eval_count", 0)
                        metrics.duration_ms = event.get("total_duration", 0) // 1000000
                    chunk = event.get("message", {}).get("content", "")
                    if not chunk:
                        continue
                    buffer += chunk
                    while buffer:
                        if not in_think:
                            start_idx = buffer.find("<think>")
                            if start_idx != -1:
                                if start_idx > 0:
                                    yield buffer[:start_idx]
                                buffer = buffer[start_idx + len("<think>"):]
                                in_think = True
                            else:
                                partial_idx = -1
                                for i in range(len(buffer)):
                                    if buffer[i] == "<" and "<think>".startswith(buffer[i:]):
                                        partial_idx = i
                                        break
                                if partial_idx != -1:
                                    if partial_idx > 0:
                                        yield buffer[:partial_idx]
                                    buffer = buffer[partial_idx:]
                                    break
                                else:
                                    yield buffer
                                    buffer = ""
                                    break
                        else:
                            end_idx = buffer.find("</think>")
                            if end_idx != -1:
                                buffer = buffer[end_idx + len("</think>"):]
                                in_think = False
                            else:
                                partial_idx = -1
                                for i in range(len(buffer)):
                                    if buffer[i] == "<" and "</think>".startswith(buffer[i:]):
                                        partial_idx = i
                                        break
                                if partial_idx != -1:
                                    buffer = buffer[partial_idx:]
                                    break
                                else:
                                    buffer = ""
                                    break
            if buffer and not in_think:
                yield buffer

async def complete(messages, structured=False):
    return "".join([part async for part in generate(messages, structured)])
