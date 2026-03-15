import { describe, it, expect, afterEach } from "bun:test";
import { startHealthServer, stopHealthServer } from "../../src/daemon/health";
import type { SourceState } from "../../src/daemon/types";

describe("health endpoint", () => {
  let port: number;

  afterEach(async () => {
    await stopHealthServer();
  });

  it("responds to /health with source states", async () => {
    const states = new Map<string, SourceState>();
    states.set("slack", {
      lastRun: "2026-03-15T10:00:00Z",
      status: "idle",
      lastError: null,
      backoffUntil: null,
      progress: null,
    });
    states.set("embed", {
      lastRun: null,
      status: "running",
      lastError: null,
      backoffUntil: null,
      progress: {
        startedAt: "2026-03-15T10:00:00Z",
        progressPct: 42,
        eta: "2026-03-15T10:05:00Z",
      },
    });

    port = 13847;
    await startHealthServer(port, () => states);

    const res = await fetch(`http://127.0.0.1:${port}/health`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(body.sources.slack.status).toBe("idle");
    expect(body.sources.slack.progress).toBeNull();
    expect(body.sources.embed.status).toBe("running");
    expect(body.sources.embed.progress.progress_pct).toBe(42);
    expect(body.sources.embed.progress.started_at).toBe("2026-03-15T10:00:00Z");
    expect(body.sources.embed.progress.eta).toBe("2026-03-15T10:05:00Z");
  });

  it("/ aliases to /health", async () => {
    const states = new Map<string, SourceState>();
    port = 13848;
    await startHealthServer(port, () => states);

    const res = await fetch(`http://127.0.0.1:${port}/`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  it("returns 404 for unknown paths", async () => {
    const states = new Map<string, SourceState>();
    port = 13849;
    await startHealthServer(port, () => states);

    const res = await fetch(`http://127.0.0.1:${port}/unknown`);
    expect(res.status).toBe(404);
  });

  it("degrades gracefully when port is occupied", async () => {
    const blocker = Bun.serve({ port: 13851, hostname: "127.0.0.1", fetch: () => new Response("blocked") });
    const states = new Map<string, SourceState>();

    // Should not throw
    await startHealthServer(13851, () => states);

    blocker.stop(true);
  });
});
