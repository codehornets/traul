import { describe, it, expect, beforeEach } from "bun:test";
import { Scheduler } from "../../src/daemon/scheduler";
import type { DaemonConfig } from "../../src/daemon/types";
import { DEFAULT_INTERVALS, DEFAULT_PORT } from "../../src/daemon/types";

describe("Scheduler", () => {
  let callLog: Array<{ source: string; time: number }>;
  let scheduler: Scheduler;
  const config: DaemonConfig = { port: DEFAULT_PORT, intervals: { ...DEFAULT_INTERVALS } };

  beforeEach(() => {
    callLog = [];
  });

  it("classifies transient errors for backoff", () => {
    expect(Scheduler.isTransientError(new Error("ETIMEDOUT"))).toBe(true);
    expect(Scheduler.isTransientError(new Error("ECONNREFUSED"))).toBe(true);
    expect(Scheduler.isTransientError(new Error("rate limit"))).toBe(true);
    expect(Scheduler.isTransientError(new Error("fetch failed"))).toBe(true);

    const authErr = Object.assign(new Error("Unauthorized"), { status: 401 });
    expect(Scheduler.isTransientError(authErr)).toBe(false);
    const forbiddenErr = Object.assign(new Error("Forbidden"), { status: 403 });
    expect(Scheduler.isTransientError(forbiddenErr)).toBe(false);
  });

  it("calculates exponential backoff capped at 30 min", () => {
    expect(Scheduler.backoffSeconds(0)).toBe(60);
    expect(Scheduler.backoffSeconds(1)).toBe(120);
    expect(Scheduler.backoffSeconds(2)).toBe(240);
    expect(Scheduler.backoffSeconds(3)).toBe(480);
    expect(Scheduler.backoffSeconds(10)).toBe(1800);
  });

  it("mutex prevents overlapping runs of the same source", async () => {
    let running = 0;
    let maxConcurrent = 0;
    const shortConfig = { port: DEFAULT_PORT, intervals: { ...DEFAULT_INTERVALS, slack: 1 } };

    const scheduler = new Scheduler(shortConfig, async (source, _onProgress) => {
      if (source !== "slack") return;
      running++;
      maxConcurrent = Math.max(maxConcurrent, running);
      await new Promise((r) => setTimeout(r, 2000));
      running--;
    });

    scheduler.start();
    await new Promise((r) => setTimeout(r, 4000));
    scheduler.stop();
    await scheduler.waitForRunning(3000);

    expect(maxConcurrent).toBe(1);
  }, 10000);

  it("reports progress via onProgress callback", async () => {
    const shortConfig = { port: DEFAULT_PORT, intervals: { ...DEFAULT_INTERVALS } };

    const scheduler = new Scheduler(shortConfig, async (source, onProgress) => {
      if (source !== "slack") return;
      onProgress(50, "2026-03-15T11:00:00Z");
      onProgress(100, null);
    });

    scheduler.start();
    await new Promise((r) => setTimeout(r, 500));
    const states = scheduler.getStates();
    const slackState = states.get("slack");
    expect(slackState?.progress).toBeNull();

    scheduler.stop();
    await scheduler.waitForRunning(2000);
  });
});
