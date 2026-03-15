import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, basename, extname } from "path";
import { homedir } from "os";
import { createHash } from "crypto";
import type { Connector, SyncResult } from "./types";
import type { TraulDB } from "../db/database";
import type { TraulConfig } from "../lib/config";
import { shouldChunk, chunkText } from "../lib/chunker";
import * as log from "../lib/logger";

function walkMarkdown(dir: string): string[] {
  const results: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.startsWith(".") || entry === "node_modules") continue;
    const full = join(dir, entry);
    try {
      const stat = statSync(full);
      if (stat.isDirectory()) {
        results.push(...walkMarkdown(full));
      } else if (stat.isFile() && extname(entry) === ".md") {
        results.push(full);
      }
    } catch {
      continue;
    }
  }
  return results;
}

function fileHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function channelFromPath(filePath: string, baseDir: string): string {
  const rel = relative(baseDir, filePath);
  const parts = rel.split("/");
  // Use parent directory as channel, or "root" if file is at top level
  if (parts.length > 1) {
    return parts.slice(0, -1).join("/");
  }
  return basename(baseDir);
}

export const markdownConnector: Connector = {
  name: "markdown",

  async sync(db: TraulDB, config: TraulConfig): Promise<SyncResult> {
    const result: SyncResult = { messagesAdded: 0, messagesUpdated: 0, contactsAdded: 0 };

    const dirs = (config as any).markdown?.dirs as string[] | undefined;
    if (!dirs || dirs.length === 0) {
      log.warn("No markdown directories configured.");
      log.warn("Add markdown.dirs to ~/.config/traul/config.json, e.g.:");
      log.warn('  "markdown": { "dirs": ["~/notes", "~/docs"] }');
      return result;
    }

    for (const rawDir of dirs) {
      const dir = rawDir.replace(/^~/, homedir());
      log.info(`  Scanning ${dir}`);

      const files = walkMarkdown(dir);
      let synced = 0;

      for (const filePath of files) {
        let content: string;
        let mtime: number;
        try {
          content = readFileSync(filePath, "utf-8");
          mtime = Math.floor(statSync(filePath).mtimeMs / 1000);
        } catch {
          continue;
        }

        if (content.trim().length === 0) continue;

        const relPath = relative(dir.replace(/^~/, homedir()), filePath);
        const sourceId = `md:${fileHash(filePath)}`;
        const cursorKey = `file:${relPath}`;
        const lastHash = db.getSyncCursor("markdown", cursorKey);
        const contentHash = fileHash(content);

        // Skip if content hasn't changed
        if (lastHash === contentHash) continue;

        const channelName = channelFromPath(filePath, dir);
        const title = basename(filePath, ".md");

        db.upsertMessage({
          source: "markdown",
          source_id: sourceId,
          channel_name: channelName,
          author_name: title,
          content: content,
          sent_at: mtime,
          metadata: JSON.stringify({ path: relPath }),
        });

        // Chunk large files for better search coverage
        if (shouldChunk(content)) {
          const msgRow = db.db
            .query<{ id: number }, [string, string]>(
              "SELECT id FROM messages WHERE source = ? AND source_id = ?"
            )
            .get("markdown", sourceId);
          if (msgRow) {
            const chunks = chunkText(content, { docTitle: title });
            db.replaceChunks(msgRow.id, chunks);
            log.info(`    ${title}: ${chunks.length} chunks`);
          }
        }

        result.messagesAdded++;
        synced++;

        db.setSyncCursor("markdown", cursorKey, contentHash);
      }

      log.info(`  ${synced} files synced from ${dir} (${files.length} total .md files)`);
    }

    return result;
  },
};
