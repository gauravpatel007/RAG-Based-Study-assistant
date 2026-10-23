# 001 — Bug Report

**Project:** LLM Study Assistant  
**Analyzed Files:** `backend/app/api/routes.py`, `backend/app/worker.py`, `backend/app/retrieval.py`, `backend/app/providers.py`, `backend/app/models/models.py`, `backend/app/core/static_responses.py`, `backend/app/core/settings.py`  
**Date:** 2026-10-05  
**Total Bugs Found:** 15

---

## Severity Legend

| Label | Meaning |
|---|---|
| 🔴 **CRITICAL** | Causes crash, data loss, or security issue |
| 🟠 **HIGH** | Feature broken or wrong data returned |
| 🟡 **MEDIUM** | Incorrect behavior in edge case |
| 🟢 **LOW** | Code smell, logic flaw, or cosmetic issue |

---

## Bug #1 — `profile.email` Does Not Exist (AttributeError Crash)

**Severity:** 🔴 CRITICAL  
**File:** `backend/app/api/routes.py` — Line 3009

### Description
The `export_user_data` endpoint writes `profile.email` to the ZIP file. However, `UserProfile` does **not** have an `email` column — email is stored on the `User` model. This crashes with `AttributeError` every time a user tries to export their data.

### Root Cause
```python
# routes.py line 3009 — WRONG
"email": profile.email if profile else None,
```
`UserProfile` has no `email` attribute. See `models.py` lines 63–79.

### Fix
```diff
- "email": profile.email if profile else None,
+ "email": user.email,
```

---

## Bug #2 — Static Answer Has Wrong `status` Value

**Severity:** 🟠 HIGH  
**File:** `backend/app/api/routes.py` — Line 474

### Description
When a static response (greeting, "bye", etc.) is generated, the message is saved with `status="completed"`. However, the rest of the codebase uses `status="complete"` (without "d"). The frontend checks for `"complete"` in the SSE `TERMINAL` set, so static responses may never show as "done" to the client.

### Root Cause
```python
# routes.py line 474 — WRONG
answer = Message(..., status="completed", ...)
```

The `TERMINAL` constant on line 49 is:
```python
TERMINAL = {"complete", "failed", "cancelled", "interrupted"}
```

`"completed"` is not in `TERMINAL`.

### Fix
```diff
- answer = Message(chat_id=chat_id, role="assistant", content=static_answer, status="completed", ...)
+ answer = Message(chat_id=chat_id, role="assistant", content=static_answer, status="complete", ...)
```

---

## Bug #3 — `rebuild_vector_index` Uses Invalid Document Status

**Severity:** 🟠 HIGH  
**File:** `backend/app/api/routes.py` — Line 3074

### Description
The `rebuild_vector_index` endpoint sets `doc.status = "processing"`. This is not a valid status in the application — valid statuses are `"queued"`, `"extracting"`, `"indexing"`, `"ready"`, `"failed"`, `"deleting"`, `"cancelled"`. Setting an invalid status means the document will not be picked up by the worker loop.

### Root Cause
```python
# routes.py line 3074 — WRONG
doc.status = "processing"
```

### Fix
```diff
- doc.status = "processing"
+ doc.status = "queued"
```

---

## Bug #4 — `hybrid_retrieve` Returns Early Without Returning `retrieval_stats`

**Severity:** 🔴 CRITICAL  
**File:** `backend/app/retrieval.py` — Lines 193–194, 220–221

### Description
In `hybrid_retrieve`, when `all_chunks_rows` is empty (no chunks in DB) or when `candidate_ids` is empty (no matches), the function returns `[]` (a plain list). But in `worker.py` line 362, the caller unpacks it as:
```python
selected, retrieval_stats = await hybrid_retrieve(...)
```
This causes a `ValueError: not enough values to unpack` crash because a plain list cannot be unpacked into two variables.

### Root Cause
```python
# retrieval.py line 193–194 — WRONG
if not all_chunks_rows:
    return []

# retrieval.py line 220–221 — WRONG
if not candidate_ids:
    return []
```

### Fix
```diff
if not all_chunks_rows:
-    return []
+    return [], {}

if not candidate_ids:
-    return []
+    return [], {}
```

---

## Bug #5 — `admin_dep` Only Checks `username == "admin"` (Hardcoded Privilege)

**Severity:** 🟠 HIGH  
**File:** `backend/app/api/routes.py` — Line 65

### Description
The `admin_dep` dependency grants admin access to any account whose username is literally `"admin"`. This means:
1. Renaming the admin account via Admin → Users breaks admin access permanently.
2. Any user who registers with username `"admin"` would gain full admin access if the original admin account is deleted first.

### Root Cause
```python
# routes.py line 65 — FRAGILE
if not user or user.username != "admin":
    fail(403, "FORBIDDEN", "Admin access required.")
```

### Recommended Fix
Add an `is_admin` boolean column to the `User` model:
```python
# In User model
is_admin = Column(Boolean, default=False, nullable=False)

# In admin_dep
if not user or not user.is_admin:
    fail(403, "FORBIDDEN", "Admin access required.")
```

---

## Bug #6 — Silent Date Parse Failures in RAG Query Filter

**Severity:** 🟡 MEDIUM  
**File:** `backend/app/api/routes.py` — Lines 1352–1360

### Description
The `get_admin_rag_queries_list` endpoint silently ignores invalid date strings in `date_from` / `date_to` parameters. If the client sends a malformed date, no filter is applied and all records are returned, with no error to the client.

### Root Cause
```python
# routes.py lines 1353–1360 — WRONG
try:
    df = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
    query = query.where(RagQueryLog.created_at >= df)
except: pass   # ← swallows bad dates silently
```

### Fix
```python
try:
    df = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
    query = query.where(RagQueryLog.created_at >= df)
except ValueError:
    fail(422, "INVALID_DATE", f"Invalid date_from format: {date_from}")
```

---

## Bug #7 — `change_password` Missing `db.commit()`

**Severity:** 🔴 CRITICAL  
**File:** `backend/app/api/routes.py` — Line 2393

### Description
The `change_password` endpoint calls `await db.flush()` at the end but **never calls `await db.commit()`**. This means:
- The new password hash is never saved to the database.
- The user will be unable to log in with their new password (old password still works).
- Revocation of other sessions is also lost.

### Root Cause
```python
# routes.py line 2393 — WRONG, missing db.commit()
await db.flush()
# ← no await db.commit() here!
```

### Fix
```diff
- await db.flush()
+ await db.commit()
```

---

## Bug #8 — `revoke_other_sessions` Missing `db.commit()`

**Severity:** 🟠 HIGH  
**File:** `backend/app/api/routes.py` — Line 2415

### Description
The `revoke_other_sessions` endpoint calls `db.flush()` instead of `db.commit()`, so other sessions are **never actually revoked** in the database. Users think their other devices are logged out, but they are not.

### Root Cause
```python
# routes.py line 2415 — WRONG
await db.flush()
# ← should be db.commit()
```

### Fix
```diff
- await db.flush()
+ await db.commit()
```

---

## Bug #9 — `update_profile` and `update_preferences` Missing `db.commit()`

**Severity:** 🔴 CRITICAL  
**File:** `backend/app/api/routes.py` — Lines 2242, 2264

### Description
Both `update_profile` (line 2242) and `update_preferences` (line 2264) call `await db.flush()` but never call `await db.commit()`. All profile and preference changes are **lost on the next request** — they appear to succeed (HTTP 200 with new data) but nothing is actually saved.

### Root Cause
```python
# routes.py line 2242 — WRONG
await db.flush()   # Missing commit!
return profile_json(user, profile)

# routes.py line 2264 — WRONG
await db.flush()   # Missing commit!
return preferences_json(prefs)
```

### Fix
```diff
# update_profile (line 2242)
- await db.flush()
+ await db.commit()
return profile_json(user, profile)

# update_preferences (line 2264)
- await db.flush()
+ await db.commit()
return preferences_json(prefs)
```

---

## Bug #10 — `static_responses.py` Uses Local Server Time Instead of User Time

**Severity:** 🟡 MEDIUM  
**File:** `backend/app/core/static_responses.py` — Lines 66, 70, 74

### Description
The "What time is it?", "What is today's date?", and "What day is today?" static responses use `datetime.now()` which returns the **server's local time**, not the user's local time. If the server runs in UTC and the user is in IST (+5:30), the time shown will be wrong by 5.5 hours.

### Root Cause
```python
# static_responses.py line 66 — Uses server local time, not user's time
current_time = datetime.now().strftime("%I:%M %p")
```

### Fix
Either remove time-based responses from the static handler (let the LLM handle it with a disclaimer), or add a note:
```python
current_time = datetime.utcnow().strftime("%I:%M %p")
return f"The current server time is {current_time} UTC. Your local time may differ."
```

---

## Bug #11 — `admin_delete_document` Passes Fake `User` Object to `tombstone_doc`

**Severity:** 🟠 HIGH  
**File:** `backend/app/api/routes.py` — Line 1725

### Description
The `delete_admin_document` route constructs a fake, minimal `User` object with only an `id` and passes it to `tombstone_doc`. This is not a real SQLAlchemy ORM instance, meaning any future code that accesses other User attributes will get `None` or crash.

### Root Cause
```python
# routes.py line 1725 — WRONG
job = await tombstone_doc(db, User(id=doc.user_id), doc)
```

### Fix
```python
owner = await db.get(User, doc.user_id)
if not owner:
    fail(404, "NOT_FOUND", "Document owner not found.")
job = await tombstone_doc(db, owner, doc)
```

---

## Bug #12 — `get_all_users` Admin Endpoint Omits `email` Field

**Severity:** 🟡 MEDIUM  
**File:** `backend/app/api/routes.py` — Lines 1063–1064

### Description
The admin "list all users" endpoint omits `email` and `deleted_at`, so the admin panel cannot show email addresses or soft-deleted users without making an extra detail call per user.

### Root Cause
```python
# routes.py line 1063–1064 — Incomplete fields
return {"users": [fields(u, "id", "username", "is_active", "created_at") for u in users]}
```

### Fix
```python
return {"users": [fields(u, "id", "username", "email", "is_active", "created_at", "deleted_at") for u in users]}
```

---

## Bug #13 — Chat Rename (`PATCH /chats/{chat_id}`) Missing `db.commit()`

**Severity:** 🔴 CRITICAL  
**File:** `backend/app/api/routes.py` — Lines 435–441

### Description
The `rename` endpoint updates `chat.title` but **never calls `db.commit()`**. The new chat title appears in the current response but is **never saved** to the database — on next page reload, the old title comes back.

### Root Cause
```python
# routes.py line 435–441 — WRONG
async def rename(chat_id: UUID, body: ChatRenameRequest, ...):
    chat = await owned_chat(db, user, chat_id, lock=True)
    if not body.title.strip():
        fail(422, "INVALID_TITLE", "A title is required.")
    chat.title = body.title.strip()
    return fields(chat, "id", "title")
    # ← No db.commit() anywhere!
```

### Fix
```diff
chat.title = body.title.strip()
+ await db.commit()
return fields(chat, "id", "title")
```

---

## Bug #14 — BM25 Index Rebuilt from Scratch on Every Query

**Severity:** 🟡 MEDIUM  
**File:** `backend/app/retrieval.py` — Lines 70–100

### Description
The `_bm25_search` function builds a brand-new in-memory BM25 index from **all chunks in the database** on every single query. With a large corpus (1000+ chunks), this adds 200–500ms per query and grows worse as the corpus grows.

### Root Cause
```python
# retrieval.py lines 83–88 — No caching, rebuilt every call
def _build_and_score():
    tokenized_corpus = [c.text.lower().split() for c in chunks]
    bm25 = BM25Okapi(tokenized_corpus)  # Built fresh every call!
    tokenized_query = query.lower().split()
    scores = bm25.get_scores(tokenized_query)
    return scores
```

### Fix
Cache the BM25 index per `(chat_id, corpus_version)` using an `OrderedDict` LRU cache. See the LLM Speed Optimization Plan for the full implementation.

---

## Bug #15 — `delete_avatar` Does Not Validate Storage Path Before Deletion

**Severity:** 🟡 MEDIUM  
**File:** `backend/app/api/routes.py` — Lines 2343–2358

### Description
The `delete_avatar` endpoint deletes `old_path` without first verifying that it is within `settings.STORAGE_ROOT`. While the path is built from `profile.avatar_key` (which is set internally), a corrupted `avatar_key` value could potentially cause a file outside the storage root to be deleted.

### Root Cause
```python
# routes.py line 2356 — Missing path validation
if old_path.is_file():
    old_path.unlink(missing_ok=True)  # No .is_relative_to() check!
```

### Fix
```python
if old_path.is_file() and old_path.resolve().is_relative_to(settings.STORAGE_ROOT.resolve()):
    old_path.unlink(missing_ok=True)
```

---

## Summary Table

| # | Severity | File | Line(s) | Issue |
|---|---|---|---|---|
| 1 | 🔴 CRITICAL | `routes.py` | 3009 | `profile.email` doesn't exist → AttributeError crash on data export |
| 2 | 🟠 HIGH | `routes.py` | 474 | Static answer uses `status="completed"` instead of `"complete"` |
| 3 | 🟠 HIGH | `routes.py` | 3074 | Rebuild index sets invalid `doc.status = "processing"` |
| 4 | 🔴 CRITICAL | `retrieval.py` | 193, 220 | `hybrid_retrieve` returns `[]` instead of `([], {})` → unpack crash |
| 5 | 🟠 HIGH | `routes.py` | 65 | Admin check hardcoded to `username == "admin"` (security fragile) |
| 6 | 🟡 MEDIUM | `routes.py` | 1352–1360 | Silent date parse failure in RAG query filter |
| 7 | 🔴 CRITICAL | `routes.py` | 2393 | `change_password` uses `flush()` not `commit()` — password never saved |
| 8 | 🟠 HIGH | `routes.py` | 2415 | `revoke_other_sessions` uses `flush()` not `commit()` — sessions not revoked |
| 9 | 🔴 CRITICAL | `routes.py` | 2242, 2264 | `update_profile` + `update_preferences` use `flush()` not `commit()` |
| 10 | 🟡 MEDIUM | `static_responses.py` | 66–75 | Time/date uses server local time not UTC |
| 11 | 🟠 HIGH | `routes.py` | 1725 | `tombstone_doc` receives fake `User(id=...)` object in admin delete |
| 12 | 🟡 MEDIUM | `routes.py` | 1063 | Admin user list omits `email` and `deleted_at` fields |
| 13 | 🔴 CRITICAL | `routes.py` | 441 | Chat rename missing `db.commit()` — title never saved |
| 14 | 🟡 MEDIUM | `retrieval.py` | 70–100 | BM25 index rebuilt from scratch on every query (no caching) |
| 15 | 🟡 MEDIUM | `routes.py` | 2356 | `delete_avatar` skips storage-root path validation |

---

## Priority Fix Order

### Immediate (Fix Today)
1. **Bug #4** — Unpack crash in retrieval (breaks all RAG queries when no chunks found)
2. **Bug #9** — Profile & Preferences never saved (critical UX regression)
3. **Bug #13** — Chat rename never saved
4. **Bug #7** — Password change never saved (security)
5. **Bug #1** — Data export crashes for every user

### Soon (Fix This Week)
6. **Bug #8** — Session revocation silently broken
7. **Bug #2** — Static response status wrong
8. **Bug #3** — Rebuild index broken
9. **Bug #11** — Fake User object in admin delete

### Improvement (Fix When Possible)
10. **Bug #5** — Admin privilege hardcoding
11. **Bug #6** — Silent date filter failure
12. **Bug #10** — Server time in static responses
13. **Bug #12** — Admin user list missing fields
14. **Bug #14** — BM25 caching (performance)
15. **Bug #15** — Avatar delete path validation

---

*Generated by automated codebase analysis — 2026-10-05*
