# node-llama-cpp Embeddings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Ollama HTTP embeddings with in-process node-llama-cpp for ~50x faster, more reliable embedding generation.

**Architecture:** Three layers — `llama.ts` (node-llama-cpp singleton wrapper), `embeddings.ts` (public API with llama-first + Ollama fallback), and callers (`search.ts`, `embed.ts`). Formatting logic (Qwen3 instruction prefix) lives in `llama.ts`.

**Tech Stack:** node-llama-cpp, Bun, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-18-node-llama-cpp-embeddings-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/llama.ts` | node-llama-cpp singleton, model loading, formatting, embed API |
| Create | `test/lib/llama.test.ts` | Unit tests for llama.ts (mocked) |
| Modify | `src/lib/embeddings.ts` | Route to llama.ts, Ollama fallback, add `embedQuery()` |
| Modify | `test/lib/embeddings.test.ts` | Rewrite: mock llama.ts instead of fetch |
| Modify | `src/commands/search.ts:3,48,56` | Use `embedQuery()`, update warning |
| Modify | `src/db/migrations.ts:2,40` | Update EMBED_MODEL import for new default |

---

### Task 1: Add node-llama-cpp dependency

- [ ] **Step 1: Install node-llama-cpp**

```bash
bun add node-llama-cpp
```

- [ ] **Step 2: Verify it loads in Bun**

```bash
bun -e "const { getLlama } = require('node-llama-cpp'); console.log('ok')"
```

Expected: `ok` — if this fails, the spec says to document and stop.

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lockb
git commit -m "chore: add node-llama-cpp dependency"
```

---

### Task 2: Create llama.ts — formatting helpers (pure functions, no model needed)

**Files:**
- Create: `src/lib/llama.ts`
- Create: `test/lib/llama.test.ts`

- [ ] **Step 1: Write failing tests for formatting helpers**

```typescript
// test/lib/llama.test.ts
import { describe, it, expect } from "bun:test";
import { isQwenEmbeddingModel, formatQuery, formatDoc } from "../../src/lib/llama";

const QWEN_URI = "hf:Qwen/Qwen3-Embedding-0.6B-GGUF/Qwen3-Embedding-0.6B-Q8_0.gguf";
const OTHER_URI = "hf:BAAI/bge-small-en-v1.5-GGUF/bge-small-en-v1.5-q8_0.gguf";

describe("isQwenEmbeddingModel", () => {
  it("returns true for Qwen GGUF URIs", () => {
    expect(isQwenEmbeddingModel(QWEN_URI)).toBe(true);
  });

  it("returns true case-insensitively", () => {
    expect(isQwenEmbeddingModel("hf:qwen/QWEN3-EMBEDDING-0.6B")).toBe(true);
  });

  it("returns false for non-Qwen URIs", () => {
    expect(isQwenEmbeddingModel(OTHER_URI)).toBe(false);
  });
});

describe("formatQuery", () => {
  it("adds instruction prefix for Qwen model", () => {
    expect(formatQuery("test query", QWEN_URI)).toBe(
      "Instruct: Retrieve relevant documents for the given query\nQuery: test query"
    );
  });

  it("returns raw text for non-Qwen model", () => {
    expect(formatQuery("test query", OTHER_URI)).toBe("test query");
  });
});

describe("formatDoc", () => {
  it("returns raw text without prefix", () => {
    expect(formatDoc("some document")).toBe("some document");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test test/lib/llama.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement formatting helpers**

```typescript
// src/lib/llama.ts

// --- Formatting helpers (pure, no model dependency) ---

export function isQwenEmbeddingModel(uri: string): boolean {
  return /qwen.*embed/i.test(uri);
}

export function formatQuery(text: string, modelUri: string): string {
  if (isQwenEmbeddingModel(modelUri)) {
    return `Instruct: Retrieve relevant documents for the given query\nQuery: ${text}`;
  }
  return text;
}

export function formatDoc(text: string): string {
  return text;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test test/lib/llama.test.ts`
Expected: PASS (all 5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/llama.ts test/lib/llama.test.ts
git commit -m "feat: add llama.ts formatting helpers with tests"
```

---

### Task 3: Create llama.ts — singleton model wrapper with embed methods

**Files:**
- Modify: `src/lib/llama.ts`
- Modify: `test/lib/llama.test.ts`

- [ ] **Step 1: Write failing tests for the model wrapper (mocked)**

Append to `test/lib/llama.test.ts`:

```typescript
import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";

// Mock node-llama-cpp before importing llama.ts model functions
// We need to mock at module level

describe("LlamaCpp wrapper", () => {
  // These tests mock node-llama-cpp to avoid downloading a real model.
  // We test the wrapper logic: singleton, lazy loading, truncation, idle unload.

  let llamaMod: typeof import("../../src/lib/llama");

  const fakeVector = new Float32Array(1024).fill(0.1);
  const fakeVector2 = new Float32Array(1024).fill(0.2);

  const mockEmbeddingContext = {
    getEmbeddingFor: mock(() => ({ vector: fakeVector })),
    dispose: mock(() => {}),
  };

  const mockModel = {
    createEmbeddingContext: mock(() => Promise.resolve(mockEmbeddingContext)),
    dispose: mock(() => Promise.resolve()),
  };

  const mockLlama = {
    loadModel: mock(() => Promise.resolve(mockModel)),
  };

  beforeEach(async () => {
    // Reset singleton state between tests
    mock.module("node-llama-cpp", () => ({
      getLlama: mock(() => Promise.resolve(mockLlama)),
      resolveModelFile: mock(() => Promise.resolve("/fake/model.gguf")),
    }));

    // Clear singleton by re-importing
    // Note: Bun's module cache makes this tricky. The implementation
    // should expose a _resetForTesting() function.
    llamaMod = await import("../../src/lib/llama");
    llamaMod._resetForTesting?.();

    mockEmbeddingContext.getEmbeddingFor.mockImplementation(() => ({ vector: fakeVector }));
    mockModel.createEmbeddingContext.mockClear();
    mockModel.dispose.mockClear();
    mockLlama.loadModel.mockClear();
  });

  it("embedDoc returns Float32Array of length 1024", async () => {
    const result = await llamaMod.embedDoc("hello world");
    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(1024);
  });

  it("embedDoc produces different vectors for different inputs", async () => {
    let callCount = 0;
    mockEmbeddingContext.getEmbeddingFor.mockImplementation(() => {
      callCount++;
      return { vector: callCount === 1 ? fakeVector : fakeVector2 };
    });

    const v1 = await llamaMod.embedDoc("hello");
    const v2 = await llamaMod.embedDoc("goodbye");
    expect(v1).not.toEqual(v2);
  });

  it("embedQuery adds instruction prefix for Qwen model", async () => {
    let capturedText = "";
    mockEmbeddingContext.getEmbeddingFor.mockImplementation((text: string) => {
      capturedText = text;
      return { vector: fakeVector };
    });

    await llamaMod.embedQuery("search term");
    expect(capturedText).toContain("Instruct: Retrieve relevant documents");
    expect(capturedText).toContain("Query: search term");
  });

  it("embedDocBatch returns array of Float32Array", async () => {
    const results = await llamaMod.embedDocBatch(["a", "b", "c"]);
    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r).toBeInstanceOf(Float32Array);
    }
  });

  it("embedDocBatch returns empty array for empty input", async () => {
    const results = await llamaMod.embedDocBatch([]);
    expect(results).toHaveLength(0);
  });

  it("embedDocBatch returns null for individual failures and calls onSkip", async () => {
    let callIdx = 0;
    mockEmbeddingContext.getEmbeddingFor.mockImplementation(() => {
      callIdx++;
      if (callIdx === 2) throw new Error("bad text");
      return { vector: fakeVector };
    });

    const skipped: number[] = [];
    const results = await llamaMod.embedDocBatch(
      ["ok", "bad", "ok"],
      (idx) => skipped.push(idx),
    );
    expect(results).toHaveLength(3);
    expect(results[0]).toBeInstanceOf(Float32Array);
    expect(results[1]).toBeNull();
    expect(results[2]).toBeInstanceOf(Float32Array);
    expect(skipped).toEqual([1]);
  });

  it("lazy loads model on first call, not on import", async () => {
    expect(mockLlama.loadModel).not.toHaveBeenCalled();
    await llamaMod.embedDoc("trigger load");
    expect(mockLlama.loadModel).toHaveBeenCalledTimes(1);
  });

  it("reuses singleton — second call does not reload model", async () => {
    await llamaMod.embedDoc("first");
    await llamaMod.embedDoc("second");
    expect(mockLlama.loadModel).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test test/lib/llama.test.ts`
Expected: FAIL — `embedDoc`, `embedQuery`, `embedDocBatch` not exported

- [ ] **Step 3: Implement the model wrapper**

Add to `src/lib/llama.ts` (after the formatting helpers):

```typescript
import { getLlama, resolveModelFile, type Llama, type LlamaModel, type LlamaEmbeddingContext } from "node-llama-cpp";

// Duplicated from embeddings.ts to avoid circular import (embeddings.ts imports from llama.ts)
const MAX_TEXT_LENGTH = 4000;

const DEFAULT_MODEL = "hf:Qwen/Qwen3-Embedding-0.6B-GGUF/Qwen3-Embedding-0.6B-Q8_0.gguf";
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export const LLAMA_EMBED_MODEL = process.env.TRAUL_EMBED_MODEL ?? DEFAULT_MODEL;

// --- Singleton state ---
let llama: Llama | null = null;
let model: LlamaModel | null = null;
let ctx: LlamaEmbeddingContext | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

/** Reset singleton for testing. */
export function _resetForTesting(): void {
  llama = null;
  model = null;
  ctx = null;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
}

function resetIdleTimer(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    if (ctx) { ctx.dispose(); ctx = null; }
    if (model) { await model.dispose(); model = null; }
  }, IDLE_TIMEOUT_MS);
  if (idleTimer && typeof idleTimer === "object" && "unref" in idleTimer) {
    (idleTimer as NodeJS.Timeout).unref();
  }
}

async function getContext(): Promise<LlamaEmbeddingContext> {
  if (ctx) {
    resetIdleTimer();
    return ctx;
  }

  if (!llama) {
    llama = await getLlama();
  }

  if (!model) {
    const modelPath = await resolveModelFile(LLAMA_EMBED_MODEL, {
      directory: `${process.env.HOME}/.cache/traul/models`,
      onProgress: ({ percent }) => {
        process.stderr.write(`\rDownloading model: ${Math.round(percent)}%`);
      },
    });
    model = await llama.loadModel({ modelPath });
  }

  ctx = await model.createEmbeddingContext();
  resetIdleTimer();
  return ctx;
}

function truncate(text: string): string {
  return text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;
}

const TRUNCATE_LIMITS = [2000, 1000];

async function embedSingle(embCtx: LlamaEmbeddingContext, text: string): Promise<Float32Array> {
  try {
    const { vector } = await embCtx.getEmbeddingFor(truncate(text));
    return new Float32Array(vector);
  } catch {
    // Retry with progressive truncation
    for (const limit of TRUNCATE_LIMITS) {
      try {
        const { vector } = await embCtx.getEmbeddingFor(text.slice(0, limit));
        return new Float32Array(vector);
      } catch {
        continue;
      }
    }
    throw new Error(`Text too long to embed even at ${TRUNCATE_LIMITS.at(-1)} chars`);
  }
}

export async function embedDoc(text: string): Promise<Float32Array> {
  const embCtx = await getContext();
  return embedSingle(embCtx, formatDoc(text));
}

export async function embedQuery(text: string): Promise<Float32Array> {
  const embCtx = await getContext();
  return embedSingle(embCtx, formatQuery(text, LLAMA_EMBED_MODEL));
}

export async function embedDocBatch(
  texts: string[],
  onSkip?: (index: number, error: string) => void,
): Promise<(Float32Array | null)[]> {
  if (texts.length === 0) return [];
  const embCtx = await getContext();
  const results: (Float32Array | null)[] = [];

  for (let i = 0; i < texts.length; i++) {
    try {
      results.push(await embedSingle(embCtx, formatDoc(texts[i])));
    } catch (err) {
      onSkip?.(i, err instanceof Error ? err.message : String(err));
      results.push(null);
    }
  }

  return results;
}

export async function dispose(): Promise<void> {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  if (ctx) { ctx.dispose(); ctx = null; }
  if (model) { await model.dispose(); model = null; }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test test/lib/llama.test.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/llama.ts test/lib/llama.test.ts
git commit -m "feat: add llama.ts model wrapper with singleton, embed methods"
```

---

### Task 4: Modify embeddings.ts — route to llama.ts with Ollama fallback

**Files:**
- Modify: `src/lib/embeddings.ts`
- Modify: `test/lib/embeddings.test.ts`

- [ ] **Step 1: Write failing tests for new embeddings.ts**

Rewrite `test/lib/embeddings.test.ts`:

```typescript
import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from "bun:test";

// --- Mocks ---

const fakeVector = new Float32Array(1024).fill(0.42);
const fakeVector2 = new Float32Array(1024).fill(0.84);

const mockLlama = {
  embedDoc: mock(() => Promise.resolve(fakeVector)),
  embedQuery: mock(() => Promise.resolve(fakeVector)),
  embedDocBatch: mock(() => Promise.resolve([fakeVector, fakeVector2])),
  LLAMA_EMBED_MODEL: "hf:Qwen/Qwen3-Embedding-0.6B-GGUF/Qwen3-Embedding-0.6B-Q8_0.gguf",
};

let llamaInitError: Error | null = null;

mock.module("../../src/lib/llama", () => {
  if (llamaInitError) throw llamaInitError;
  return mockLlama;
});

// Import after mock setup
const { embed, embedQuery, embedBatch, vecToBytes, MAX_TEXT_LENGTH, _resetFallbackForTesting } = await import("../../src/lib/embeddings");

const originalFetch = globalThis.fetch;
function mockFetch(handler: (url: string, opts: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = mock(handler as typeof fetch) as unknown as typeof fetch;
}
function restoreFetch() {
  globalThis.fetch = originalFetch;
}

function ollamaResponse(count: number) {
  return Response.json({
    embeddings: Array.from({ length: count }, () =>
      Array.from({ length: 1024 }, () => Math.random())
    ),
  });
}

describe("embeddings — llama primary path", () => {
  beforeEach(() => {
    _resetFallbackForTesting(); // Reset useLlama flag between tests
    mockLlama.embedDoc.mockClear();
    mockLlama.embedQuery.mockClear();
    mockLlama.embedDocBatch.mockClear();
    mockLlama.embedDoc.mockImplementation(() => Promise.resolve(fakeVector));
    mockLlama.embedQuery.mockImplementation(() => Promise.resolve(fakeVector));
    mockLlama.embedDocBatch.mockImplementation(() => Promise.resolve([fakeVector, fakeVector2]));
  });

  it("embed() calls llama.embedDoc and returns Float32Array", async () => {
    const result = await embed("hello");
    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(1024);
    expect(mockLlama.embedDoc).toHaveBeenCalledWith("hello");
  });

  it("embedQuery() calls llama.embedQuery and returns Float32Array", async () => {
    const result = await embedQuery("search term");
    expect(result).toBeInstanceOf(Float32Array);
    expect(mockLlama.embedQuery).toHaveBeenCalledWith("search term");
  });

  it("embedBatch() calls llama.embedDocBatch", async () => {
    const results = await embedBatch(["a", "b"]);
    expect(results).toHaveLength(2);
    expect(mockLlama.embedDocBatch).toHaveBeenCalled();
  });

  it("embed() pre-truncates text > MAX_TEXT_LENGTH", async () => {
    const longText = "x".repeat(5000);
    await embed(longText);
    const calledWith = mockLlama.embedDoc.mock.calls[0][0] as string;
    expect(calledWith.length).toBeLessThanOrEqual(MAX_TEXT_LENGTH);
  });

  it("vecToBytes produces correct Uint8Array", () => {
    const vec = new Float32Array([1.0, 2.0]);
    const bytes = vecToBytes(vec);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBe(8); // 2 * 4 bytes
  });
});

describe("embeddings — Ollama fallback", () => {
  // These tests verify that when llama.ts throws at runtime,
  // embeddings.ts falls back to Ollama HTTP calls (sticky fallback).

  beforeEach(() => {
    _resetFallbackForTesting(); // Reset useLlama so fallback tests start fresh
    restoreFetch();
  });

  afterEach(() => {
    restoreFetch();
  });

  it("embedBatch pre-truncates texts before sending to Ollama", async () => {
    // Force fallback by making llama throw
    mockLlama.embedDocBatch.mockImplementation(() => { throw new Error("llama unavailable"); });

    const sentTexts: string[][] = [];
    mockFetch(async (_url, opts) => {
      const body = JSON.parse(opts.body as string);
      sentTexts.push(body.input);
      return ollamaResponse(body.input.length);
    });

    const results = await embedBatch(["short", "x".repeat(5000)]);
    // Should fall back to Ollama and truncate
    for (const batch of sentTexts) {
      for (const text of batch) {
        expect(text.length).toBeLessThanOrEqual(4000);
      }
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test test/lib/embeddings.test.ts`
Expected: FAIL — `embedQuery` not exported from embeddings.ts

- [ ] **Step 3: Rewrite embeddings.ts with llama routing and Ollama fallback**

Replace `src/lib/embeddings.ts` with:

```typescript
import * as llama from "./llama";

// --- Constants (unchanged) ---
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = "snowflake-arctic-embed2"; // Used only for Ollama fallback path
const EMBED_DIMS = 1024;
const BATCH_SIZE = 50;
const MAX_TEXT_LENGTH = 4000;
const TRUNCATE_LIMITS = [2000, 1000];

export { EMBED_DIMS, BATCH_SIZE, MAX_TEXT_LENGTH };
export const EMBED_MODEL = llama.LLAMA_EMBED_MODEL;

// --- Backend selection ---
// Try to use llama.ts; if it fails to load, fall back to Ollama.
let useLlama = true;
try {
  // Eagerly check that the llama module loaded (import above would throw if broken)
  if (!llama.embedDoc) useLlama = false;
} catch {
  useLlama = false;
  console.warn("llama: node-llama-cpp unavailable, falling back to Ollama");
}

/** Reset fallback state for testing. */
export function _resetFallbackForTesting(): void {
  useLlama = true;
}

// --- Ollama HTTP backend (existing code, kept as fallback) ---

async function tryEmbedBatch(
  texts: string[]
): Promise<{ ok: true; embeddings: number[][] } | { ok: false; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_MODEL, input: texts, truncate: true }),
      signal: controller.signal,
    });
    const data = (await res.json()) as { embeddings?: number[][]; error?: string };
    if (data.embeddings) return { ok: true, embeddings: data.embeddings };
    return { ok: false, error: data.error ?? `HTTP ${res.status}` };
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: false, error: "timeout after 30s" };
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function isContextOverflow(error: string): boolean {
  return error.includes("input length exceeds") || error.includes("context length");
}

async function ollamaEmbed(text: string): Promise<Float32Array> {
  const input = text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;
  const result = await tryEmbedBatch([input]);
  if (result.ok) return new Float32Array(result.embeddings[0]);
  if (!isContextOverflow(result.error)) {
    throw new Error(`Ollama embedding failed: ${result.error}`);
  }
  for (const limit of TRUNCATE_LIMITS) {
    const truncated = await tryEmbedBatch([input.slice(0, limit)]);
    if (truncated.ok) return new Float32Array(truncated.embeddings[0]);
    if (!isContextOverflow(truncated.error)) {
      throw new Error(`Ollama embedding failed: ${truncated.error}`);
    }
  }
  throw new Error(`Message too long to embed even at ${TRUNCATE_LIMITS.at(-1)} chars`);
}

async function ollamaEmbedBatch(
  texts: string[],
  onSkip?: (index: number, error: string) => void
): Promise<(Float32Array | null)[]> {
  const results: (Float32Array | null)[] = [];
  const truncated = texts.map((t) => (t.length > MAX_TEXT_LENGTH ? t.slice(0, MAX_TEXT_LENGTH) : t));
  for (let i = 0; i < truncated.length; i += BATCH_SIZE) {
    const batch = truncated.slice(i, i + BATCH_SIZE);
    const result = await tryEmbedBatch(batch);
    if (result.ok) {
      results.push(...result.embeddings.map((e) => new Float32Array(e)));
    } else if (isContextOverflow(result.error)) {
      for (let j = 0; j < batch.length; j++) {
        const single = await tryEmbedBatch([batch[j].slice(0, TRUNCATE_LIMITS[0])]);
        if (single.ok) {
          results.push(new Float32Array(single.embeddings[0]));
        } else {
          onSkip?.(i + j, single.error);
          results.push(null);
        }
      }
    } else {
      for (let j = 0; j < batch.length; j++) {
        onSkip?.(i + j, result.error);
        results.push(null);
      }
    }
  }
  return results;
}

// --- Public API ---

function truncate(text: string): string {
  return text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;
}

export async function embed(text: string): Promise<Float32Array> {
  if (useLlama) {
    try {
      return await llama.embedDoc(truncate(text));
    } catch (err) {
      console.warn(`llama: embedding failed, falling back to Ollama: ${err}`);
      useLlama = false;
    }
  }
  return ollamaEmbed(text);
}

export async function embedQuery(text: string): Promise<Float32Array> {
  if (useLlama) {
    try {
      return await llama.embedQuery(truncate(text));
    } catch (err) {
      console.warn(`llama: embedding failed, falling back to Ollama: ${err}`);
      useLlama = false;
    }
  }
  // Ollama fallback: no instruction prefix (models handle it internally)
  return ollamaEmbed(text);
}

export async function embedBatch(
  texts: string[],
  onSkip?: (index: number, error: string) => void
): Promise<(Float32Array | null)[]> {
  if (useLlama) {
    try {
      const truncated = texts.map(truncate);
      return await llama.embedDocBatch(truncated, onSkip);
    } catch (err) {
      console.warn(`llama: batch embedding failed, falling back to Ollama: ${err}`);
      useLlama = false;
    }
  }
  return ollamaEmbedBatch(texts, onSkip);
}

export function vecToBytes(vec: Float32Array): Uint8Array {
  return new Uint8Array(vec.buffer);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test test/lib/embeddings.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/embeddings.ts test/lib/embeddings.test.ts
git commit -m "feat: route embeddings through llama.ts with Ollama fallback"
```

---

### Task 5: Update search.ts — use embedQuery()

**Files:**
- Modify: `src/commands/search.ts:3,48,56`

- [ ] **Step 1: Update search.ts imports and calls**

In `src/commands/search.ts`, make these changes:

Line 3 — change import:
```typescript
// Before:
import { embed, vecToBytes } from "../lib/embeddings";
// After:
import { embedQuery, vecToBytes } from "../lib/embeddings";
```

Line 48 — change embed call:
```typescript
// Before:
const vec = await embed(query);
// After:
const vec = await embedQuery(query);
```

Line 56 — change warning message:
```typescript
// Before:
console.warn("search: Ollama unavailable, falling back to FTS-only");
// After:
console.warn("search: embedding unavailable, falling back to FTS-only");
```

- [ ] **Step 2: Run existing tests**

Run: `bun test`
Expected: PASS — all tests should pass

- [ ] **Step 3: Commit**

```bash
git add src/commands/search.ts
git commit -m "feat: use embedQuery() for search queries"
```

---

### Task 6: Update migrations.ts — handle new model name

**Files:**
- Modify: `src/db/migrations.ts:2`

The `EMBED_MODEL` export from `embeddings.ts` now resolves to the llama.ts model URI (e.g., `hf:Qwen/...`). The migration code already compares stored `embed_model` with current `EMBED_MODEL` and triggers re-embedding on change. This is the desired behavior — switching from Ollama's `snowflake-arctic-embed2` to Qwen3 will auto-trigger embedding reset.

- [ ] **Step 1: Verify migration behavior**

No code changes needed in `migrations.ts` — it already imports `EMBED_MODEL` from `embeddings.ts` and the new value will naturally differ from the stored `snowflake-arctic-embed2`, triggering `resetEmbeddings()`.

Run: `bun test`
Expected: PASS

- [ ] **Step 2: Commit (skip if no changes)**

No commit needed — this task is verification only.

---

### Task 7: Run full test suite and type check

- [ ] **Step 1: Type check**

Run: `bun run --bun tsc --noEmit` (or whatever type-check command the project uses — may just be `bun build`)

Expected: No type errors

- [ ] **Step 2: Run all tests**

Run: `bun test`
Expected: All tests PASS

- [ ] **Step 3: Manual smoke test**

```bash
bun run src/index.ts search "test query"
```

Expected: Either works with llama (downloads model on first run) or falls back to Ollama with a warning.

- [ ] **Step 4: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix: address type/test issues from llama integration"
```

---

### Task 8: Update skill.md documentation

**Files:**
- Modify: `skill.md` (if it documents the embed model or search behavior)

- [ ] **Step 1: Update skill.md**

Add/update documentation for:
- New `embedQuery()` function
- `TRAUL_EMBED_MODEL` env var now expects HuggingFace GGUF URI
- node-llama-cpp as primary embedding backend
- Ollama as fallback
- First-run model download (~639MB)

- [ ] **Step 2: Commit**

```bash
git add skill.md
git commit -m "docs: document node-llama-cpp embedding backend"
```

---

## Summary

| Task | Description | Est. |
|------|-------------|------|
| 1 | Add node-llama-cpp dependency | 2 min |
| 2 | llama.ts formatting helpers + tests | 5 min |
| 3 | llama.ts model wrapper + tests | 10 min |
| 4 | embeddings.ts rewrite + tests | 10 min |
| 5 | search.ts update | 3 min |
| 6 | migrations.ts verification | 2 min |
| 7 | Full test suite + type check | 5 min |
| 8 | Documentation | 3 min |
