import { describe, it, expect } from "bun:test";
import { writeJSON } from "../../src/lib/formatter";

// Helper: capture what writeJSON sends to stdout
async function captureJSON(data: unknown): Promise<string> {
  let captured = "";
  const originalWrite = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    captured += typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
    return true;
  }) as typeof process.stdout.write;
  try {
    await writeJSON(data);
  } finally {
    process.stdout.write = originalWrite;
  }
  return captured;
}

describe("writeJSON", () => {
  it("outputs valid JSON for normal messages", async () => {
    const data = [
      { id: 1, content: "Hello world", author_name: "alice" },
    ];
    const output = await captureJSON(data);
    expect(() => JSON.parse(output)).not.toThrow();
    expect(JSON.parse(output)[0].content).toBe("Hello world");
  });

  it("strips null bytes from content", async () => {
    const data = [
      { id: 1, content: "Hello\x00world\x00!", author_name: "alice" },
    ];
    const output = await captureJSON(data);
    expect(() => JSON.parse(output)).not.toThrow();
    const parsed = JSON.parse(output);
    expect(parsed[0].content).toBe("Helloworld!");
    expect(parsed[0].content).not.toContain("\x00");
  });

  it("strips control characters but keeps newlines and tabs", async () => {
    const data = [
      { id: 1, content: "Hello\x01\x02\x03world\n\ttab", author_name: "alice" },
    ];
    const output = await captureJSON(data);
    expect(() => JSON.parse(output)).not.toThrow();
    const parsed = JSON.parse(output);
    expect(parsed[0].content).toBe("Helloworld\n\ttab");
  });

  it("does NOT truncate long content", async () => {
    const longContent = "x".repeat(5000);
    const data = [{ id: 1, content: longContent, author_name: "alice" }];
    const output = await captureJSON(data);
    const parsed = JSON.parse(output);
    expect(parsed[0].content.length).toBe(5000);
    expect(parsed[0].content).not.toContain("...");
  });

  it("preserves content under 500 chars unchanged", async () => {
    const content = "x".repeat(499);
    const data = [{ id: 1, content, author_name: "alice" }];
    const output = await captureJSON(data);
    const parsed = JSON.parse(output);
    expect(parsed[0].content).toBe(content);
  });

  it("handles non-array data unchanged", async () => {
    const data = { key: "value" };
    const output = await captureJSON(data);
    expect(JSON.parse(output)).toEqual({ key: "value" });
  });

  it("handles content with embedded JSON-special characters", async () => {
    const data = [
      { id: 1, content: 'quote: "hello" and backslash: \\ and slash: /', author_name: "alice" },
    ];
    const output = await captureJSON(data);
    expect(() => JSON.parse(output)).not.toThrow();
    const parsed = JSON.parse(output);
    expect(parsed[0].content).toContain('"hello"');
    expect(parsed[0].content).toContain("\\");
  });

  it("handles content with unicode and emoji", async () => {
    const data = [
      { id: 1, content: "Привет мир 🌍 日本語", author_name: "alice" },
    ];
    const output = await captureJSON(data);
    const parsed = JSON.parse(output);
    expect(parsed[0].content).toBe("Привет мир 🌍 日本語");
  });

  it("handles content with multiline markdown and code blocks", async () => {
    const content = "# Title\n\n```typescript\nconst x = 1;\n```\n\n- item 1\n- item 2";
    const data = [{ id: 1, content, author_name: "alice" }];
    const output = await captureJSON(data);
    const parsed = JSON.parse(output);
    expect(parsed[0].content).toBe(content);
  });

  it("only sanitizes items that have a string content field", async () => {
    const data = [
      { id: 1, content: 42 },
      { id: 2, content: "text\x00here" },
      { id: 3, name: "no content field" },
    ];
    const output = await captureJSON(data);
    const parsed = JSON.parse(output);
    expect(parsed[0].content).toBe(42);
    expect(parsed[1].content).toBe("texthere");
    expect(parsed[2].content).toBeUndefined();
  });

  it("output ends with a newline", async () => {
    const output = await captureJSON([{ id: 1 }]);
    expect(output.endsWith("\n")).toBe(true);
  });

  it("returns a promise that resolves", async () => {
    const originalWrite = process.stdout.write;
    process.stdout.write = (() => true) as typeof process.stdout.write;
    try {
      const result = writeJSON({ test: true });
      expect(result).toBeInstanceOf(Promise);
      await result;
    } finally {
      process.stdout.write = originalWrite;
    }
  });

  it("waits for drain when stdout returns false", async () => {
    const originalWrite = process.stdout.write;
    let drainCallback: (() => void) | null = null;
    const originalOnce = process.stdout.once;

    process.stdout.write = (() => false) as typeof process.stdout.write;
    process.stdout.once = ((event: string, cb: () => void) => {
      if (event === "drain") {
        drainCallback = cb;
        // Simulate drain after a tick
        setTimeout(() => cb(), 1);
      }
      return process.stdout;
    }) as typeof process.stdout.once;

    try {
      await writeJSON({ test: true });
      expect(drainCallback).not.toBeNull();
    } finally {
      process.stdout.write = originalWrite;
      process.stdout.once = originalOnce;
    }
  });
});
