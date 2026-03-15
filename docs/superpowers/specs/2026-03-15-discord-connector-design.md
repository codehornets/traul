# Discord Connector Design

## Overview

Add a Discord connector to traul using Discord's REST API with a user token (self-bot approach). Syncs server channels, DMs, group DMs, and threads into the unified message store for vector search.

## Config

```typescript
discord: {
  token: string;           // from DISCORD_TOKEN env var or config file
  servers: {
    allowlist: string[];   // guild IDs — if set, sync ONLY these servers
    stoplist: string[];    // guild IDs — exclude these servers
  };
  channels: {
    allowlist: string[];   // channel IDs — if set, sync ONLY these channels
    stoplist: string[];    // channel IDs — exclude these channels
  };
}
```

- Token sourced from `DISCORD_TOKEN` env var, fallback to `discord.token` in config file
- Allowlist and stoplist coexist: allowlist narrows first, stoplist removes from the result
- DMs/group DMs are not affected by server filters, only by channel filters
- Note: if `channels.allowlist` is set for specific server channels, DMs are excluded unless their IDs are also in the allowlist. To sync everything except specific channels, use `channels.stoplist` instead

## API & Auth

**Endpoints:**

- `GET /api/v9/users/@me/guilds` — list user's servers (paginated via `after`)
- `GET /api/v9/guilds/{id}/channels` — list channels in a server
- `GET /api/v9/users/@me/channels` — list DMs and group DMs
- `GET /api/v9/channels/{id}/messages?limit=100` — fetch message history (cursor via `before`/`after`)
- `GET /api/v9/channels/{id}/threads/archived/public` — list archived public threads
- `GET /api/v9/channels/{id}/threads/archived/private` — list archived private threads

**Auth:** `Authorization: {token}` header (no "Bot " prefix).

**Base URL:** `https://discord.com/api/v9`

## Rate Limiting

Dual strategy — dynamic headers with a minimum floor delay:

1. Parse `X-RateLimit-Remaining` and `X-RateLimit-Reset-After` from every response
2. When `Remaining` hits 0, sleep for `Reset-After` seconds
3. On 429 response, read `Retry-After` header and wait, then retry the same request (max 5 retries per request, then fail)
4. Minimum floor delay of 100ms between all requests regardless of rate limit state

## Sync Flow

1. Fetch all guilds the user is a member of
2. Filter by `servers.allowlist` (if non-empty), then remove `servers.stoplist`
3. For each guild, fetch all text channels
4. Filter by `channels.allowlist` (if non-empty), then remove `channels.stoplist`
5. Fetch DM and group DM channels (skip any in `channels.stoplist`)
6. For each channel:
   - Read sync cursor (last synced message ID for that channel)
   - Fetch messages newer than cursor using `after={cursor_id}`, paginate forward
   - For messages with threads, fetch thread messages with `thread_id` set to parent message ID
   - Save latest message ID as new sync cursor

### Initial vs Incremental Sync

- **First sync:** Convert `sync_start` config date to a Discord snowflake ID using `snowflake = (timestamp_ms - 1420070400000) << 22`, use as the initial `after` parameter
- **Subsequent syncs:** Resume from last cursor (message ID) per channel

## Data Mapping

| Discord field | traul field |
|---|---|
| `channel.id` | `channel_id` |
| `guild.name/channel.name` | `channel_name` |
| `message.id` | `source_id` (as `channel_id:message_id`) |
| `message.author.id` | `author_id` |
| `message.author.username` | `author_name` |
| `message.content` | `content` |
| `message.timestamp` (ISO 8601) | `sent_at` (unix epoch) |
| parent message ID (if in thread) | `thread_id` |

### Channel Naming Convention

- Server channels: `ServerName/channel-name`
- DMs: `DM/username`
- Group DMs: `GroupDM/user1, user2, ...`

### Contacts

Create/link contacts from `message.author` using the same pattern as Slack's `resolveUser`:
- Cache user lookups in memory during sync
- Create contact + contact_identity on first encounter
- Source: `"discord"`, source_user_id: Discord user ID

## Content Handling

- Messages with empty `content` but attachments/embeds: store fallback text (e.g., `[attachment: image.png]`, `[embed: Article Title]`)
- System messages (user joined, pinned, etc.): skip — same as Slack's subtype filtering
- Discord message types to skip: types other than `0` (DEFAULT) and `19` (REPLY)

## Error Handling

- **401/403 on a channel:** log warning, skip channel, continue sync
- **429 rate limit:** wait `Retry-After`, retry same request
- **Network errors:** fail the sync (same as other connectors — let the caller handle retries)

## Thread Handling

Threads in Discord are channels with a `parent_id`. During sync:
- Active threads are listed via guild channel listing (type 11 = public thread, type 12 = private thread)
- Archived threads fetched via `/channels/{parent_id}/threads/archived/public` and `/threads/archived/private`
- Thread messages stored with `thread_id` = thread's parent message ID (the message that started the thread)
- Thread channel name follows parent: `ServerName/channel-name` (thread messages distinguished by `thread_id`)

## Implementation Approach

- Direct `fetch()` calls to Discord REST API — no external dependencies
- Single file: `src/connectors/discord.ts`
- Register in `src/commands/sync.ts`
- Add `discord` config type to `src/lib/config.ts`
- Follow existing connector patterns exactly (sync cursors, contact resolution, upsertMessage)

## Filtering Logic (pseudocode)

```
guilds = fetchUserGuilds()
if servers.allowlist.length > 0:
  guilds = guilds.filter(g => servers.allowlist.includes(g.id))
if servers.stoplist.length > 0:
  guilds = guilds.filter(g => !servers.stoplist.includes(g.id))

channels = []
for guild in guilds:
  channels.push(...fetchGuildTextChannels(guild.id))

if channels.allowlist.length > 0:
  channels = channels.filter(c => channels.allowlist.includes(c.id))
if channels.stoplist.length > 0:
  channels = channels.filter(c => !channels.stoplist.includes(c.id))

// DMs (not affected by server filters)
dmChannels = fetchDMChannels()
if channels.stoplist.length > 0:
  dmChannels = dmChannels.filter(c => !channels.stoplist.includes(c.id))
if channels.allowlist.length > 0:
  dmChannels = dmChannels.filter(c => channels.allowlist.includes(c.id))

allChannels = [...channels, ...dmChannels]
```
