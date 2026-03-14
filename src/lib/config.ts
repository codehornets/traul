import { existsSync, readFileSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export interface TraulConfig {
  sync_start: string;
  database: {
    path: string;
  };
  slack: {
    token: string;
    cookie: string;
    my_user_id: string;
    channels: string[];
  };
  telegram: {
    api_id: string;
    api_hash: string;
    session_path: string;
    chats: string[];
  };
}

const CONFIG_DIR = join(homedir(), ".config", "traul");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");
const DEFAULT_DB_PATH = join(homedir(), ".local", "share", "traul", "traul.db");

function getDefaultConfig(): TraulConfig {
  return {
    sync_start: "",
    database: { path: DEFAULT_DB_PATH },
    slack: { token: "", cookie: "", my_user_id: "", channels: [] },
    telegram: { api_id: "", api_hash: "", session_path: "", chats: [] },
  };
}

export function loadConfig(): TraulConfig {
  const defaults = getDefaultConfig();

  if (existsSync(CONFIG_PATH)) {
    try {
      const raw = readFileSync(CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      defaults.sync_start = parsed.sync_start ?? defaults.sync_start;
      defaults.database.path = parsed.database?.path ?? defaults.database.path;
      defaults.slack.token = parsed.slack?.token ?? defaults.slack.token;
      defaults.slack.cookie = parsed.slack?.cookie ?? defaults.slack.cookie;
      defaults.slack.my_user_id =
        parsed.slack?.my_user_id ?? defaults.slack.my_user_id;
      defaults.slack.channels =
        parsed.slack?.channels ?? defaults.slack.channels;
      defaults.telegram.api_id =
        parsed.telegram?.api_id ?? defaults.telegram.api_id;
      defaults.telegram.api_hash =
        parsed.telegram?.api_hash ?? defaults.telegram.api_hash;
      defaults.telegram.session_path =
        parsed.telegram?.session_path ?? defaults.telegram.session_path;
      defaults.telegram.chats =
        parsed.telegram?.chats ?? defaults.telegram.chats;
    } catch {
      // ignore malformed config, use defaults
    }
  }

  // Env var overrides
  if (process.env.TRAUL_DB_PATH) {
    defaults.database.path = process.env.TRAUL_DB_PATH;
  }
  // Slack token: SLACK_TOKEN > SLACK_BOT_TOKEN > SLACK_USER_TOKEN > SLACK_TOKEN_*
  defaults.slack.token =
    process.env.SLACK_TOKEN ??
    process.env.SLACK_BOT_TOKEN ??
    process.env.SLACK_USER_TOKEN ??
    defaults.slack.token;
  defaults.slack.cookie = process.env.SLACK_COOKIE ?? defaults.slack.cookie;

  // Fallback: pick up SLACK_TOKEN_<WORKSPACE> / SLACK_COOKIE_<WORKSPACE> from /slack skill
  if (!defaults.slack.token) {
    for (const [key, val] of Object.entries(process.env)) {
      if (key.startsWith("SLACK_TOKEN_") && val) {
        defaults.slack.token = val;
        const suffix = key.replace("SLACK_TOKEN_", "");
        defaults.slack.cookie = process.env[`SLACK_COOKIE_${suffix}`] ?? "";
        break;
      }
    }
  }
  if (process.env.TELEGRAM_API_ID) {
    defaults.telegram.api_id = process.env.TELEGRAM_API_ID;
  }
  if (process.env.TELEGRAM_API_HASH) {
    defaults.telegram.api_hash = process.env.TELEGRAM_API_HASH;
  }

  return defaults;
}

export function getSyncStartTimestamp(config: TraulConfig): string {
  if (!config.sync_start) return "0";
  const ts = Math.floor(new Date(config.sync_start).getTime() / 1000);
  if (isNaN(ts)) return "0";
  return String(ts);
}

export function ensureDbDir(dbPath: string): void {
  const dir = join(dbPath, "..");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function saveDefaultConfig(): void {
  if (!existsSync(CONFIG_PATH)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CONFIG_PATH, JSON.stringify(getDefaultConfig(), null, 2));
  }
}
