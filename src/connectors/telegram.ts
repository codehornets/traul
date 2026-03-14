import { homedir } from "os";
import { join } from "path";
import type { Connector, SyncResult } from "./types";
import type { TraulDB } from "../db/database";
import { type TraulConfig, getSyncStartTimestamp } from "../lib/config";
import * as log from "../lib/logger";

const TG_SCRIPT = join(
  homedir(),
  ".claude",
  "skills",
  "telegram-telethon",
  "scripts",
  "tg.py"
);

interface TgMessage {
  id: number;
  sender: string;
  text: string;
  date: string | null;
  chat_id?: number;
  reactions?: Array<{ emoji: string; count: number }>;
}

interface TgChat {
  name: string;
  id: number;
  type: string;
  unread: number;
}

async function runTg(args: string[]): Promise<string> {
  const proc = Bun.spawn(["python3", TG_SCRIPT, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`tg.py ${args[0]} failed (exit ${exitCode}): ${stderr}`);
  }
  return stdout.trim();
}

async function listChats(limit: number = 10000): Promise<TgChat[]> {
  const raw = await runTg(["list", "--limit", String(limit), "--json"]);
  if (!raw) return [];
  return JSON.parse(raw);
}

async function fetchMessages(
  chat: string,
  opts: { limit?: number; days?: number }
): Promise<TgMessage[]> {
  const args = [
    "recent",
    "--chat", chat,
    "--limit", String(opts.limit ?? 500),
    "--json",
  ];
  if (opts.days) {
    args.push("--days", String(opts.days));
  }
  const raw = await runTg(args);
  if (!raw) return [];
  return JSON.parse(raw);
}

export const telegramConnector: Connector = {
  name: "telegram",

  async sync(db: TraulDB, config: TraulConfig): Promise<SyncResult> {
    // Verify tg.py is accessible by checking status
    try {
      await runTg(["status"]);
    } catch {
      throw new Error(
        "Telegram not configured. Run: python3 ~/.claude/skills/telegram-telethon/scripts/tg.py setup"
      );
    }

    const result: SyncResult = {
      messagesAdded: 0,
      messagesUpdated: 0,
      contactsAdded: 0,
    };

    const syncStartTs = getSyncStartTimestamp(config);

    // Determine which chats to sync
    let chatsToSync: Array<{ name: string; id: string }> = [];

    if (config.telegram.chats.length > 0) {
      chatsToSync = config.telegram.chats.map((c) => ({
        name: c,
        id: c,
      }));
    } else {
      // Fetch all chats — no artificial limit
      const allChats = await listChats();
      chatsToSync = allChats.map((c) => ({
        name: c.name,
        id: String(c.id),
      }));
    }

    const totalChats = chatsToSync.length;
    log.info(`Syncing ${totalChats} Telegram chats...`);

    const contactCache = new Map<string, boolean>();
    const syncStart = Date.now();

    for (let i = 0; i < chatsToSync.length; i++) {
      const chat = chatsToSync[i];
      const elapsed = Math.round((Date.now() - syncStart) / 1000);
      log.info(`  [${i + 1}/${totalChats}] ${chat.name} (${elapsed}s elapsed)`);
      const cursorKey = `chat:${chat.id}`;
      const cursorValue = db.getSyncCursor("telegram", cursorKey);

      // Skip chat if it was synced less than 1 hour ago
      const lastSyncKey = `synced_at:${chat.id}`;
      const lastSyncValue = db.getSyncCursor("telegram", lastSyncKey);
      if (lastSyncValue) {
        const ageMs = Date.now() - parseInt(lastSyncValue);
        if (ageMs < 3600_000 && ageMs > 0) {
          log.info(`    skipped (synced ${Math.round(ageMs / 60_000)}m ago)`);
          continue;
        }
      }

      // Calculate days to fetch: from cursor or sync_start, default 7
      let days: number | undefined;
      const referenceTs = cursorValue
        ? Math.floor(new Date(cursorValue).getTime() / 1000)
        : syncStartTs !== "0" ? parseInt(syncStartTs) : undefined;

      if (referenceTs) {
        const nowTs = Math.floor(Date.now() / 1000);
        days = Math.ceil((nowTs - referenceTs) / 86400) + 1;
      } else {
        days = 7;
      }

      let messages: TgMessage[];
      const progressTimer = setInterval(() => {
        const sec = Math.round((Date.now() - syncStart) / 1000);
        log.info(`    ... still fetching ${chat.name} (${sec}s elapsed)`);
      }, 10_000);
      try {
        messages = await fetchMessages(chat.name, { limit: 500, days });
      } catch (err) {
        log.warn(`  Failed to fetch ${chat.name}: ${err}`);
        continue;
      } finally {
        clearInterval(progressTimer);
      }

      let chatMsgCount = 0;
      let duplicateStreak = 0;
      const DUPLICATE_THRESHOLD = 3; // stop after 3 consecutive known messages
      let latestDate = cursorValue ?? "";

      for (const msg of messages) {
        if (!msg.text) continue;

        const sentAt = msg.date
          ? Math.floor(new Date(msg.date).getTime() / 1000)
          : Math.floor(Date.now() / 1000);

        const sourceId = `${chat.id}:${msg.id}`;

        // Check if we already have this message — if so, we've caught up
        if (cursorValue && db.hasMessage("telegram", sourceId)) {
          duplicateStreak++;
          if (duplicateStreak >= DUPLICATE_THRESHOLD) {
            log.info(`    caught up (hit ${DUPLICATE_THRESHOLD} known messages)`);
            break;
          }
          continue;
        }
        duplicateStreak = 0;

        // Upsert contact
        if (msg.sender && !contactCache.has(msg.sender)) {
          const existing = db.getContactBySourceId("telegram", msg.sender);
          if (!existing) {
            const contactId = db.upsertContact(msg.sender);
            db.upsertContactIdentity({
              contactId,
              source: "telegram",
              sourceUserId: msg.sender,
              displayName: msg.sender,
            });
            result.contactsAdded++;
          }
          contactCache.set(msg.sender, true);
        }

        db.upsertMessage({
          source: "telegram",
          source_id: sourceId,
          channel_id: chat.id,
          channel_name: chat.name,
          author_id: msg.sender,
          author_name: msg.sender,
          content: msg.text,
          sent_at: sentAt,
          metadata: msg.reactions
            ? JSON.stringify({ reactions: msg.reactions })
            : undefined,
        });
        chatMsgCount++;

        if (msg.date && msg.date > latestDate) {
          latestDate = msg.date;
        }
      }

      if (latestDate && latestDate !== (cursorValue ?? "")) {
        db.setSyncCursor("telegram", cursorKey, latestDate);
      }
      db.setSyncCursor("telegram", lastSyncKey, String(Date.now()));

      result.messagesAdded += chatMsgCount;
      log.info(`    ${chatMsgCount} messages`);
    }

    return result;
  },
};
