# ⚡ LLM Answer Generation Speed Optimization Plan

## Current Pipeline Analysis

Based on deep analysis of your codebase, here is the **exact pipeline** and where time is being spent:

```
User Question
    │
    ├─ 1. Intent Classification       (~5ms)   rag.py:intent()
    ├─ 2. Vector Recovery Check        (~50ms)  worker.py:ensure_vectors()
    ├─ 3. Embedding the query          (~150ms) providers.embed() on CPU
    ├─ 4. ChromaDB semantic search     (~50ms)  retrieval._semantic_search()
    ├─ 5. BM25 Search (in-memory)      (~100ms) retrieval._bm25_search()
    ├─ 6. RRF Merge                    (~5ms)   retrieval._reciprocal_rank_fusion()
    ├─ 7. Cross-Encoder Reranking      (~800ms) providers.rerank() on CPU ← BIG BOTTLENECK
    ├─ 8. Prompt Building              (~10ms)  worker.py:build_user_prompt()
    └─ 9. LLM Generation (streaming)  (varies) providers.generate() via Ollama ← BIGGEST BOTTLENECK
```

**Biggest time consumers (in order):**
1. 🔴 **LLM generation** — `qwen3:4b` on CPU or underpowered GPU generating 4096 max tokens
2. 🟠 **Cross-encoder reranker** — `ms-marco-MiniLM-L-6-v2` running on CPU per query
3. 🟡 **Embedding** — `all-MiniLM-L6-v2` on CPU for each query
4. 🟡 **BM25** — rebuilds index from scratch on every single query (no caching)

---

## Optimization Strategies (Ranked by Impact)

---

### 🔥 TIER 1 — Highest Impact (Implement First)

---

#### 1. Reduce Max Output Tokens
**File:** `backend/app/core/settings.py` line 52
**Impact:** 🔴 Direct reduction in LLM time (linear relationship)

```diff
- LLM_MAX_OUTPUT_TOKENS: int = 4096
+ LLM_MAX_OUTPUT_TOKENS: int = 1024
```

**Why:** LLM generation time is **proportional to output tokens**. Generating 4096 tokens when users only need 150 words is pure waste. The system prompt already says "at most 150 words" but the model can still output up to 4096 tokens.

```diff
- LLM_CONTEXT_TOKENS: int = 8192
+ LLM_CONTEXT_TOKENS: int = 4096
```

**Why:** Smaller context = faster prefill (first token time).

---

#### 2. Reduce Final Retrieved Chunks (Top-N)
**File:** `backend/app/worker.py` line 368  
**Impact:** 🔴 Less context = faster LLM time

```diff
- top_n=int(await dyn_settings.get("TOP_K", 12)),
+ top_n=int(await dyn_settings.get("TOP_K", 5)),
```

Also in `settings.py`:
```diff
- RERANKER_TOP_N: int = 8
+ RERANKER_TOP_N: int = 5
```

**Why:** Fewer chunks → shorter prompt → faster LLM generation. 5 high-quality sources beat 12 mediocre ones.

---

#### 3. Cache BM25 Index Per Chat (Stop Rebuilding Every Query)
**File:** `backend/app/retrieval.py`  
**Impact:** 🟠 Saves 100-300ms per query

Currently, BM25 builds a new index from **all chunks in DB** on every single query. Instead, cache it per `chat_id`:

```python
# Add near top of retrieval.py
import functools
from collections import OrderedDict

_bm25_cache: OrderedDict[str, tuple[any, list]] = OrderedDict()  # chat_id -> (bm25_index, chunk_ids)
_BM25_CACHE_MAX = 20  # keep 20 chats in cache

async def _get_or_build_bm25(chat_id: str, chunks: list):
    """Build BM25 index once per chat, cache it."""
    from rank_bm25 import BM25Okapi
    
    cache_key = f"{chat_id}:{len(chunks)}"  # invalidate if chunk count changes
    if cache_key in _bm25_cache:
        return _bm25_cache[cache_key]
    
    def _build():
        tokenized = [c.text.lower().split() for c in chunks]
        return BM25Okapi(tokenized)
    
    bm25 = await asyncio.to_thread(_build)
    
    if len(_bm25_cache) >= _BM25_CACHE_MAX:
        _bm25_cache.popitem(last=False)
    _bm25_cache[cache_key] = (bm25, [str(c.id) for c in chunks])
    return bm25, [str(c.id) for c in chunks]
```

---

#### 4. Reduce Reranker Candidate Count
**File:** `backend/app/core/settings.py`
**Impact:** 🟠 Reranker time is O(n) — fewer candidates = faster

```diff
- SEMANTIC_TOP_K: int = 20
- BM25_TOP_K: int = 20
+ SEMANTIC_TOP_K: int = 12
+ BM25_TOP_K: int = 12
```

**Why:** Passing 20+20 chunks to the cross-encoder doubles reranker time. 12 candidates is usually sufficient.

---

### 🟡 TIER 2 — Medium Impact (Implement Next)

---

#### 5. Run Embedding and ChromaDB Query with Pre-Warmed Model

**File:** `backend/app/main.py`  
**Impact:** Eliminates cold-start latency on first query after startup

Add a startup warmup in `main.py`:
```python
@app.on_event("startup")
async def warmup_models():
    """Load embedding and reranker models into memory on startup."""
    import asyncio
    from app import providers
    log.info("Warming up embedding model...")
    await asyncio.to_thread(providers.encoder)  # triggers lru_cache load
    await asyncio.to_thread(providers.reranker) # triggers lru_cache load
    log.info("Models warmed up.")
```

---

#### 6. Reduce System Prompt Size
**File:** `backend/app/worker.py` lines 380–431  
**Impact:** 🟡 Fewer input tokens = faster LLM prefill

The system prompt is currently very verbose (~400 tokens). Create a more concise version:

```python
# Condensed system prompt — saves ~200 tokens per query
system = "Textbook study assistant. Answer ONLY from supplied sources. "
if prefs and prefs.external_knowledge:
    system += "External knowledge allowed but label it. "
else:
    system += "No invented facts. "

if not prefs or prefs.response_length == "medium":
    system += "Max 150 words. "
elif prefs.response_length == "short":
    system += "Max 50 words. "

system += "Bold numbered citations **1.** **2.**. No [S1] format. Start answer immediately."
```

---

#### 7. Reduce Conversation History Tokens
**File:** `backend/app/worker.py` line 302  
**Impact:** 🟡 Less input context = faster

```diff
- history = [{"role": m.role, "content": m.content[:700]} for m in reversed(history_rows)]
+ history = [{"role": m.role, "content": m.content[:300]} for m in reversed(history_rows)]
```

Also reduce the history window from 6 messages to 4:
```diff
- .order_by(Message.sequence_no.desc()).limit(6)
+ .order_by(Message.sequence_no.desc()).limit(4)
```

---

#### 8. Use a Faster/Smaller LLM Model
**File:** `backend/app/core/settings.py` line 50

| Model | Speed | Quality | Recommendation |
|---|---|---|---|
| `qwen3:4b` (current) | Slow | Good | Current |
| `qwen3:1.7b` | Fast | OK | ✅ Best speed/quality |
| `llama3.2:1b` | Very Fast | Basic | Speed priority |
| `gemma3:2b` | Fast | Good | Alternative |

```diff
- LLM_MODEL: str = "qwen3:4b"
+ LLM_MODEL: str = "qwen3:1.7b"
```

Run `ollama pull qwen3:1.7b` first.

---

### 🟢 TIER 3 — Lower Impact / Long-Term

---

#### 9. Disable Reranker (Toggle via Admin Panel)
**File:** Admin settings panel → `RERANKER_ENABLED`  
**Impact:** Saves 800ms+ but reduces relevance quality

This is already a configurable setting! Go to Admin → Settings and disable reranker for a quick test to see the speed difference.

---

#### 10. Async Streaming to Frontend — Immediate Perceived Speed
**File:** `backend/app/api/routes.py` — the SSE endpoint  
**Impact:** User feels response starts *instantly* even if total time is the same

Currently your app already streams via SSE (Server-Sent Events). But make sure the frontend renders each token/word as it arrives rather than waiting for a complete chunk. Check if the frontend polls every 300ms — if so reduce to 100ms.

```diff
# worker.py line 334 — reduce save interval
- if time.monotonic() - last_save > 0.3:
+ if time.monotonic() - last_save > 0.1:
```

---

#### 11. Embedding Cache for Repeated Questions
**File:** `backend/app/providers.py`  
**Impact:** Saves 150ms on repeated/similar questions

```python
import hashlib
from functools import lru_cache

_embed_cache: dict[str, list] = {}

def embed_cached(texts: list[str]) -> list:
    results = []
    to_compute = []
    to_compute_idx = []
    for i, t in enumerate(texts):
        key = hashlib.md5(t.encode()).hexdigest()
        if key in _embed_cache:
            results.append(_embed_cache[key])
        else:
            results.append(None)
            to_compute.append(t)
            to_compute_idx.append(i)
    
    if to_compute:
        computed = encoder().encode(to_compute, batch_size=settings.EMBEDDING_BATCH_SIZE, normalize_embeddings=True).tolist()
        for idx, vec in zip(to_compute_idx, computed):
            key = hashlib.md5(texts[idx].encode()).hexdigest()
            _embed_cache[key] = vec
            results[idx] = vec
    
    return results
```

---

## 🎯 Quick Win Action Plan (Do These Right Now)

These changes take **under 5 minutes** and give immediate results:

| Step | File | Change | Time Saved |
|---|---|---|---|
| 1 | `settings.py` | `LLM_MAX_OUTPUT_TOKENS: 4096 → 1024` | ~60% LLM time |
| 2 | `settings.py` | `LLM_CONTEXT_TOKENS: 8192 → 4096` | ~20% prefill |
| 3 | `settings.py` | `RERANKER_TOP_N: 8 → 5` | ~100ms reranker |
| 4 | `settings.py` | `SEMANTIC_TOP_K: 20 → 12`, `BM25_TOP_K: 20 → 12` | ~100ms reranker |
| 5 | `worker.py` line 302 | history content `[:700] → [:300]` | ~50ms LLM prefill |
| 6 | `worker.py` line 368 | `TOP_K: 12 → 5` | ~30% LLM time |
| 7 | `worker.py` line 334 | save interval `0.3 → 0.1` | Better *perceived* speed |

> **Expected total time reduction after Tier 1:** 40–70% faster responses

---

## 📊 Estimated Timings Before vs After

| Phase | Before | After Tier 1 | After Tier 1+2 |
|---|---|---|---|
| Embedding | ~150ms | ~150ms | ~80ms (cache) |
| Semantic search | ~50ms | ~50ms | ~50ms |
| BM25 | ~200ms | ~100ms | ~30ms (cache) |
| Reranking | ~800ms | ~400ms | ~400ms |
| LLM generation | ~8000ms | ~3000ms | ~2000ms |
| **Total** | **~9200ms** | **~3700ms** | **~2560ms** |

---
