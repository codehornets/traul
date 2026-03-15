export interface DaemonIntervals {
  slack: number;
  telegram: number;
  whatsapp: number;
  linear: number;
  "claude-code": number;
  gmail: number;
  markdown: number;
  embed: number;
}

export interface DaemonConfig {
  port: number;
  intervals: DaemonIntervals;
}

export type SourceStatus = "idle" | "running" | "error";

export interface ProgressInfo {
  startedAt: string;       // ISO timestamp when task started
  progressPct: number;     // 0-100
  eta: string | null;      // ISO timestamp of estimated completion, null if unknown
}

export interface SourceState {
  lastRun: string | null;
  status: SourceStatus;
  lastError: string | null;
  backoffUntil: number | null;
  progress: ProgressInfo | null; // non-null only while status === "running"
}

export const DEFAULT_PORT = 3847;

export const DEFAULT_INTERVALS: DaemonIntervals = {
  slack: 300,
  telegram: 300,
  whatsapp: 300,
  linear: 600,
  "claude-code": 600,
  gmail: 600,
  markdown: 600,
  embed: 300,
};

// Priority order for startup stagger
export const SOURCE_PRIORITY: Array<keyof DaemonIntervals> = [
  "slack",
  "telegram",
  "whatsapp",
  "linear",
  "claude-code",
  "gmail",
  "markdown",
  "embed",
];

export const STAGGER_MS = 2000;
export const GRACEFUL_SHUTDOWN_MS = 10_000;
export const MAX_BACKOFF_S = 1800; // 30 minutes
