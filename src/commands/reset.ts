import type { TraulDB } from "../db/database";
import { EMBED_DIMS } from "../lib/embeddings";

type Layer = "sync" | "chunks" | "embed" | "all";

const VALID_LAYERS: Layer[] = ["sync", "chunks", "embed", "all"];

export function runReset(
  db: TraulDB,
  layer: string,
  options: { source?: string }
): void {
  if (!VALID_LAYERS.includes(layer as Layer)) {
    throw new Error(`Unknown layer: ${layer}. Valid layers: ${VALID_LAYERS.join(", ")}`);
  }

  const doSync = layer === "sync" || layer === "all";
  const doChunks = layer === "chunks" || layer === "all";
  const doEmbed = layer === "embed" || layer === "all" || layer === "chunks";

  if (doSync) {
    db.resetSyncCursors(options.source);
    const scope = options.source ? `${options.source} sync cursors` : "all sync cursors";
    console.log(`Reset ${scope}. Run 'traul sync' to refetch.`);
  }

  if (doChunks) {
    db.resetChunks();
    console.log("Reset all chunks. They will be regenerated on next 'traul sync' or 'traul embed'.");
  }

  if (doEmbed) {
    db.resetEmbeddings(EMBED_DIMS);
    console.log("Reset all embeddings. Run 'traul embed' to regenerate.");
  }
}
