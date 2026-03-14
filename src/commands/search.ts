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
    semantic?: boolean;
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
  if (options.semantic) {
    const vec = await embed(query);
    results = db.hybridSearch(query, vecToBytes(vec), searchOpts);
  } else {
    results = db.searchMessages(query, searchOpts);
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
