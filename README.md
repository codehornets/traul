# traul

Personal Intelligence Engine — aggregates communication streams into a searchable local index.

Traul syncs messages from multiple sources into a local SQLite database with full-text and vector search.

Supported connectors:
- Slack
- Telegram
- Linear
- Markdown files
- Claude Code sessions

## Features

- **Multi-source sync** — Slack (multi-workspace, xoxc/xoxb tokens), Telegram (via Telethon), Linear (multi-workspace GraphQL), Claude Code sessions, Markdown files
- **Hybrid search** — FTS5 full-text search + vector similarity via Ollama embeddings
- **Contact dedup** (WIP) — basic identity tracking across sources, proper contact API planned
- **Local-first** — all data stays in a local SQLite database

## Requirements

- [Bun](https://bun.sh) v1.0+
- [Homebrew SQLite](https://formulae.brew.sh/formula/sqlite) (macOS — Apple's SQLite lacks extension support)
- [Ollama](https://ollama.com) (optional, for vector embeddings)
- [Python 3](https://www.python.org) + [Telethon](https://docs.telethon.dev) (optional, for Telegram sync)

See **[Getting Started](docs/getting-started.md)** for a full walkthrough with all prerequisites.

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
| `TRAUL_EMBED_MODEL` | Embedding model (default: `snowflake-arctic-embed2`) |

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

# OR mode — match ANY term instead of ALL (use with --fts or hybrid)
traul search "deposit withdraw broken" --fts --or

# Substring search — bypasses FTS tokenization, useful for exact phrases
traul search "how do I" --like -s discord -l 20

# Generate embeddings for vector search
traul embed

# Browse channels and messages
traul channels
traul messages general --limit 50
```

## Architecture

```
src/
├── commands/       CLI command handlers
├── connectors/     Source integrations (Slack, Telegram, Linear, Claude Code, Markdown)
├── db/             SQLite schema, queries, database wrapper
├── lib/            Config, embeddings, formatting, logging
```

Data flows: **sources → connectors → SQLite (FTS5 + vec0) → search → user**.

## Development

```sh
bun test          # run tests
bun run dev       # run CLI in dev mode
```

## License

Private.
