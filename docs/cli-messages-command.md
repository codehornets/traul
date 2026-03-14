# Feature: `traul messages` command

## Problem

Today `traul search` requires an FTS query — there's no way to simply browse/list messages by channel. When Claude needs to review a chat (e.g. check if a kids' community chat is appropriate), it has to fall back to raw SQLite queries against the DB.

## Proposed CLI interface

```bash
# List messages from a channel, newest first
traul messages "Чат клубнички <3" --limit 100

# With date filters
traul messages "Чат клубнички <3" --after 2026-03-01 --before 2026-03-14

# Filter by author
traul messages "Чат клубнички <3" --author "Клубничка"

# Fuzzy channel match (substring, case-insensitive)
traul messages --channel "клубничк" --limit 50

# Output as JSON for programmatic use
traul messages "Чат клубнички <3" --limit 100 --json

# List available channels (for discovery)
traul channels
traul channels --source telegram
traul channels --search "клубничк"
```

## Commands to add

### `traul messages [channel]`

Browse messages chronologically (no FTS required).

| Option | Description |
|--------|-------------|
| `channel` | Channel name (exact or substring match) |
| `--channel, -c <name>` | Alternative channel filter (substring) |
| `--author, -a <name>` | Filter by author name |
| `--source, -s <src>` | Filter by source (telegram, slack) |
| `--after <date>` | Messages after ISO date |
| `--before <date>` | Messages before ISO date |
| `--limit, -l <n>` | Max results (default: 50) |
| `--json` | Output as JSON |
| `--asc` | Oldest first (default: newest first) |

Output format (plain):
```
2026-03-07 10:53  💎Мирослава💎
Думаю да

2026-03-07 10:05  Dasashch
Норм для 13 лет?

2026-03-05 18:02  💎Мирослава💎
Все хорошо, спасибо;)
```

Output format (JSON):
```json
[
  {
    "sent_at": "2026-03-07T10:53:42Z",
    "author": "💎Мирослава💎",
    "content": "Думаю да",
    "channel": "Чат клубнички <3",
    "source": "telegram"
  }
]
```

### `traul channels`

List known channels with message counts.

| Option | Description |
|--------|-------------|
| `--source, -s <src>` | Filter by source |
| `--search <term>` | Substring search in channel name |
| `--json` | Output as JSON |

Output format:
```
telegram  Чат клубнички <3          142 msgs  last: 2026-03-07
telegram  IT&VC Unicorns 🦄          89 msgs  last: 2026-03-12
slack     general                   1204 msgs  last: 2026-03-14
```

## DB queries needed

### Messages query
```sql
SELECT m.id, m.source, m.channel_name, m.author_name, m.content, m.sent_at, m.metadata
FROM messages m
WHERE 1=1
  [AND m.channel_name = ?]           -- exact match when positional arg
  [AND m.channel_name LIKE '%?%']    -- substring when --channel flag
  [AND m.author_name LIKE '%?%']
  [AND m.source = ?]
  [AND m.sent_at >= ?]
  [AND m.sent_at <= ?]
ORDER BY m.sent_at DESC
LIMIT ?
```

### Channels query
```sql
SELECT source, channel_name,
       COUNT(*) AS msg_count,
       MAX(sent_at) AS last_message
FROM messages
GROUP BY source, channel_name
[WHERE channel_name LIKE '%?%']
[WHERE source = ?]
ORDER BY last_message DESC
```

## Implementation notes

- Add `GET_MESSAGES` and `GET_CHANNELS` to `src/db/queries.ts`
- Add `getMessages()` and `getChannels()` methods to `TraulDB` class
- Create `src/commands/messages.ts` and `src/commands/channels.ts`
- Register in `src/index.ts`
- Channel positional arg uses exact match; `--channel` flag uses LIKE substring match
- Dates should accept ISO 8601 strings and convert to unix timestamps
