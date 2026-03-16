#!/usr/bin/env bun
import { Command } from "commander";
import { TraulDB } from "./db/database";
import { loadConfig, ensureDbDir } from "./lib/config";
import { setVerbose } from "./lib/logger";
import { runSync } from "./commands/sync";
import { runSearch } from "./commands/search";
import { runMessages } from "./commands/messages";
import { runChannels } from "./commands/channels";
import { runEmbed } from "./commands/embed";
import { runStats } from "./commands/stats";
import { runWhatsAppAuth } from "./commands/whatsapp-auth";
import { runDaemonStart, runDaemonStop, runDaemonStatus } from "./commands/daemon";

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
  .option("--from <date>", "alias for --after")
  .option("--to <date>", "alias for --before")
  .option("-l, --limit <n>", "max results", "20")
  .option("--json", "output as JSON")
  .option(
    "--fts",
    "keyword-only search (FTS5/BM25, no vector search). Faster but requires all terms to match — use hybrid for multi-word or exploratory queries"
  )
  .option("--or", "join search terms with OR instead of AND (use with --fts)")
  .option(
    "--like",
    "substring match (LIKE) — bypasses FTS, useful for exact phrases"
  )
  .action(async (query: string, options) => {
    options.after = options.after || options.from;
    options.before = options.before || options.to;
    await runSearch(db, query, options);
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
  .option("--from <date>", "alias for --after")
  .option("--to <date>", "alias for --before")
  .option("-l, --limit <n>", "max results (default: 50)")
  .option("--json", "output as JSON")
  .option("--asc", "oldest first")
  .action((channel: string | undefined, options) => {
    options.after = options.after || options.from;
    options.before = options.before || options.to;
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
  .command("stats")
  .description("Show database statistics")
  .option("--json", "output as JSON")
  .action(async (options) => {
    await runStats(db, config, options);
    db.close();
  });

program
  .command("embed")
  .description("Generate vector embeddings for messages (requires Ollama)")
  .option("-l, --limit <n>", "max messages to embed per run (0 = all)", "500")
  .option("-q, --quiet", "minimal output")
  .option("--rechunk", "re-chunk long messages that were embedded whole (pre-chunking)")
  .action(async (options) => {
    await runEmbed(db, options);
    db.close();
  });

program
  .command("reset-embed")
  .description("Drop all embeddings and recreate vec tables (run 'embed' after to regenerate)")
  .action(async () => {
    const { EMBED_DIMS } = await import("./lib/embeddings");
    console.log(`Resetting vec tables to ${EMBED_DIMS} dimensions...`);
    db.resetEmbeddings(EMBED_DIMS);
    console.log("Done. Run 'traul embed' to regenerate embeddings.");
    db.close();
  });

const whatsapp = program
  .command("whatsapp")
  .description("WhatsApp connector commands");

whatsapp
  .command("auth")
  .description("Authenticate a WhatsApp account via WAHA QR code")
  .argument("<account>", "account name matching config instance name")
  .action(async (account: string) => {
    await runWhatsAppAuth(config, account);
    process.exit(0);
  });

const daemon = program
  .command("daemon")
  .description("Background sync daemon");

daemon
  .command("start", { isDefault: true })
  .description("Start the daemon (foreground by default)")
  .option("--detach", "run in background")
  .action(async (options) => {
    await runDaemonStart(db, config, options);
  });

daemon
  .command("stop")
  .description("Stop the running daemon")
  .action(() => {
    runDaemonStop();
  });

daemon
  .command("status")
  .description("Check daemon status")
  .action(async () => {
    await runDaemonStatus(config);
    process.exit(0);
  });

program.parse();
