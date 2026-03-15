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
  linear: {
    api_key: string;
    teams: string[];
    workspaces: Array<{ name: string; api_key: string; teams: string[] }>;
  };
  markdown: {
    dirs: string[];
  };
  gmail: {
    client_id: string;
    client_secret: string;
    refresh_token: string;
    accounts: Array<{ name: string; labels: string[] }>;
  };
  whatsapp: {
    instances: Array<{
      name: string;
      url: string;
      api_key: string;
      session: string;
      chats: string[];
    }>;
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
    linear: { api_key: "", teams: [], workspaces: [] },
    markdown: { dirs: [] },
    gmail: { client_id: "", client_secret: "", refresh_token: "", accounts: [] },
    whatsapp: { instances: [] },
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
      defaults.linear.api_key =
        parsed.linear?.api_key ?? defaults.linear.api_key;
      defaults.linear.teams =
        parsed.linear?.teams ?? defaults.linear.teams;
      defaults.linear.workspaces =
        parsed.linear?.workspaces ?? defaults.linear.workspaces;
      defaults.markdown.dirs =
        parsed.markdown?.dirs ?? defaults.markdown.dirs;
      // Gmail
      defaults.gmail.client_id = parsed.gmail?.client_id ?? defaults.gmail.client_id;
      defaults.gmail.client_secret = parsed.gmail?.client_secret ?? defaults.gmail.client_secret;
      defaults.gmail.refresh_token = parsed.gmail?.refresh_token ?? defaults.gmail.refresh_token;
      defaults.gmail.accounts = parsed.gmail?.accounts ?? defaults.gmail.accounts;
      // WhatsApp
      defaults.whatsapp.instances = parsed.whatsapp?.instances ?? defaults.whatsapp.instances;
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
  defaults.linear.api_key = process.env.LINEAR_API_KEY ?? defaults.linear.api_key;
  // Gmail: GMAIL_CREDS_JSON (combined) or individual env vars
  if (process.env.GMAIL_CREDS_JSON) {
    try {
      const creds = JSON.parse(process.env.GMAIL_CREDS_JSON);
      defaults.gmail.client_id = creds.client_id ?? defaults.gmail.client_id;
      defaults.gmail.client_secret = creds.client_secret ?? defaults.gmail.client_secret;
      defaults.gmail.refresh_token = creds.refresh_token ?? defaults.gmail.refresh_token;
    } catch {}
  }
  defaults.gmail.client_id = process.env.GMAIL_CLIENT_ID ?? defaults.gmail.client_id;
  defaults.gmail.client_secret = process.env.GMAIL_CLIENT_SECRET ?? defaults.gmail.client_secret;
  defaults.gmail.refresh_token = process.env.GMAIL_REFRESH_TOKEN ?? defaults.gmail.refresh_token;
  // Collect all LINEAR_API_KEY_<WORKSPACE> env vars into workspaces
  const envWorkspaceNames = new Set(defaults.linear.workspaces.map((w) => w.name));
  for (const [key, val] of Object.entries(process.env)) {
    if (key.startsWith("LINEAR_API_KEY_") && val) {
      const name = key.replace("LINEAR_API_KEY_", "").toLowerCase();
      if (!defaults.linear.api_key) {
        defaults.linear.api_key = val;
      }
      if (!envWorkspaceNames.has(name)) {
        defaults.linear.workspaces.push({ name, api_key: val, teams: [] });
        envWorkspaceNames.add(name);
      }
    }
  }

  return defaults;
}

export function getSyncStartTimestamp(config: TraulConfig): string {
  if (!config.sync_start) {
    // Default: 30 days ago
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return String(Math.floor(thirtyDaysAgo / 1000));
  }
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
