import { describe, it, expect } from "bun:test";
import { DEFAULT_INTERVALS, DEFAULT_PORT } from "../../src/daemon/types";
import { loadDaemonConfig } from "../../src/lib/config";

describe("loadDaemonConfig", () => {
  it("returns defaults when no daemon section exists", () => {
    const result = loadDaemonConfig({});
    expect(result.port).toBe(DEFAULT_PORT);
    expect(result.intervals.slack).toBe(300);
    expect(result.intervals.embed).toBe(300);
    expect(result.intervals.linear).toBe(600);
  });

  it("merges partial interval overrides", () => {
    const result = loadDaemonConfig({
      daemon: { intervals: { slack: 60 } },
    });
    expect(result.intervals.slack).toBe(60);
    expect(result.intervals.telegram).toBe(300);
  });

  it("overrides port", () => {
    const result = loadDaemonConfig({ daemon: { port: 9999 } });
    expect(result.port).toBe(9999);
  });
});
