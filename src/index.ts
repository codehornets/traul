#!/usr/bin/env bun
import { Command } from "commander";
import { TraulDB } from "./db/database";
import { loadConfig, ensureDbDir } from "./lib/config";
import { setVerbose } from "./lib/logger";
import { runSync } from "./commands/sync";
import { runSearch } from "./commands/search";
import {
  runSignalsList,
  runSignalsEvaluate,
  runSignalsDismiss,
} from "./commands/signals";
import { runBriefing } from "./commands/briefing";
import { runMessages } from "./commands/messages";
import { runChannels } from "./commands/channels";
import { runEmbed } from "./commands/embed";

const config = loadConfig();
ensureDbDir(config.database.path);
const db = new TraulDB(config.database.path);

const program = new Command();

program
  .name("traul")
  .description("Traul — Personal Intelligence Engine")
  .version("0.1.0")
  .option("-v, --verbose", "enable verbose output")
  .hook("preAction", () => {
    if (program.opts().verbose) {
      setVerbose(true);
    }
  });

program
  .command("sync")
  .description("Sync messages from communication sources")
  .argument("[source]", "source to sync (e.g. slack)")
  .action(async (source?: string) => {
    await runSync(db, config, source);
    db.close();
  });

program
  .command("search")
  .description(
    "Search messages (hybrid vector+keyword by default, requires Ollama)"
  )
  .argument("<query>", "search query (natural language or keywords)")
  .option("-s, --source <source>", "filter by source")
  .option("-c, --channel <channel>", "filter by channel name")
  .option("-a, --after <date>", "messages after date (ISO 8601)")
  .option("-b, --before <date>", "messages before date (ISO 8601)")
  .option("-l, --limit <n>", "max results", "20")
  .option("--json", "output as JSON")
  .option(
    "--fts",
    "keyword-only search (FTS5/BM25, no vector search). Faster but requires all terms to match — use hybrid for multi-word or exploratory queries"
  )
  .action(async (query: string, options) => {
    await runSearch(db, query, options);
    db.close();
  });

const signalsCmd = program
  .command("signals")
  .description("View and manage signal results")
  .option("--json", "output as JSON")
  .action((options) => {
    runSignalsList(db, options);
    db.close();
  });

signalsCmd
  .command("run")
  .description("Evaluate all enabled signal definitions")
  .action(() => {
    runSignalsEvaluate(db, config);
    db.close();
  });

signalsCmd
  .command("dismiss")
  .description("Dismiss a signal result")
  .argument("<id>", "signal result ID")
  .action((id: string) => {
    runSignalsDismiss(db, id);
    db.close();
  });

program
  .command("messages")
  .description("Browse messages chronologically")
  .argument("[channel]", "channel name (exact match)")
  .option("-c, --channel <name>", "channel name (substring match)")
  .option("-a, --author <name>", "filter by author name")
  .option("-s, --source <source>", "filter by source (telegram, slack)")
  .option("--after <date>", "messages after ISO date")
  .option("--before <date>", "messages before ISO date")
  .option("-l, --limit <n>", "max results (default: 50)")
  .option("--json", "output as JSON")
  .option("--asc", "oldest first")
  .action((channel: string | undefined, options) => {
    runMessages(db, channel, options);
    db.close();
  });

program
  .command("channels")
  .description("List known channels with message counts")
  .option("-s, --source <source>", "filter by source")
  .option("--search <term>", "substring search in channel name")
  .option("--json", "output as JSON")
  .action((options) => {
    runChannels(db, options);
    db.close();
  });

program
  .command("embed")
  .description("Generate vector embeddings for messages (requires Ollama)")
  .option("-l, --limit <n>", "max messages to embed per run", "500")
  .option("-q, --quiet", "minimal output")
  .action(async (options) => {
    await runEmbed(db, options);
    db.close();
  });

program
  .command("briefing")
  .description("Show a structured briefing with signals, stats, and volume")
  .action(() => {
    runBriefing(db);
    db.close();
  });

program.parse();
