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
