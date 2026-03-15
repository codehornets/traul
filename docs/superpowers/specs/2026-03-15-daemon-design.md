# Traul Daemon Design Spec

**Date:** 2026-03-15
**Status:** Approved

## Overview

A long-running background process (`traul daemon`) that continuously syncs all communication sources and embeds new messages on independent per-source intervals. Replaces manual/cron-based `traul sync` and `traul embed` invocations.

## CLI Interface

### `traul daemon` / `traul daemon start`

Starts the daemon. Foreground by default, `--detach` flag for background mode.

- Foreground: logs to stdout/stderr, Ctrl+C to stop
- Detached: writes PID to `~/.local/share/traul/daemon.pid`, logs to `~/.local/share/traul/daemon.log`

**Duplicate prevention:** On start, checks for existing PID file. If PID file exists and process is alive (`kill -0`), refuses to start with error message. Stale PID files (process dead) are cleaned up automatically.

### `traul daemon stop`

Reads PID file, sends SIGTERM. Daemon performs graceful shutdown (waits up to 10s for running syncs). Exit code 0 if stopped, 1 if not running.

### `traul daemon status`

Checks PID file existence + queries health endpoint. Displays per-source last run times and status. Exit code 0 if running, 1 if not running. If health endpoint is unreachable but PID exists, reports "running (health unavailable)".

## Scheduler

Each source and embed get an independent `setInterval` loop. A boolean "running" mutex per source prevents overlapping runs — if a sync is still running when the next tick fires, it's skipped (logged at debug level).

### Default Intervals

| Source | Interval | Priority |
|--------|----------|----------|
| slack | 300s (5min) | 1 - messenger |
| telegram | 300s (5min) | 2 - messenger |
| whatsapp | 300s (5min) | 3 - messenger |
| linear | 600s (10min) | 4 |
| claude-code | 600s (10min) | 5 |
| gmail | 600s (10min) | 6 |
| markdown | 600s (10min) | 7 |
| embed | 300s (5min) | 8 |

### Startup Order

On startup, all sources fire immediately in priority order with 2s stagger to avoid thundering herd:

1. Slack (0s)
2. Telegram (+2s)
3. WhatsApp (+4s)
4. Linear (+6s)
5. Claude Code (+8s)
6. Gmail (+10s)
7. Markdown (+12s)
8. Embed (+14s)

Messengers fire first — most urgent communications get indexed first.

**Note:** Embed runs independently of sync. If all syncs fail, embed still runs (it will simply find no new unembedded messages). No coupling between sync and embed scheduling.

### Configuration

Intervals are configurable via `~/.config/traul/config.json`:

```json
{
  "daemon": {
    "port": 3847,
    "intervals": {
      "slack": 300,
      "telegram": 300,
      "whatsapp": 300,
      "linear": 600,
      "claude-code": 600,
      "markdown": 600,
      "gmail": 600,
      "embed": 300
    }
  }
}
```

Values in seconds. Missing keys fall back to defaults.

## Health Endpoint

Bun.serve HTTP server on configurable port (default 3847), bound to `127.0.0.1` (local only). No auth.

### `GET /health` (aliased to `GET /`)

Response:

```json
{
  "status": "ok",
  "uptime": 3600,
  "sources": {
    "slack": {
      "last_run": "2026-03-15T10:00:00Z",
      "status": "idle",
      "last_error": null
    },
    "telegram": {
      "last_run": "2026-03-15T10:02:00Z",
      "status": "running",
      "last_error": null
    },
    "embed": {
      "last_run": "2026-03-15T10:02:30Z",
      "status": "idle",
      "last_error": "Ollama connection refused"
    }
  }
}
```

## Error Handling

### Transient API errors (rate limits, timeouts, network)

Exponential backoff per source: 1min → 2min → 4min → max 30min. Resets to normal interval on successful run. Backoff state is in-memory only — resets on daemon restart.

**Error classification:** Connectors throw errors normally. The scheduler classifies by type: network/timeout/rate-limit errors → transient (backoff). Auth/config errors (status 401, 403, missing token) → persistent (no backoff). Unknown errors → treated as transient.

### Persistent errors (auth failure, missing config)

Log error, skip this cycle, retry at normal interval. No backoff — these need manual intervention.

### Port conflict (health endpoint)

If the configured port is occupied, log a warning and start the daemon without the health endpoint. The daemon is still functional — `traul daemon status` falls back to PID-only check.

### Ollama down (embed)

Skip cycle, log warning, retry at normal interval. No backoff — it's a local service that will come back.

### Graceful Shutdown

SIGTERM/SIGINT handler:
1. Stop all interval timers
2. Wait up to 10s for any running sync/embed to finish
3. Close health server
4. Remove PID file
5. Exit 0

## File Structure

New files:

```
src/
  commands/
    daemon.ts          # CLI subcommands (start/stop/status)
  daemon/
    scheduler.ts       # Interval loop manager with mutex per source
    health.ts          # Bun.serve health endpoint
    pid.ts             # PID file management
    types.ts           # DaemonConfig, SourceStatus types
```

Modified files:

```
src/index.ts           # Register daemon command
src/lib/config.ts      # Add daemon config types/defaults
```

## Dependencies

No new dependencies. Uses:
- `Bun.serve` for health endpoint
- `Bun.spawn` / `process.kill` for detach/stop
- Existing connectors and embed code
