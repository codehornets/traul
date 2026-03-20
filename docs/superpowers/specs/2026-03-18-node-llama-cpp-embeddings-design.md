# Design: Replace Ollama with node-llama-cpp for embeddings

**Date:** 2026-03-18
**Status:** Review

## Problem

Ollama's snowflake-arctic-embed2 has a critical bug: every other call takes ~6s due to output buffer reallocation (ollama/ollama#14314). Average latency is ~3.5s/query. node-llama-cpp loads GGUF models in-process — no HTTP overhead, no buffer bug, consistent ~80ms/query.

## Architecture (Option C — formatting in llama.ts)

Three layers:

```
search.ts / embed.ts          ← callers
        ↓
src/lib/embeddings.ts          ← public API, routing (llama vs ollama fallback)
        ↓
src/lib/llama.ts               ← node-llama-cpp backend, model-specific formatting
```

### src/lib/llama.ts — LlamaCpp wrapper

Singleton pattern (one `Llama` instance per process), lazy model loading on first call.

**API:**
- `embedQuery(text: string) → Promise<Float32Array>` — adds instruction prefix, returns 1024-dim vector
- `embedDoc(text: string) → Promise<Float32Array>` — no prefix, returns 1024-dim vector
- `embedDocBatch(texts: string[]) → Promise<(Float32Array | null)[]>` — batch document embedding
- `dispose() → Promise<void>` — cleanup

**Model-specific formatting (Qwen3-Embedding):**
- Query: `Instruct: Retrieve relevant documents for the given query\nQuery: {text}`
- Document: `{text}` (raw, no prefix)
- Detection: regex `/qwen.*embed/i` on model URI

**Model resolution:**
- Uses `resolveModelFile()` from node-llama-cpp — auto-downloads from HuggingFace on first use
- Cache dir: `~/.cache/traul/models/`
- Default model: `hf:Qwen/Qwen3-Embedding-0.6B-GGUF/Qwen3-Embedding-0.6B-Q8_0.gguf`
- Configurable via `TRAUL_EMBED_MODEL` env var
- **Format change:** `TRAUL_EMBED_MODEL` now expects a HuggingFace GGUF URI (e.g. `hf:Qwen/...`), not an Ollama model name. Old Ollama-style values (e.g. `snowflake-arctic-embed2`) are invalid and will cause llama.ts to fail, triggering the Ollama fallback path. This is intentional — if users have the old env var set, they get Ollama behavior until they update it.
- Download progress is logged to stderr so users see the 639MB download happening

**Truncation strategy:**
- Pre-truncate texts to `MAX_TEXT_LENGTH` (4000 chars) before passing to node-llama-cpp, same as current Ollama path
- Qwen3-Embedding-0.6B has 8192 token context. 4000 chars ≈ 2000-4000 tokens (depending on script), well within limits
- If node-llama-cpp still errors on a text, retry with progressive truncation (`TRUNCATE_LIMITS = [2000, 1000]`), same cascade as current code
- For `embedDocBatch`: if a single item fails, return `null` for that item and call `onSkip` callback (same semantics as current `embedBatch`)

**Idle unload:** Timer (5min) disposes embedding context after inactivity. Timer uses `.unref()` so it doesn't keep the process alive.

### src/lib/embeddings.ts — public API (modified)

Stays as the public interface. Routes to llama.ts by default, falls back to Ollama on failure.

**Exports (unchanged signatures where possible):**
- `embed(text: string) → Promise<Float32Array>` — document embedding (calls `llama.embedDoc`)
- `embedQuery(text: string) → Promise<Float32Array>` — **new**, query embedding (calls `llama.embedQuery`)
- `embedBatch(texts: string[], onSkip?) → Promise<(Float32Array | null)[]>` — document batch (calls `llama.embedDocBatch`)
- `vecToBytes(vec: Float32Array) → Uint8Array` — unchanged
- `EMBED_DIMS`, `BATCH_SIZE`, `MAX_TEXT_LENGTH` — unchanged constants

**Ollama fallback:** If llama.ts throws on initialization (model download fails, node-llama-cpp incompatible with Bun, invalid GGUF URI), log a warning to stderr and fall back to Ollama HTTP for all subsequent calls in that process.

Fallback behavior per function:
- `embed(text)` → calls Ollama `/api/embed` with raw text (no formatting)
- `embedQuery(text)` → calls Ollama `/api/embed` with raw text (no instruction prefix — Ollama models handle this internally or don't need it)
- `embedBatch(texts, onSkip)` → calls Ollama `/api/embed` in batches, same error handling as current code

The fallback is determined once at initialization time (not per-call). A process-level flag tracks whether llama.ts initialized successfully.

### src/commands/search.ts — caller change

Line 48: `embed(query)` → `embedQuery(query)` (new import). This is the only caller that needs the query instruction prefix.

Line 56: Update warning message from `"Ollama unavailable"` to `"Embedding unavailable"` (backend-agnostic).

### src/commands/embed.ts — no change needed

Already calls `embedBatch()` which defaults to document mode. No formatting needed.

## Dependency

- `bun add node-llama-cpp`
- Must verify compatibility with Bun runtime before proceeding

## Model choice

Primary: `Qwen3-Embedding-0.6B-Q8_0.gguf` (639MB, 1024-dim)
- Best multilingual quality at this size
- 1024-dim matches existing `vec_messages` schema — no migration needed

## Re-embedding

After switching models, all existing embeddings must be regenerated (different model = different vector space). The existing `traul embed` command with `--limit 0` already handles this. Combined with `traul reset-embed` to clear existing vectors, this covers the migration:

```bash
traul reset-embed && traul embed --limit 0
```

No new command needed.

## What does NOT change

- `vec_messages` / `vec_chunks` table schema (1024 dimensions)
- Search algorithm (hybridSearchAll, ftsSearchAll, RRF fusion)
- Connector logic (beyond using embedBatch which already defaults to document mode)
- `vecToBytes()` utility
- Chunking logic

## Test plan

Tests are split into **unit tests** (mocked, fast, run in CI) and **integration tests** (need real model, slow, run manually).

### Unit tests

#### test/lib/llama.test.ts (new)

Pure formatting/detection tests (no model needed):
- `isQwen3EmbeddingModel()` returns true for Qwen GGUF URIs, false for others
- `formatQuery()` adds instruction prefix: `Instruct: Retrieve relevant documents...\nQuery: {text}`
- `formatDoc()` returns raw text without prefix
- `formatQuery()` for non-Qwen model returns raw text (no prefix)

Mocked model tests (mock node-llama-cpp imports):
- Singleton: `getLlamaCpp()` returns same instance on repeated calls
- Lazy load: model not loaded until first `embedDoc()` call
- `embedDoc()` returns Float32Array of length 1024
- `embedDoc()` produces different vectors for different inputs
- `embedDocBatch()` returns array of Float32Array, one per input
- `embedDocBatch([])` returns empty array
- `embedDocBatch()` returns `null` for individual items that fail, calls `onSkip`
- Graceful error with clear message when GGUF model file not found
- Idle timer: after timeout, embedding context is disposed
- Truncation: texts > `MAX_TEXT_LENGTH` are truncated before embedding

#### test/lib/embeddings.test.ts (rewrite)

**Mocking strategy:** Mock `llama.ts` module exports (not `fetch`). For Ollama fallback tests, mock llama.ts to throw on init, then mock `fetch` for Ollama path.

Primary path (llama.ts mocked to return fake vectors):
- `embed(text)` calls `llama.embedDoc(text)` and returns Float32Array
- `embedQuery(text)` calls `llama.embedQuery(text)` and returns Float32Array
- `embedBatch(texts)` calls `llama.embedDocBatch(texts)` and returns array
- `embedBatch()` with `onSkip` — callback fires for null items from llama
- `vecToBytes()` produces correct Uint8Array from Float32Array (unchanged)
- Pre-truncation: texts > 4000 chars are truncated before passing to llama

Ollama fallback path (llama.ts mocked to throw):
- `embed()` falls back to Ollama HTTP, logs warning to stderr
- `embedQuery()` falls back to Ollama HTTP (no instruction prefix)
- `embedBatch()` falls back to Ollama HTTP with same batch/retry logic
- Existing fetch-mock tests from current embeddings.test.ts migrate here

#### test/commands/search.test.ts (update if exists)
- Search imports and calls `embedQuery()`, not `embed()`
- Fallback warning says "Embedding unavailable" not "Ollama unavailable"

### Integration tests (manual, require model download)

Tagged with `// @integration` or in a separate `test/integration/` directory. Not run by `bun test` by default.

#### test/integration/llama.integration.test.ts
- `embedDoc()` returns Float32Array of length 1024 with real model
- `embedDoc("hello")` vs `embedDoc("goodbye")` produce different vectors (cosine similarity < 0.95)
- `embedDoc("deployment failed")` vs `embedDoc("deploy error")` produce similar vectors (cosine similarity > 0.7)
- `embedQuery("search term")` produces different vector than `embedDoc("search term")` (prefix changes the embedding)
- `embedDocBatch()` with 100 items completes in < 10s
- Model auto-downloads on first call if not cached

#### test/integration/search.integration.test.ts
- `traul search "метрики"` completes in < 1s (warm model)
- `traul search "deployment issues"` returns relevant results
- `traul search "метрики" --fts` still works (unchanged path)
- No Ollama process needed

## Risks

1. **node-llama-cpp + Bun compatibility** — node-llama-cpp uses native addons. May not work with Bun. Spec says: if it doesn't work, document and stop.
2. **First-run download** — 639MB model download on first use. User needs to know this is happening.
3. **Memory** — GGUF model loaded in-process uses ~700MB RAM. Idle unload mitigates this for long-running daemon.
4. **Model URI regex fragility** — Formatting detection uses `/qwen.*embed/i` on the model URI. Renaming the GGUF file breaks detection. Acceptable tradeoff: the default URI is hardcoded and most users won't rename files. If needed later, can add explicit `TRAUL_EMBED_FORMAT=qwen3|raw` env var.
5. **Process cleanup** — `dispose()` is called via idle timer only. For CLI commands (sync, search), the process exits before the timer fires, and OS reclaims memory. No `process.on('exit')` handler needed.
