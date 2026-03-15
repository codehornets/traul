import { describe, it, expect } from "bun:test";
import { formatJSON } from "../../src/lib/formatter";

describe("formatJSON", () => {
  it("outputs valid JSON for normal messages", () => {
    const data = [
      { id: 1, content: "Hello world", author_name: "alice" },
    ];
    const output = formatJSON(data);
    expect(() => JSON.parse(output)).not.toThrow();
    expect(JSON.parse(output)[0].content).toBe("Hello world");
  });

  it("strips null bytes from content", () => {
    const data = [
      { id: 1, content: "Hello\x00world\x00!", author_name: "alice" },
    ];
    const output = formatJSON(data);
    expect(() => JSON.parse(output)).not.toThrow();
    const parsed = JSON.parse(output);
    expect(parsed[0].content).toBe("Helloworld!");
    expect(parsed[0].content).not.toContain("\x00");
  });

  it("strips control characters from content", () => {
    const data = [
      { id: 1, content: "Hello\x01\x02\x03world", author_name: "alice" },
    ];
    const output = formatJSON(data);
    expect(() => JSON.parse(output)).not.toThrow();
    expect(JSON.parse(output)[0].content).toBe("Helloworld");
  });

  it("truncates long content to 500 chars", () => {
    const longContent = "x".repeat(1000);
    const data = [{ id: 1, content: longContent, author_name: "alice" }];
    const output = formatJSON(data);
    expect(() => JSON.parse(output)).not.toThrow();
    const parsed = JSON.parse(output);
    expect(parsed[0].content.length).toBeLessThanOrEqual(503); // 500 + "..."
    expect(parsed[0].content).toEndWith("...");
  });

  it("does not truncate content under 500 chars", () => {
    const content = "x".repeat(499);
    const data = [{ id: 1, content, author_name: "alice" }];
    const output = formatJSON(data);
    const parsed = JSON.parse(output);
    expect(parsed[0].content).toBe(content);
  });

  it("handles non-array data unchanged", () => {
    const data = { key: "value" };
    const output = formatJSON(data);
    expect(JSON.parse(output)).toEqual({ key: "value" });
  });
});
