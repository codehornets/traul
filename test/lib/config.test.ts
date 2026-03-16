import { describe, it, expect, beforeEach } from "bun:test";
import { deepMerge, getSyncStartTimestamp, setRawParsedConfig, type TraulConfig } from "../../src/lib/config";
import { DEFAULT_PORT, DEFAULT_EMBED_INTERVAL } from "../../src/daemon/types";

function makeConfig(overrides: Partial<TraulConfig> = {}): TraulConfig {
  return {
    sync_start: "",
    database: { path: "/tmp/test.db" },
    slack: { token: "", cookie: "", my_user_id: "", channels: [] },
    telegram: { api_id: "", api_hash: "", session_path: "", chats: [] },
    linear: { api_key: "", teams: [], workspaces: [] },
    markdown: { dirs: [] },
    gmail: { client_id: "", client_secret: "", refresh_token: "", accounts: [] },
    whatsapp: { instances: [] },
    discord: { token: "", servers: { allowlist: [], stoplist: [] }, channels: { allowlist: [], stoplist: [] } },
    daemon: { port: DEFAULT_PORT, intervals: { embed: DEFAULT_EMBED_INTERVAL } },
    ...overrides,
  };
}

describe("deepMerge", () => {
  it("merges top-level scalars", () => {
    const target: Record<string, any> = { a: 1, b: "old" };
    deepMerge(target, { b: "new", c: 3 });
    expect(target).toEqual({ a: 1, b: "new", c: 3 });
  });

  it("deep merges nested objects", () => {
    const target = { x: { a: 1, b: 2 } };
    deepMerge(target, { x: { b: 99 } });
    expect(target.x).toEqual({ a: 1, b: 99 });
  });

  it("replaces arrays instead of merging", () => {
    const target = { items: [1, 2, 3] };
    deepMerge(target, { items: [4, 5] });
    expect(target.items).toEqual([4, 5]);
  });

  it("skips null and undefined values", () => {
    const target = { a: "keep", b: "keep" };
    deepMerge(target, { a: null, b: undefined });
    expect(target).toEqual({ a: "keep", b: "keep" });
  });

  it("handles deeply nested structures", () => {
    const target = { discord: { servers: { allowlist: ["a"], stoplist: [] } } };
    deepMerge(target, { discord: { servers: { allowlist: ["b", "c"] } } });
    expect(target.discord.servers.allowlist).toEqual(["b", "c"]);
    expect(target.discord.servers.stoplist).toEqual([]);
  });
});

describe("getSyncStartTimestamp", () => {
  beforeEach(() => {
    setRawParsedConfig({});
  });

  it("returns 30 days ago when no sync_start is set", () => {
    const config = makeConfig();
    const result = getSyncStartTimestamp(config);
    const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    expect(Math.abs(parseInt(result) - thirtyDaysAgo)).toBeLessThan(2);
  });

  it("uses global sync_start", () => {
    const config = makeConfig({ sync_start: "2025-01-01" });
    const result = getSyncStartTimestamp(config);
    const expected = Math.floor(new Date("2025-01-01").getTime() / 1000);
    expect(parseInt(result)).toBe(expected);
  });

  it("uses per-connector sync_start when connector is specified", () => {
    const config = makeConfig({ sync_start: "2025-06-01" });
    setRawParsedConfig({ gmail: { sync_start: "2024-01-01" } });
    const result = getSyncStartTimestamp(config, "gmail");
    const expected = Math.floor(new Date("2024-01-01").getTime() / 1000);
    expect(parseInt(result)).toBe(expected);
  });

  it("falls back to global sync_start when connector has no sync_start", () => {
    const config = makeConfig({ sync_start: "2025-06-01" });
    setRawParsedConfig({ gmail: { client_id: "test" } });
    const result = getSyncStartTimestamp(config, "gmail");
    const expected = Math.floor(new Date("2025-06-01").getTime() / 1000);
    expect(parseInt(result)).toBe(expected);
  });

  it("falls back to default when connector section missing entirely", () => {
    const config = makeConfig();
    setRawParsedConfig({});
    const result = getSyncStartTimestamp(config, "gmail");
    const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    expect(Math.abs(parseInt(result) - thirtyDaysAgo)).toBeLessThan(2);
  });

  it("returns '0' for invalid date strings", () => {
    const config = makeConfig({ sync_start: "not-a-date" });
    expect(getSyncStartTimestamp(config)).toBe("0");
  });

  it("works for any connector name", () => {
    const config = makeConfig({ sync_start: "2025-06-01" });
    setRawParsedConfig({ slack: { sync_start: "2025-03-01" } });
    const result = getSyncStartTimestamp(config, "slack");
    const expected = Math.floor(new Date("2025-03-01").getTime() / 1000);
    expect(parseInt(result)).toBe(expected);
  });
});
