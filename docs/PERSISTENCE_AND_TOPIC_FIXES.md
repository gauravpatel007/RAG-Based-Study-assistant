# PDF retrieval and topic extraction fixes

## What caused the missing answers

The previous development launcher passed `../data/chroma` to Chroma. Its meaning
changed with the shell's working directory. A later launch opened a different
database: the app still showed the PDFs as ready in PostgreSQL, but that Chroma
database did not contain their vectors. This was a storage-location problem,
not a four-hour expiration of the PDFs.

The launcher now resolves `STORAGE_ROOT/chroma` to an absolute path through the
same project settings used by the backend. `.env` is read from the project root
regardless of the working directory. Relative storage settings are resolved
against the project root too.

Before answering a textbook question, the worker checks the selected documents'
active chunk IDs against Chroma. Missing vectors are regenerated from the saved
PostgreSQL chunks, without uploading, extracting, or OCRing the PDFs again.
Ownership, chat scope, active index versions, and deletion are checked during
recovery. Recovery failure is reported as a processing error instead of a
misleading “no supporting information” answer.

The original Chroma store was restored and the 54 chunks belonging to newer
uploads were added to it. All five ready PDFs were checked after restarting
Chroma: SQL and vector counts matched (53, 53, 26, 1, and 174).

## Topic extraction

- Small ranges use one context-bounded request instead of an arbitrary maximum
  of three chunks per request.
- Compact schema-constrained JSON limits verbose explanations and prevents blind
  full-request retries. The prompt requests only facts supported by the excerpts.
- The requested topic count is respected as an upper bound; sparse pages can
  legitimately produce fewer topics.
- Progress includes queue/model/generation stages, elapsed time, and generated
  character count. Page totals are initialized before generation. A page is only
  counted complete after all of its chunks have been analyzed.
- Completed results are cached by document scope, corpus version, model, and
  prompt version. The UI selects the exact cached set returned by the API.
- Model residency is extended to 15 minutes. A cold start still takes longer.
- Each topic-generation batch has a 90-second total deadline and remains
  cancellable. A deadline failure does not publish partial topics.

On the user's two slide pages, the original job took about 44 seconds. The
updated full API/worker job took 25.1 seconds. An isolated warm-model generation
took 12.6 seconds. These measurements are specific to this machine and input;
they are not a guarantee for other PDFs or a cold model.

## Running and recovery

Run `scripts/start-dev.ps1` from PowerShell. Services default to hidden windows;
use `-ShowWindows` when live terminal windows are wanted. `-NoWindow` remains
supported. `scripts/stop-dev.ps1` stops only launchers tracked for this project,
including their child processes, after checking process identity and start time.
Use `scripts/start-dev.ps1 -Services worker` to restart only the AI worker after
editing its code. Standalone textbook questions now omit unnecessary old replies
from their prompts and request a direct answer of at most 150 words.
Qwen3 requests also include its supported `/no_think` switch: the installed model
template was producing lengthy analysis despite `think: false`. This preserves
the output budget for the answer. See the [official Qwen3 model card](https://huggingface.co/Qwen/Qwen3-4B).

For an explicit full vector audit, stop the worker and run from `backend`:

```powershell
.venv/Scripts/python.exe -m app.vector_recovery
```

Normal questions repair their selected scope automatically. The full audit takes
the worker's advisory lock to prevent competing maintenance. Back up PostgreSQL,
the uploaded PDFs, and the project data directory; Chroma alone is not a backup
of users, messages, or extracted source text.

## Verification

- Backend tests cover lost vectors, incomplete indexes with the same record
  count, cross-chat scope, deleted documents, deletion during recovery, progress
  before inference, cancellation, caching, and complete-page accounting.
- The React production build passes.
- Live persistence was verified across a service restart, and the original
  Attention PDF returned relevant page matches again.
- The Important Topics page rendered the completed results without browser
  runtime errors.

Ollama API references used for structured output and model residency:
[structured outputs](https://docs.ollama.com/capabilities/structured-outputs) and
[chat API](https://docs.ollama.com/api/chat).
