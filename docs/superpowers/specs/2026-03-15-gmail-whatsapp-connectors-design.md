# Gmail & WhatsApp Connectors Design

## Overview

Add two new connectors to traul: Gmail (via Google OAuth2 API) and WhatsApp (via WAHA self-hosted API). Both support multiple accounts and follow existing connector patterns.

## Gmail Connector

### Auth Flow

OAuth2 with refresh token. One-time browser consent per account.

1. User runs `traul gmail auth <account-name>` (e.g., `traul gmail auth personal`)
2. CLI starts local HTTP server on a random port, opens browser to Google consent screen
3. User grants access, Google redirects to localhost with auth code
4. CLI exchanges code for access + refresh tokens, saves to `~/.config/traul/gmail/<account-name>.json`
5. On subsequent syncs, refresh token is used automatically. If expired, user is prompted to re-auth.

**Scopes:** `https://www.googleapis.com/auth/gmail.readonly`

**Google Cloud Setup (user responsibility):** Create OAuth2 client ID (Desktop type) in Google Cloud Console. Set `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` env vars, or add to config.

### Data Mapping

| Gmail concept   | traul field                                                        |
| --------------- | ------------------------------------------------------------------ |
| Thread ID       | `channel_id` = `<account>:<thread_id>`                             |
| Thread subject  | `channel_name` (truncated to 200 chars, "(no subject)" if empty)   |
| Thread ID       | `thread_id`                                                        |
| Message ID      | `source_id` = `<account>:<message_id>`                             |
| From address    | `author_name` (display name or email)                              |
| Email body      | `content` (plain text preferred, HTML stripped via `html-to-text`) |
| Date header     | `sent_at` (unix timestamp)                                         |
| Labels, snippet | `metadata` JSON                                                    |
| Source          | `"gmail"`                                                          |

### Sync Strategy

- List all messages newer than sync cursor (or `sync_start` config)
- Use `messages.list` for IDs, then `messages.get` with concurrency limit of 20 via `Promise.all` batches
- Cursor key per account: `<account>:all` (syncs everything). Storing latest `internalDate`
- Each connector `sync()` call internally loops over all configured accounts (same pattern as Linear multi-workspace)
- Contacts: extract From/To/Cc addresses, create contact identities with source `"gmail"`
- Token file permissions set to `0600` on creation

### Config

```json
{
  "gmail": {
    "client_id": "",
    "client_secret": "",
    "accounts": [
      { "name": "personal", "labels": [] },
      { "name": "work", "labels": ["INBOX"] }
    ]
  }
}
```

- `labels`: filter to specific labels. Empty = all messages.
- Env overrides: `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`
- Token files: `~/.config/traul/gmail/<name>.json` (auto-created by auth flow)

### Dependencies

- `googleapis` npm package (Google APIs Node.js client)
- `html-to-text` npm package (for stripping HTML from email bodies)

## WhatsApp Connector (WAHA)

### Architecture

WAHA runs as a Docker container exposing a REST API. Each WhatsApp account = one WAHA instance.

traul will:

1. Include a `docker-compose.yml` for WAHA in the project
2. Connector calls WAHA REST API to fetch chats and messages

### WAHA Setup

`docker-compose.waha.yml` at project root:

```yaml
services:
  waha:
    image: devlikeapro/waha
    ports:
      - "3000:3000"
    environment:
      - WAHA_DEFAULT_ENGINE=WEBJS
    volumes:
      - waha_data:/app/.sessions
    restart: unless-stopped

volumes:
  waha_data:
```

For multiple accounts, user adds more services with different ports. Connection managed via config.

### Auth Flow

1. User starts WAHA container(s)
2. Runs `traul whatsapp auth <account-name>` which calls `POST /api/sessions/start` + `GET /api/<session>/auth/qr` to display QR code in terminal
3. User scans QR with WhatsApp mobile app
4. Session persists in WAHA's Docker volume

### Data Mapping

| WhatsApp concept                       | traul field                              |
| -------------------------------------- | ---------------------------------------- |
| Chat name (contact name or group name) | `channel_name`                           |
| Chat ID (e.g., `5511999999999@c.us`)   | `channel_id`                             |
| Message ID                             | `source_id` = `<account>:<message_id>`   |
| Sender name                            | `author_name`                            |
| Message body                           | `content` (text messages only initially) |
| Timestamp                              | `sent_at`                                |
| hasMedia, fromMe, ack                  | `metadata` JSON                          |
| Source                                 | `"whatsapp"`                             |

### Sync Strategy

- `GET /api/{session}/chats` to list all chats (or filter to configured list)
- `GET /api/{session}/chats/{chatId}/messages?limit=100&offset=<n>` to paginate messages per chat
- Text messages synced directly; media messages stored with placeholder content: `[media: image]`, `[media: video]`, `[media: audio]`, `[media: document]`
- Cursor key: `<account>:chat:<chatId>` storing latest message timestamp
- Contacts: extracted from chat participant info

### Config

```json
{
  "whatsapp": {
    "instances": [
      {
        "name": "personal",
        "url": "http://localhost:3000",
        "api_key": "",
        "session": "default",
        "chats": []
      }
    ]
  }
}
```

- `chats`: filter to specific chat IDs or names. Empty = all chats.
- `session`: WAHA session name (default: `"default"`)
- `api_key`: WAHA API key if configured

### Dependencies

- No npm packages needed (plain HTTP fetch to WAHA REST API)
- Docker required for WAHA runtime

## Changes to Existing Code

### `src/lib/config.ts`

Add to `TraulConfig`:

```typescript
gmail: {
  client_id: string;
  client_secret: string;
  accounts: Array<{ name: string; labels: string[] }>;
}
whatsapp: {
  instances: Array<{
    name: string;
    url: string;
    api_key: string;
    session: string;
    chats: string[];
  }>;
}
```

Add env var overrides for `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`.

Add defaults in `getDefaultConfig()`:

```typescript
gmail: { client_id: "", client_secret: "", accounts: [] },
whatsapp: { instances: [] },
```

### `src/commands/sync.ts`

Import and add `gmailConnector` and `whatsappConnector` to the connectors array.

### `src/index.ts`

Add CLI commands:

- `traul gmail auth <account>` — run OAuth2 flow
- `traul whatsapp auth <account>` — start WAHA session + display QR

### New Files

| File                            | Purpose                                |
| ------------------------------- | -------------------------------------- |
| `src/connectors/gmail.ts`       | Gmail connector implementation         |
| `src/connectors/whatsapp.ts`    | WhatsApp/WAHA connector implementation |
| `src/commands/gmail-auth.ts`    | OAuth2 browser auth flow               |
| `src/commands/whatsapp-auth.ts` | WAHA session + QR code display         |
| `docker-compose.waha.yml`       | WAHA Docker setup                      |

## Error Handling

- Gmail: token refresh failures prompt re-auth message. API quota errors logged with backoff.
- WhatsApp: WAHA unreachable → skip with warning. Session not authenticated → prompt to run auth command.
- Both: follow existing pattern of returning `{ messagesAdded: 0, ... }` on config/auth issues rather than throwing.

## Testing Strategy

- Manual testing against real accounts
- Auth flows tested separately from sync logic
