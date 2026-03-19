import { describe, it, expect, mock, beforeEach } from "bun:test";

// Check if node-llama-cpp native binary is available
let llamaAvailable = false;
try {
  await import("node-llama-cpp");
  llamaAvailable = true;
} catch {
  // native binary not available (CI)
}

// --- Mock node-llama-cpp at top level before any imports ---

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

const mockLlamaInstance = {
  loadModel: mock(() => Promise.resolve(mockModel)),
};

mock.module("node-llama-cpp", () => ({
  getLlama: mock(() => Promise.resolve(mockLlamaInstance)),
  resolveModelFile: mock(() => Promise.resolve("/fake/model.gguf")),
  LlamaLogLevel: { disabled: "disabled", fatal: "fatal", error: "error", warn: "warn", info: "info", log: "log", debug: "debug" },
}));

// Import after mock setup — gets real llama.ts with mocked node-llama-cpp
const llama = await import("../../src/lib/llama");
const { embedDoc, embedQuery, embedDocBatch, _resetForTesting } = llama;

describe.if(llamaAvailable)("LlamaCpp wrapper", () => {
  beforeEach(() => {
    _resetForTesting?.();
    mockEmbeddingContext.getEmbeddingFor.mockImplementation(() => ({ vector: fakeVector }));
    mockModel.createEmbeddingContext.mockClear();
    mockModel.dispose.mockClear();
    mockLlamaInstance.loadModel.mockClear();
  });

  it("embedDoc returns Float32Array of length 1024", async () => {
    const result = await embedDoc("hello world");
    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(1024);
  });

  it("embedDoc produces different vectors for different inputs", async () => {
    let callCount = 0;
    mockEmbeddingContext.getEmbeddingFor.mockImplementation(() => {
      callCount++;
      return { vector: callCount === 1 ? fakeVector : fakeVector2 };
    });

    const v1 = await embedDoc("hello");
    const v2 = await embedDoc("goodbye");
    expect(v1).not.toEqual(v2);
  });

  it("embedQuery adds instruction prefix for Qwen model", async () => {
    let capturedText = "";
    mockEmbeddingContext.getEmbeddingFor.mockImplementation((...args: unknown[]) => {
      capturedText = args[0] as string;
      return { vector: fakeVector };
    });

    await embedQuery("search term");
    expect(capturedText).toContain("Instruct: Retrieve relevant documents");
    expect(capturedText).toContain("Query: search term");
  });

  it("embedDocBatch returns array of Float32Array", async () => {
    const results = await embedDocBatch(["a", "b", "c"]);
    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r).toBeInstanceOf(Float32Array);
    }
  });

  it("embedDocBatch returns empty array for empty input", async () => {
    const results = await embedDocBatch([]);
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
    const results = await embedDocBatch(
      ["ok", "bad", "ok"],
      (idx: number) => skipped.push(idx),
    );
    expect(results).toHaveLength(3);
    expect(results[0]).toBeInstanceOf(Float32Array);
    expect(results[1]).toBeNull();
    expect(results[2]).toBeInstanceOf(Float32Array);
    expect(skipped).toEqual([1]);
  });

  it("lazy loads model on first call, not on import", async () => {
    expect(mockLlamaInstance.loadModel).not.toHaveBeenCalled();
    await embedDoc("trigger load");
    expect(mockLlamaInstance.loadModel).toHaveBeenCalledTimes(1);
  });

  it("reuses singleton — second call does not reload model", async () => {
    await embedDoc("first");
    await embedDoc("second");
    expect(mockLlamaInstance.loadModel).toHaveBeenCalledTimes(1);
  });
});
