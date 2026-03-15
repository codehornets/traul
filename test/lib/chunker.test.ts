import { describe, it, expect } from "bun:test";
import { chunkText, shouldChunk } from "../../src/lib/chunker";

describe("shouldChunk", () => {
  it("returns false for short text", () => {
    expect(shouldChunk("hello world")).toBe(false);
  });

  it("returns true for text over threshold", () => {
    expect(shouldChunk("x".repeat(2001))).toBe(true);
  });

  it("respects custom threshold", () => {
    expect(shouldChunk("x".repeat(500), 400)).toBe(true);
    expect(shouldChunk("x".repeat(300), 400)).toBe(false);
  });
});

describe("chunkText", () => {
  it("returns single chunk for short text", () => {
    const chunks = chunkText("hello world");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].index).toBe(0);
    expect(chunks[0].content).toBe("hello world");
    expect(chunks[0].embeddingInput).toBe("hello world");
  });

  it("prepends doc title to embeddingInput", () => {
    const chunks = chunkText("hello world", { docTitle: "My Doc" });
    expect(chunks[0].embeddingInput).toBe("Document: My Doc\n\nhello world");
    expect(chunks[0].content).toBe("hello world");
  });

  it("splits long text into multiple chunks", () => {
    const text = Array.from({ length: 100 }, (_, i) => `Sentence number ${i}. `).join("");
    const chunks = chunkText(text, { maxChunkSize: 200, overlap: 50 });
    expect(chunks.length).toBeGreaterThan(1);

    // All content should be covered
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeGreaterThan(0);
      expect(chunk.content.length).toBeLessThanOrEqual(210); // allow slight word boundary overshoot
    }

    // Indices should be sequential
    chunks.forEach((c, i) => expect(c.index).toBe(i));
  });

  it("chunks have overlapping content", () => {
    const words = Array.from({ length: 200 }, (_, i) => `word${i}`).join(" ");
    const chunks = chunkText(words, { maxChunkSize: 300, overlap: 80 });
    expect(chunks.length).toBeGreaterThan(1);

    // Check that consecutive chunks share some text
    for (let i = 1; i < chunks.length; i++) {
      const prevEnd = chunks[i - 1].content.slice(-40);
      const currStart = chunks[i].content.slice(0, 100);
      // At least some words from prev chunk's end should appear in next chunk's start
      const prevWords = prevEnd.split(/\s+/).filter(Boolean);
      const overlap = prevWords.some((w) => currStart.includes(w));
      expect(overlap).toBe(true);
    }
  });

  it("does not lose content", () => {
    const text = "The quick brown fox jumps over the lazy dog. ".repeat(50);
    const chunks = chunkText(text, { maxChunkSize: 200, overlap: 50 });

    // Every part of the original text should appear in at least one chunk
    const allChunkText = chunks.map((c) => c.content).join(" ");
    const words = text.trim().split(/\s+/);
    for (const word of words) {
      expect(allChunkText).toContain(word);
    }
  });
});
