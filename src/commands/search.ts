import type { TraulDB } from "../db/database";
import { formatMessage, formatJSON } from "../lib/formatter";
import { embed, vecToBytes } from "../lib/embeddings";

export async function runSearch(
  db: TraulDB,
  query: string,
  options: {
    source?: string;
    channel?: string;
    after?: string;
    before?: string;
    limit?: string;
    json?: boolean;
    fts?: boolean;
  }
): Promise<void> {
  const limit = options.limit ? parseInt(options.limit, 10) : 20;
  const after = options.after
    ? Math.floor(new Date(options.after).getTime() / 1000)
    : undefined;
  const before = options.before
    ? Math.floor(new Date(options.before).getTime() / 1000)
    : undefined;

  const searchOpts = {
    source: options.source,
    channel: options.channel,
    after,
    before,
    limit,
  };

  let results;
  if (options.fts) {
    // Merge message FTS + chunk FTS results
    const msgResults = db.searchMessages(query, searchOpts);
    const chunkResults = db.searchChunks(query, searchOpts);
    const seen = new Set<string>();
    results = [];
    for (const r of [...msgResults, ...chunkResults]) {
      const key = `${r.id}:${r.content.slice(0, 50)}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push(r);
      }
    }
    results = results.slice(0, limit);
  } else {
    // Hybrid by default, fall back to FTS if Ollama is unavailable
    try {
      const vec = await embed(query);
      results = db.hybridSearch(query, vecToBytes(vec), searchOpts);
    } catch {
      results = db.searchMessages(query, searchOpts);
    }
  }

  if (results.length === 0) {
    console.log("No results found.");
    return;
  }

  if (options.json) {
    console.log(formatJSON(results));
  } else {
    for (const msg of results) {
      console.log(formatMessage(msg));
    }
  }
}
