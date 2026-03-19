import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";

const fakeVector = new Float32Array(1024).fill(0.42);
const fakeVector2 = new Float32Array(1024).fill(0.84);

const mockLlama = {
  embedDoc: mock(() => Promise.resolve(fakeVector)),
  embedQuery: mock(() => Promise.resolve(fakeVector)),
  embedDocBatch: mock(() => Promise.resolve([fakeVector, fakeVector2])),
  LLAMA_EMBED_MODEL: "hf:Qwen/Qwen3-Embedding-0.6B-GGUF/Qwen3-Embedding-0.6B-Q8_0.gguf",
};

mock.module("../../src/lib/llama", () => mockLlama);

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
    embeddings: Array.from({ length: count }, () => Array.from({ length: 1024 }, () => Math.random())),
  });
}

describe("embeddings — llama primary path", () => {
  beforeEach(() => {
    _resetFallbackForTesting();
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
    const calledWith = (mockLlama.embedDoc.mock.calls as unknown[][])[0][0] as string;
    expect(calledWith.length).toBeLessThanOrEqual(MAX_TEXT_LENGTH);
  });

  it("vecToBytes produces correct Uint8Array", () => {
    const vec = new Float32Array([1.0, 2.0]);
    const bytes = vecToBytes(vec);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBe(8);
  });
});

describe("embeddings — Ollama fallback", () => {
  beforeEach(() => {
    _resetFallbackForTesting();
    restoreFetch();
  });

  afterEach(() => {
    restoreFetch();
    // Restore llama mocks so they don't leak into other test files
    mockLlama.embedDoc.mockImplementation(() => Promise.resolve(fakeVector));
    mockLlama.embedQuery.mockImplementation(() => Promise.resolve(fakeVector));
    mockLlama.embedDocBatch.mockImplementation(() => Promise.resolve([fakeVector, fakeVector2]));
  });

  it("embed() falls back to Ollama when llama throws", async () => {
    mockLlama.embedDoc.mockImplementation(() => { throw new Error("llama unavailable"); });

    mockFetch(async (_url, opts) => {
      const body = JSON.parse(opts.body as string);
      return ollamaResponse(body.input.length);
    });

    const result = await embed("hello");
    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(1024);
  });

  it("embedBatch() falls back to Ollama and truncates", async () => {
    mockLlama.embedDocBatch.mockImplementation(() => { throw new Error("llama unavailable"); });

    const sentTexts: string[][] = [];
    mockFetch(async (_url, opts) => {
      const body = JSON.parse(opts.body as string);
      sentTexts.push(body.input);
      return ollamaResponse(body.input.length);
    });

    await embedBatch(["short", "x".repeat(5000)]);
    for (const batch of sentTexts) {
      for (const text of batch) {
        expect(text.length).toBeLessThanOrEqual(4000);
      }
    }
  });

  it("Ollama fallback uses snowflake-arctic-embed2 model name, not HF URI", async () => {
    mockLlama.embedDoc.mockImplementation(() => { throw new Error("llama unavailable"); });

    let sentModel = "";
    mockFetch(async (_url, opts) => {
      const body = JSON.parse(opts.body as string);
      sentModel = body.model;
      return ollamaResponse(body.input.length);
    });

    await embed("hello");
    expect(sentModel).toBe("snowflake-arctic-embed2");
  });
});
