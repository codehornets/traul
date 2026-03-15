import type { TraulDB } from "../db/database";
import { EMBED_MODEL, EMBED_DIMS } from "../lib/embeddings";

export function runStats(db: TraulDB, options: { json?: boolean }): void {
  const stats = db.getDetailedStats();

  if (options.json) {
    console.log(JSON.stringify(stats, null, 2));
    return;
  }

  console.log(`Database size:      ${formatBytes(stats.db_size)}`);
  console.log(`Messages:           ${stats.total_messages}`);
  console.log(`Channels:           ${stats.total_channels}`);
  console.log(`Contacts:           ${stats.total_contacts}`);
  console.log(`Chunks:             ${stats.total_chunks}`);
  console.log(`Embed model:        ${EMBED_MODEL} (${EMBED_DIMS}d)`);
  console.log(`Msg embeddings:     ${stats.embedded_messages} / ${stats.total_messages}`);
  console.log(`Chunk embeddings:   ${stats.embedded_chunks} / ${stats.total_chunks}`);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
