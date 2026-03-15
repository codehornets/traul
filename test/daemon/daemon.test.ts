// test/daemon/daemon.test.ts
import { describe, it, expect, afterEach } from "bun:test";
import { Scheduler } from "../../src/daemon/scheduler";
import { startHealthServer, stopHealthServer } from "../../src/daemon/health";
import { DEFAULT_PORT, DEFAULT_INTERVALS } from "../../src/daemon/types";

describe("daemon integration", () => {
  let scheduler: Scheduler | null = null;

  afterEach(async () => {
    if (scheduler) {
      scheduler.stop();
      await scheduler.waitForRunning(2000);
    }
    await stopHealthServer();
  });

  it("scheduler fires sources and health reports them", async () => {
    const fired = new Set<string>();
    const config = {
      port: DEFAULT_PORT,
      intervals: { ...DEFAULT_INTERVALS },
    };

    // Override intervals to be very long so they won't re-fire during test
    for (const key of Object.keys(config.intervals) as Array<keyof typeof config.intervals>) {
      config.intervals[key] = 999;
    }

    scheduler = new Scheduler(config, async (source, _onProgress) => {
      fired.add(source);
    });

    const port = 13850;
    await startHealthServer(port, () => scheduler!.getStates());
    scheduler.start();

    // Wait for staggered startup to fire first few sources (2s stagger each)
    await new Promise((r) => setTimeout(r, 5000));

    // At least the first 3 (slack, telegram, whatsapp) should have fired
    expect(fired.has("slack")).toBe(true);
    expect(fired.has("telegram")).toBe(true);

    // Health should reflect states
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    const body = await res.json() as any;
    expect(body.status).toBe("ok");
    expect(body.sources.slack).toBeDefined();
  }, 10000);
});
