"""
Hybrid RAG retrieval pipeline:
  1. Semantic search  (ChromaDB — dense embedding)
  2. BM25 keyword     (rank-bm25 — sparse keyword)
  3. Reciprocal Rank Fusion (merge + deduplicate)
  4. Cross-Encoder reranking (ms-marco-MiniLM)
  5. Return top-N DocumentChunk objects
"""
import asyncio
import logging
import time
from uuid import UUID

from sqlalchemy import select
from app import providers
from app.core.database import async_session_factory
from app.core.settings import settings
from app.core.dynamic_settings import dyn_settings
from app.models.models import Document, DocumentChunk

log = logging.getLogger("study.retrieval")


# ──────────────────────────────────────────────────────────────────
# 1. SEMANTIC SEARCH  (existing ChromaDB path, extracted here)
# ──────────────────────────────────────────────────────────────────
async def _semantic_search(
    query: str,
    user_id,
    chat_id,
    document_ids: list[str],
    versions: list[str],
    top_k: int,
    _timing: dict | None = None,
) -> list[tuple[str, float]]:
    """Returns list of (chunk_id_str, distance) sorted ascending (lower = better)."""
    t0 = time.perf_counter()
    vector = (await asyncio.to_thread(providers.embed, [query]))[0]
    if _timing is not None:
        _timing["embed_ms"] = int((time.perf_counter() - t0) * 1000)

    t1 = time.perf_counter()
    index = await asyncio.to_thread(providers.collection)
    scope = {
        "$and": [
            {"user_id": str(user_id)},
            {"chat_id": str(chat_id)},
            {"document_id": {"$in": document_ids}},
            {"index_version": {"$in": versions}},
        ]
    }
    result = await asyncio.to_thread(
        index.query,
        query_embeddings=[vector],
        where=scope,
        n_results=top_k,
        include=["distances"],
    )
    if _timing is not None:
        _timing["vector_search_ms"] = int((time.perf_counter() - t1) * 1000)
        
    if not result or not result.get("ids") or not result["ids"][0]:
        return []
    return list(zip(result["ids"][0], result["distances"][0]))


# ──────────────────────────────────────────────────────────────────
# 2. BM25 KEYWORD SEARCH  (rank-bm25)
# ──────────────────────────────────────────────────────────────────
async def _bm25_search(
    query: str,
    chunks: list[DocumentChunk],
    top_k: int,
    _timing: dict | None = None,
) -> list[tuple[str, float]]:
    """
    Builds an in-memory BM25 index from the given chunks and scores them.
    Returns list of (chunk_id_str, bm25_score) sorted descending (higher = better).
    """
    t0 = time.perf_counter()
    from rank_bm25 import BM25Okapi

    def _build_and_score():
        # Simple whitespace tokenizer — good enough for technical text
        tokenized_corpus = [c.text.lower().split() for c in chunks]
        bm25 = BM25Okapi(tokenized_corpus)
        tokenized_query = query.lower().split()
        scores = bm25.get_scores(tokenized_query)
        return scores

    scores = await asyncio.to_thread(_build_and_score)

    # Pair chunk ids with scores, sort by score descending
    paired = [(str(chunks[i].id), float(scores[i])) for i in range(len(chunks))]
    paired.sort(key=lambda x: x[1], reverse=True)
    
    if _timing is not None:
        _timing["bm25_ms"] = int((time.perf_counter() - t0) * 1000)
        
    return paired[:top_k]


# ──────────────────────────────────────────────────────────────────
# 3. RECIPROCAL RANK FUSION (RRF)
# ──────────────────────────────────────────────────────────────────
_RRF_K = 60  # standard RRF constant; higher = less steep rank penalty

def _reciprocal_rank_fusion(
    semantic_results: list[tuple[str, float]],  # (chunk_id, distance)  lower = better
    bm25_results: list[tuple[str, float]],       # (chunk_id, score)    higher = better
    _timing: dict | None = None,
) -> list[tuple[str, float]]:
    """
    Merge two ranked lists using Reciprocal Rank Fusion.
    Returns (chunk_id, rrf_score) sorted descending — higher RRF score = more relevant.
    """
    t0 = time.perf_counter()
    scores: dict[str, float] = {}

    for rank, (chunk_id, _) in enumerate(semantic_results):
        scores[chunk_id] = scores.get(chunk_id, 0.0) + 1.0 / (_RRF_K + rank + 1)

    for rank, (chunk_id, _) in enumerate(bm25_results):
        scores[chunk_id] = scores.get(chunk_id, 0.0) + 1.0 / (_RRF_K + rank + 1)

    merged = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    
    if _timing is not None:
        _timing["rrf_ms"] = int((time.perf_counter() - t0) * 1000)
        
    return merged


# ──────────────────────────────────────────────────────────────────
# 4. CROSS-ENCODER RERANKING
# ──────────────────────────────────────────────────────────────────
async def _rerank(
    query: str,
    candidates: list[DocumentChunk],
    _timing: dict | None = None,
) -> list[tuple[DocumentChunk, float]]:
    """
    Score each (query, chunk.text) pair with the cross-encoder.
    Returns list of (chunk, score) sorted by score descending.
    """
    t0 = time.perf_counter()
    passages = [c.text for c in candidates]
    scores = await asyncio.to_thread(providers.rerank, query, passages)
    paired = list(zip(candidates, scores))
    paired.sort(key=lambda x: x[1], reverse=True)
    
    if _timing is not None:
        _timing["rerank_ms"] = int((time.perf_counter() - t0) * 1000)
        
    return paired


# ──────────────────────────────────────────────────────────────────
# 5. MAIN ENTRY POINT
# ──────────────────────────────────────────────────────────────────
async def hybrid_retrieve(
    query: str,
    user_id,
    chat_id,
    document_ids: list[str],
    versions: list[str],
    top_n: int | None = None,
    _timing: dict | None = None,
) -> tuple[list[tuple[str, DocumentChunk, Document]], dict]:
    """
    Full hybrid retrieval pipeline. Returns (selected_chunks, retrieval_stats).
    selected_chunks is a list of (label, chunk, doc) tuples.

    Raises RuntimeError on scope violations (same contract as original code).
    """
    semantic_top_k = int(await dyn_settings.get("SEMANTIC_TOP_K", settings.SEMANTIC_TOP_K))
    bm25_top_k = int(await dyn_settings.get("BM25_TOP_K", settings.BM25_TOP_K))
    reranker_enabled = str(await dyn_settings.get("RERANKER_ENABLED", settings.RERANKER_ENABLED)).lower() in ("true", "1")
    bm25_enabled = str(await dyn_settings.get("BM25_ENABLED", settings.BM25_ENABLED)).lower() in ("true", "1")
    final_top_n = top_n or int(await dyn_settings.get("RERANKER_TOP_N", settings.RERANKER_TOP_N))

    # ── Fetch all candidate chunks from DB (needed for BM25 + reranker) ──
    async with async_session_factory() as db:
        all_chunks_rows = (await db.scalars(
            select(DocumentChunk)
            .where(
                DocumentChunk.document_id.in_([UUID(d) for d in document_ids]),
                DocumentChunk.index_version.in_([UUID(v) for v in versions]),
            )
            .order_by(DocumentChunk.document_id, DocumentChunk.chunk_index)
        )).all()

    if not all_chunks_rows:
        return []

    chunk_map: dict[str, DocumentChunk] = {str(c.id): c for c in all_chunks_rows}

    # ── Stage 1: Parallel semantic + BM25 search ──
    tasks = [
        _semantic_search(query, user_id, chat_id, document_ids, versions, semantic_top_k, _timing),
    ]
    if bm25_enabled and len(all_chunks_rows) <= settings.BM25_MAX_CHUNKS:
        tasks.append(_bm25_search(query, list(all_chunks_rows), bm25_top_k, _timing))

    results = await asyncio.gather(*tasks, return_exceptions=True)
    semantic_results = results[0] if not isinstance(results[0], Exception) else []
    bm25_results = results[1] if len(results) > 1 and not isinstance(results[1], Exception) else []

    if isinstance(results[0], Exception):
        log.warning("Semantic search failed: %s", results[0])
    if len(results) > 1 and isinstance(results[1], Exception):
        log.warning("BM25 search failed: %s", results[1])

    # ── Stage 2: RRF merge ──
    merged = _reciprocal_rank_fusion(semantic_results, bm25_results, _timing)

    # Collect only IDs that exist in our scope
    candidate_ids = [cid for cid, _ in merged if cid in chunk_map]

    if not candidate_ids:
        return []

    # ── Stage 3: Cross-encoder reranking ──
    candidate_chunks = [chunk_map[cid] for cid in candidate_ids]

    if reranker_enabled:
        try:
            reranked = await _rerank(query, candidate_chunks, _timing)
            # Filter out chunks with very negative reranker scores (clearly irrelevant)
            reranked = [(c, s) for c, s in reranked if s > -10.0]
            final_chunks = [c for c, _ in reranked[:final_top_n]]
        except Exception as e:
            log.warning("Reranker failed: %s. Falling back to RRF.", e)
            final_chunks = candidate_chunks[:final_top_n]
    else:
        # Fallback: use RRF order without reranking
        final_chunks = candidate_chunks[:final_top_n]

    # ── Stage 4: Adjacency deduplication + scope validation ──
    selected: list[tuple[str, DocumentChunk, Document]] = []
    async with async_session_factory() as db:
        doc_cache: dict[str, Document] = {}
        for chunk in final_chunks:
            doc_id_str = str(chunk.document_id)
            if doc_id_str not in doc_cache:
                doc = await db.get(Document, chunk.document_id)
                doc_cache[doc_id_str] = doc
            doc = doc_cache[doc_id_str]

            if (
                not doc
                or doc.user_id != user_id
                or doc.chat_id != chat_id
                or doc.deleted_at
                or doc.status != "ready"
                or str(doc.id) not in document_ids
                or chunk.index_version != doc.active_index_version
            ):
                raise RuntimeError("SCOPE_MISMATCH")

            # Skip if adjacent chunk from same document already in result
            if any(
                c.document_id == chunk.document_id and abs(c.chunk_index - chunk.chunk_index) <= 1
                for _, c, _ in selected
            ):
                continue

            selected.append((f"S{len(selected) + 1}", chunk, doc))

    log.info(
        "hybrid_retrieve: semantic=%d bm25=%d merged=%d reranked=%d selected=%d",
        len(semantic_results), len(bm25_results), len(merged),
        len(final_chunks), len(selected),
    )
    
    retrieval_stats = {
        "semantic_results": len(semantic_results),
        "bm25_results": len(bm25_results),
        "merged_results": len(merged),
        "reranked_results": len(final_chunks),
        "final_sources": len(selected),
    }
    
    return selected, retrieval_stats
