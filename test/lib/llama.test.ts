import { describe, it, expect, mock, beforeEach } from "bun:test";
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

describe("LlamaCpp wrapper", () => {
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
    mock.module("node-llama-cpp", () => ({
      getLlama: mock(() => Promise.resolve(mockLlama)),
      resolveModelFile: mock(() => Promise.resolve("/fake/model.gguf")),
    }));

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
    mockEmbeddingContext.getEmbeddingFor.mockImplementation((...args: unknown[]) => {
      capturedText = args[0] as string;
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
      (idx: number) => skipped.push(idx),
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
