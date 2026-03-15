import type { TraulDB } from "../db/database";

export function runStats(db: TraulDB, options: { json?: boolean }): void {
  const stats = db.getDetailedStats();

  if (options.json) {
    console.log(JSON.stringify(stats, null, 2));
    return;
  }

  // DB size
  console.log(`Database size: ${formatBytes(stats.db_size)}`);
  console.log();

  // Per-source/channel breakdown
  console.log("Messages by channel:");
  console.log("-".repeat(70));

  let currentSource = "";
  let sourceTotal = 0;

  for (const row of stats.channels) {
    if (row.source !== currentSource) {
      if (currentSource) {
        console.log(`  ${"".padEnd(40)} ${String(sourceTotal).padStart(8)}`);
        console.log();
      }
      currentSource = row.source;
      sourceTotal = 0;
      console.log(`  ${row.source}`);
    }
    sourceTotal += row.msg_count;
    const name = truncate(row.channel_name || "(no channel)", 38);
    console.log(`    ${name.padEnd(38)} ${String(row.msg_count).padStart(8)}`);
  }
  if (currentSource) {
    console.log(`  ${"".padEnd(40)} ${String(sourceTotal).padStart(8)}`);
  }

  console.log("-".repeat(70));
  console.log(`  ${"Total messages".padEnd(40)} ${String(stats.total_messages).padStart(8)}`);
  console.log(`  ${"Total channels".padEnd(40)} ${String(stats.total_channels).padStart(8)}`);
  console.log(`  ${"Total contacts".padEnd(40)} ${String(stats.total_contacts).padStart(8)}`);
  console.log();

  // Chunks & embeddings
  console.log("Embeddings:");
  console.log(`  ${"Message embeddings".padEnd(40)} ${String(stats.embedded_messages).padStart(8)} / ${stats.total_messages}`);
  console.log(`  ${"Chunks".padEnd(40)} ${String(stats.total_chunks).padStart(8)}`);
  console.log(`  ${"Chunk embeddings".padEnd(40)} ${String(stats.embedded_chunks).padStart(8)} / ${stats.total_chunks}`);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 3) + "...";
}
