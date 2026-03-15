import type { DaemonConfig, DaemonIntervals, SourceState } from "./types";
import { SOURCE_PRIORITY, STAGGER_MS, MAX_BACKOFF_S } from "./types";
import * as log from "../lib/logger";

export type ProgressCallback = (pct: number, eta: string | null) => void;
type RunFn = (source: string, onProgress: ProgressCallback) => Promise<void>;

interface SourceEntry {
  timer: ReturnType<typeof setTimeout> | null;
  running: boolean;
  state: SourceState;
  consecutiveFailures: number;
}

export class Scheduler {
  private sources = new Map<string, SourceEntry>();
  private stopped = false;

  constructor(
    private config: DaemonConfig,
    private runFn: RunFn,
  ) {}

  getStates(): Map<string, SourceState> {
    const result = new Map<string, SourceState>();
    for (const [name, entry] of this.sources) {
      result.set(name, { ...entry.state });
    }
    return result;
  }

  start(): void {
    this.stopped = false;

    for (let i = 0; i < SOURCE_PRIORITY.length; i++) {
      const source = SOURCE_PRIORITY[i];
      const entry: SourceEntry = {
        timer: null,
        running: false,
        state: { lastRun: null, status: "idle", lastError: null, backoffUntil: null, progress: null },
        consecutiveFailures: 0,
      };
      this.sources.set(source, entry);

      const staggerDelay = i * STAGGER_MS;
      setTimeout(() => {
        if (this.stopped) return;
        this.tick(source);
        this.scheduleNext(source);
      }, staggerDelay);
    }
  }

  private scheduleNext(source: string): void {
    const entry = this.sources.get(source);
    if (!entry || this.stopped) return;

    const intervalS = this.config.intervals[source as keyof DaemonIntervals] ?? 300;
    entry.timer = setTimeout(() => {
      if (this.stopped) return;
      this.tick(source);
      this.scheduleNext(source);
    }, intervalS * 1000);
  }

  private async tick(source: string): Promise<void> {
    const entry = this.sources.get(source);
    if (!entry || this.stopped) return;

    if (entry.running) {
      log.debug(`Skipping ${source} — still running`);
      return;
    }

    if (entry.state.backoffUntil && Date.now() < entry.state.backoffUntil) {
      log.debug(`Skipping ${source} — in backoff until ${new Date(entry.state.backoffUntil).toISOString()}`);
      return;
    }

    entry.running = true;
    entry.state.status = "running";
    entry.state.progress = { startedAt: new Date().toISOString(), progressPct: 0, eta: null };

    const onProgress: ProgressCallback = (pct, eta) => {
      if (entry.state.progress) {
        entry.state.progress.progressPct = pct;
        entry.state.progress.eta = eta;
      }
    };

    try {
      await this.runFn(source, onProgress);
      entry.state.lastRun = new Date().toISOString();
      entry.state.status = "idle";
      entry.state.lastError = null;
      entry.state.backoffUntil = null;
      entry.state.progress = null;
      entry.consecutiveFailures = 0;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      entry.state.status = "error";
      entry.state.lastError = msg;
      entry.state.lastRun = new Date().toISOString();
      entry.state.progress = null;

      if (Scheduler.isTransientError(err)) {
        entry.consecutiveFailures++;
        const backoffS = Scheduler.backoffSeconds(entry.consecutiveFailures - 1);
        entry.state.backoffUntil = Date.now() + backoffS * 1000;
        log.warn(`${source}: transient error, backoff ${backoffS}s — ${msg}`);
      } else {
        entry.consecutiveFailures = 0;
        entry.state.backoffUntil = null;
        log.error(`${source}: persistent error — ${msg}`);
      }
    } finally {
      entry.running = false;
    }
  }

  stop(): void {
    this.stopped = true;
    for (const [, entry] of this.sources) {
      if (entry.timer) {
        clearTimeout(entry.timer);
        entry.timer = null;
      }
    }
  }

  async waitForRunning(timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const anyRunning = [...this.sources.values()].some((e) => e.running);
      if (!anyRunning) return;
      await new Promise((r) => setTimeout(r, 200));
    }
    log.warn("Graceful shutdown timed out, some tasks still running");
  }

  static isTransientError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    const status = (err as any)?.status;

    if (status === 401 || status === 403) return false;
    if (/missing.*(token|key|config)/i.test(msg)) return false;

    if (/ETIMEDOUT|ECONNREFUSED|ECONNRESET|ENOTFOUND|fetch failed/i.test(msg)) return true;
    if (/rate.?limit|too many requests|429/i.test(msg)) return true;
    if (/timeout|timed?\s*out/i.test(msg)) return true;
    if (status === 429 || status === 502 || status === 503 || status === 504) return true;

    return true;
  }

  static backoffSeconds(failures: number): number {
    return Math.min(60 * Math.pow(2, failures), MAX_BACKOFF_S);
  }
}
