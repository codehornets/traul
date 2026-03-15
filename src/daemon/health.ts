import type { SourceState } from "./types";
import * as log from "../lib/logger";

let server: ReturnType<typeof Bun.serve> | null = null;
let startedAt: number = 0;

export async function startHealthServer(
  port: number,
  getStates: () => Map<string, SourceState>,
): Promise<void> {
  startedAt = Date.now();

  try {
    server = Bun.serve({
      port,
      hostname: "127.0.0.1",
      fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === "/health" || url.pathname === "/") {
          const states = getStates();
          const sources: Record<string, unknown> = {};
          for (const [name, state] of states) {
            sources[name] = {
              last_run: state.lastRun,
              status: state.status,
              last_error: state.lastError,
              progress: state.progress
                ? {
                    started_at: state.progress.startedAt,
                    progress_pct: state.progress.progressPct,
                    eta: state.progress.eta,
                  }
                : null,
            };
          }
          return Response.json({
            status: "ok",
            uptime: Math.floor((Date.now() - startedAt) / 1000),
            sources,
          });
        }
        return new Response("Not Found", { status: 404 });
      },
    });
    log.info(`Health endpoint listening on 127.0.0.1:${port}`);
  } catch (err) {
    log.warn(`Could not start health endpoint on port ${port}: ${err}`);
    log.warn("Daemon will run without health endpoint.");
  }
}

export async function stopHealthServer(): Promise<void> {
  if (server) {
    server.stop(true);
    server = null;
  }
}
