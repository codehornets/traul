# traul

Personal Intelligence Engine — watches communication streams, identifies patterns, and surfaces actionable insights.

Traul aggregates messages from Slack, Telegram, and Linear into a local SQLite database with full-text and vector search, then runs automated signal detection to highlight what needs your attention.

## Features

- **Multi-source sync** — Slack (multi-workspace, xoxc/xoxb tokens), Telegram (via Telethon), Linear (multi-workspace GraphQL), Claude Code sessions, Markdown files
- **Hybrid search** — FTS5 full-text search + vector similarity via Ollama embeddings
- **Signal detection** — pattern-based alerts (e.g. stale threads) with dismiss/snooze
- **Briefings** — structured daily summary with signal counts, message volume, and highlights
- **Contact dedup** — unified identities across sources
- **Local-first** — all data stays in a local SQLite database

## Requirements

- [Bun](https://bun.sh) v1.0+
- [Ollama](https://ollama.com) (optional, for vector embeddings)

## Install

```sh
git clone <repo-url> && cd traul
bun install
bun link
```

## Configuration

### Environment variables

| Variable | Description |
|----------|-------------|
| `SLACK_TOKEN` | Default Slack token (xoxb or xoxc) |
| `SLACK_COOKIE` | Browser cookie (required for xoxc tokens) |
| `SLACK_TOKEN_<WORKSPACE>` | Per-workspace Slack token |
| `SLACK_COOKIE_<WORKSPACE>` | Per-workspace cookie |
| `LINEAR_API_KEY` | Default Linear API key |
| `LINEAR_API_KEY_<WORKSPACE>` | Per-workspace Linear key |
| `TELEGRAM_API_ID` | Telegram API app ID |
| `TELEGRAM_API_HASH` | Telegram API app hash |
| `TRAUL_DB_PATH` | Custom database path |
| `OLLAMA_URL` | Ollama server URL (default: `http://localhost:11434`) |
| `TRAUL_EMBED_MODEL` | Embedding model (default: `nomic-embed-text`) |

### Config file

Optional JSON config at `~/.config/traul/config.json`:

```json
{
  "markdown": {
    "dirs": ["~/notes", "~/docs"]
  }
}
```

## Usage

```sh
# Sync messages from all configured sources
traul sync

# Sync a specific source
traul sync slack
traul sync telegram
traul sync linear
traul sync claude-code
traul sync markdown

# Search messages (hybrid vector+keyword by default, requires Ollama)
# Best for multi-word and exploratory queries — finds semantically
# related messages even when exact keywords don't all appear
traul search "deployment issue"
traul search "metrics mixpanel registration" --source slack --after 2025-01-01

# Keyword-only search (FTS5/BM25, no Ollama needed)
# Faster, but requires ALL terms to match — can miss results on broad queries
traul search "error" --fts

# Generate embeddings for vector search
traul embed

# Browse channels and messages
traul channels
traul messages general --limit 50

# View detected signals
traul signals
traul signals run
traul signals dismiss <id>

# Daily briefing
traul briefing
```

## Architecture

```
src/
├── commands/       CLI command handlers
├── connectors/     Source integrations (Slack, Telegram, Linear, Claude Code, Markdown)
├── db/             SQLite schema, queries, database wrapper
├── lib/            Config, embeddings, formatting, logging
└── signals/        Pattern detection engine + definitions
```

Data flows: **sources → connectors → SQLite (FTS5 + vec0) → commands/signals → user**.

## Development

```sh
bun test          # run tests
bun run dev       # run CLI in dev mode
```

## License

Private.
