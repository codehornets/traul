# traul

Personal Intelligence Engine — aggregates communication streams into a searchable local index.

Traul syncs messages from multiple sources into a local SQLite database with full-text and vector search.

Supported connectors:
- Slack
- Discord
- Telegram
- Gmail
- Linear
- WhatsApp (via WAHA)
- Markdown files
- Claude Code sessions

## Features

- **Multi-source sync** — Slack (multi-workspace, xoxc/xoxb tokens), Discord (bot token, server/channel filtering), Telegram (via Telethon), Gmail (OAuth2, multi-account, label filtering), Linear (multi-workspace GraphQL), WhatsApp (via WAHA), Claude Code sessions, Markdown files
- **Hybrid search** — FTS5 full-text search + vector similarity via Ollama embeddings
- **Background daemon** — scheduled sync and embedding with health monitoring
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
| `DISCORD_TOKEN` | Discord bot token |
| `TELEGRAM_API_ID` | Telegram API app ID |
| `TELEGRAM_API_HASH` | Telegram API app hash |
| `GMAIL_CLIENT_ID` | Gmail OAuth2 client ID |
| `GMAIL_CLIENT_SECRET` | Gmail OAuth2 client secret |
| `GMAIL_REFRESH_TOKEN` | Gmail OAuth2 refresh token |
| `GMAIL_CREDS_JSON` | Combined Gmail credentials JSON (alternative) |
| `LINEAR_API_KEY` | Default Linear API key |
| `LINEAR_API_KEY_<WORKSPACE>` | Per-workspace Linear key |
| `TRAUL_DB_PATH` | Custom database path |
| `OLLAMA_URL` | Ollama server URL (default: `http://localhost:11434`) |
| `TRAUL_EMBED_MODEL` | Embedding model (default: `snowflake-arctic-embed2`) |

### Config file

Optional JSON config at `~/.config/traul/config.json`:

```json
{
  "markdown": {
    "dirs": ["~/notes", "~/docs"]
  },
  "discord": {
    "token": "...",
    "servers": { "allowlist": ["guild-id"] },
    "channels": { "stoplist": ["channel-id"] }
  },
  "gmail": {
    "client_id": "...",
    "client_secret": "...",
    "refresh_token": "...",
    "accounts": [{ "name": "work", "labels": ["INBOX"] }]
  },
  "whatsapp": {
    "instances": [{ "name": "main", "url": "http://localhost:3000", "api_key": "...", "session": "default" }]
  },
  "daemon": {
    "port": 7333,
    "intervals": { "embed": 600 }
  }
}
```

## Usage

```sh
# Sync messages from all configured sources
traul sync

# Sync a specific source
traul sync slack
traul sync discord
traul sync telegram
traul sync gmail
traul sync linear
traul sync whatsapp
traul sync claude-code
traul sync markdown

# Search messages (hybrid vector+keyword by default, requires Ollama)
traul search "deployment issue"
traul search "metrics mixpanel registration" --source slack --after 2025-01-01

# Keyword-only search (FTS5/BM25, no Ollama needed)
traul search "error" --fts

# OR mode — match ANY term instead of ALL
traul search "deposit withdraw broken" --fts --or

# Substring search — bypasses FTS tokenization, useful for exact phrases
traul search "how do I" --like -s discord -l 20

# JSON output (available on search, messages, channels, stats)
traul search "error" --fts --json

# Generate embeddings for vector search
traul embed
traul embed --rechunk    # re-chunk long messages embedded before chunking
traul reset-embed        # drop all embeddings and recreate

# Browse channels and messages
traul channels
traul channels --search general --json
traul messages general --limit 50
traul messages --channel general --author john --after 2025-01-01 --asc

# Database statistics
traul stats
traul stats --json

# Background daemon
traul daemon start           # foreground
traul daemon start --detach  # background
traul daemon stop
traul daemon status

# WhatsApp authentication
traul whatsapp auth <account>
```

## Architecture

```
src/
├── commands/       CLI command handlers
├── connectors/     Source integrations (Slack, Discord, Telegram, Gmail, Linear, WhatsApp, Claude Code, Markdown)
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
