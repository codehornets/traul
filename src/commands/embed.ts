import type { TraulDB } from "../db/database";
import { embed, vecToBytes } from "../lib/embeddings";

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return `${mins}m ${remSecs}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
}

export async function runEmbed(
  db: TraulDB,
  options: { limit?: string; quiet?: boolean }
): Promise<void> {
  const batchLimit = options.limit ? parseInt(options.limit, 10) : 500;
  const stats = db.getEmbeddingStats();

  if (!options.quiet) {
    console.log(
      `Embeddings: ${stats.embedded_messages}/${stats.total_messages} messages`
    );
  }

  const messages = db.getUnembeddedMessages(batchLimit);
  if (messages.length === 0) {
    if (!options.quiet) console.log("All messages already embedded.");
    return;
  }

  if (!options.quiet) {
    console.log(`Embedding ${messages.length} messages...`);
  }

  let done = 0;
  let failed = 0;
  const startTime = Date.now();

  for (const msg of messages) {
    try {
      const vec = await embed(msg.content);
      db.insertEmbedding(msg.id, vecToBytes(vec));
      done++;
    } catch (err) {
      failed++;
      if (!options.quiet) {
        const errMsg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`\n  ! msg ${msg.id}: ${errMsg}\n`);
      }
    }

    if (!options.quiet && (done + failed) % 25 === 0) {
      const elapsed = Date.now() - startTime;
      const processed = done + failed;
      const msPerMsg = elapsed / processed;
      const remaining = messages.length - processed;
      const eta = formatDuration(msPerMsg * remaining);
      const pct = Math.round((processed / messages.length) * 100);
      process.stdout.write(
        `\r  ${processed}/${messages.length} (${pct}%)  ${done} ok, ${failed} err  ETA: ${eta}   `
      );
    }
  }

  if (!options.quiet) {
    const elapsed = formatDuration(Date.now() - startTime);
    const updated = db.getEmbeddingStats();
    process.stdout.write("\r" + " ".repeat(80) + "\r");
    console.log(
      `Done in ${elapsed}. ${done} embedded, ${failed} failed. Total: ${updated.embedded_messages}/${updated.total_messages}`
    );
  }
}
