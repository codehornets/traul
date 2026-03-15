# Gmail & WhatsApp Connectors Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Gmail and WhatsApp (WAHA) connectors to traul, supporting multi-account sync with incremental cursors.

**Architecture:** Two new connectors following the existing `Connector` interface pattern. Gmail uses `googleapis` OAuth2 with local token storage. WhatsApp uses WAHA's REST API via plain `fetch`. Both loop over multiple accounts internally (like Linear's multi-workspace pattern). Config and CLI commands extended to support auth flows.

**Tech Stack:** `googleapis`, `html-to-text`, WAHA Docker (devlikeapro/waha), Commander.js CLI

**Spec:** `docs/superpowers/specs/2026-03-15-gmail-whatsapp-connectors-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `src/connectors/gmail.ts` | Gmail connector: OAuth2 client setup, message listing, body extraction, multi-account sync loop |
| `src/connectors/whatsapp.ts` | WhatsApp connector: WAHA REST API calls, chat listing, message fetching, multi-instance sync loop |
| `src/commands/gmail-auth.ts` | OAuth2 auth flow: local HTTP server, browser open, token exchange, token file storage |
| `src/commands/whatsapp-auth.ts` | WAHA auth: session start, QR code fetch and terminal display |
| `src/lib/config.ts` | (modify) Add gmail/whatsapp config types and loading |
| `src/commands/sync.ts` | (modify) Register new connectors |
| `src/index.ts` | (modify) Add `gmail auth` and `whatsapp auth` CLI commands |
| `docker-compose.waha.yml` | WAHA Docker Compose template |

---

## Chunk 1: Config & Dependencies

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install npm packages**

```bash
cd /Users/dandaka/projects/traul && bun add googleapis html-to-text && bun add -d @types/html-to-text
```

- [ ] **Step 2: Verify installation**

```bash
cd /Users/dandaka/projects/traul && bun run -e "import { google } from 'googleapis'; import { htmlToText } from 'html-to-text'; console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lockb
git commit -m "feat: add googleapis and html-to-text dependencies for gmail connector"
```

### Task 2: Extend config with Gmail and WhatsApp types

**Files:**
- Modify: `src/lib/config.ts`

- [ ] **Step 1: Add Gmail and WhatsApp types to TraulConfig**

Add after `markdown` in the `TraulConfig` interface:

```typescript
gmail: {
  client_id: string;
  client_secret: string;
  accounts: Array<{ name: string; labels: string[] }>;
};
whatsapp: {
  instances: Array<{
    name: string;
    url: string;
    api_key: string;
    session: string;
    chats: string[];
  }>;
};
```

- [ ] **Step 2: Add defaults in getDefaultConfig()**

Add after the `markdown` default:

```typescript
gmail: { client_id: "", client_secret: "", accounts: [] },
whatsapp: { instances: [] },
```

- [ ] **Step 3: Add config loading in loadConfig()**

After the markdown config loading block, add:

```typescript
// Gmail
defaults.gmail.client_id = parsed.gmail?.client_id ?? defaults.gmail.client_id;
defaults.gmail.client_secret = parsed.gmail?.client_secret ?? defaults.gmail.client_secret;
defaults.gmail.accounts = parsed.gmail?.accounts ?? defaults.gmail.accounts;

// WhatsApp
defaults.whatsapp.instances = parsed.whatsapp?.instances ?? defaults.whatsapp.instances;
```

- [ ] **Step 4: Add env var overrides for Gmail**

After the Linear env var block, add:

```typescript
defaults.gmail.client_id = process.env.GMAIL_CLIENT_ID ?? defaults.gmail.client_id;
defaults.gmail.client_secret = process.env.GMAIL_CLIENT_SECRET ?? defaults.gmail.client_secret;
```

- [ ] **Step 5: Verify config loads without errors**

```bash
cd /Users/dandaka/projects/traul && bun run src/index.ts channels --json | head -1
```

Expected: no errors, normal output.

- [ ] **Step 6: Commit**

```bash
git add src/lib/config.ts
git commit -m "feat: add gmail and whatsapp config types and loading"
```

---

## Chunk 2: Gmail Auth Flow

### Task 3: Implement Gmail OAuth2 auth command

**Files:**
- Create: `src/commands/gmail-auth.ts`

- [ ] **Step 1: Create the gmail-auth module**

```typescript
import { google } from "googleapis";
import { createServer } from "http";
import { existsSync, mkdirSync, writeFileSync, chmodSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { TraulConfig } from "../lib/config";

const TOKEN_DIR = join(homedir(), ".config", "traul", "gmail");

export function getTokenPath(accountName: string): string {
  return join(TOKEN_DIR, `${accountName}.json`);
}

export async function runGmailAuth(config: TraulConfig, accountName: string): Promise<void> {
  if (!config.gmail.client_id || !config.gmail.client_secret) {
    console.error("Gmail OAuth2 not configured.");
    console.error("Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET env vars,");
    console.error("or add gmail.client_id and gmail.client_secret to ~/.config/traul/config.json");
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(
    config.gmail.client_id,
    config.gmail.client_secret,
    "http://localhost:0/oauth2callback"
  );

  // Start local server to receive the callback
  const server = createServer();
  const port = await new Promise<number>((resolve) => {
    server.listen(0, () => {
      const addr = server.address();
      resolve(typeof addr === "object" && addr ? addr.port : 0);
    });
  });

  const redirectUri = `http://localhost:${port}/oauth2callback`;

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/gmail.readonly"],
    redirect_uri: redirectUri,
  });

  console.log(`\nOpening browser for Gmail auth (account: ${accountName})...`);
  console.log(`If browser doesn't open, visit:\n${authUrl}\n`);

  // Open browser (macOS: open, Linux: xdg-open)
  const { exec } = await import("child_process");
  const openCmd = process.platform === "darwin" ? "open" : "xdg-open";
  exec(`${openCmd} "${authUrl}"`);

  // Wait for callback
  const code = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error("Auth timeout (120s)"));
    }, 120_000);

    server.on("request", async (req, res) => {
      const url = new URL(req.url!, `http://localhost:${port}`);
      if (url.pathname !== "/oauth2callback") {
        res.writeHead(404);
        res.end();
        return;
      }

      const authCode = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h1>Auth failed</h1><p>You can close this tab.</p>");
        clearTimeout(timeout);
        server.close();
        reject(new Error(`Auth error: ${error}`));
        return;
      }

      if (authCode) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h1>Auth successful!</h1><p>You can close this tab.</p>");
        clearTimeout(timeout);
        server.close();
        resolve(authCode);
      }
    });
  });

  // Exchange code for tokens
  const { tokens } = await oauth2Client.getToken({ code, redirect_uri: redirectUri });

  // Save tokens
  if (!existsSync(TOKEN_DIR)) {
    mkdirSync(TOKEN_DIR, { recursive: true });
  }
  const tokenPath = getTokenPath(accountName);
  writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
  chmodSync(tokenPath, 0o600);

  console.log(`Tokens saved to ${tokenPath}`);
  console.log("Gmail auth complete!");
}
```

- [ ] **Step 2: Wire up CLI command in index.ts**

Add import at top of `src/index.ts`:

```typescript
import { runGmailAuth } from "./commands/gmail-auth";
```

Add before `program.parse()`:

```typescript
const gmail = program
  .command("gmail")
  .description("Gmail connector commands");

gmail
  .command("auth")
  .description("Authenticate a Gmail account via OAuth2")
  .argument("<account>", "account name (e.g. personal, work)")
  .action(async (account: string) => {
    await runGmailAuth(config, account);
    process.exit(0);
  });
```

- [ ] **Step 3: Verify CLI help shows the new command**

```bash
cd /Users/dandaka/projects/traul && bun run src/index.ts gmail auth --help
```

Expected: shows usage with `<account>` argument.

- [ ] **Step 4: Commit**

```bash
git add src/commands/gmail-auth.ts src/index.ts
git commit -m "feat: add gmail oauth2 auth command"
```

---

## Chunk 3: Gmail Connector

### Task 4: Implement Gmail sync connector

**Files:**
- Create: `src/connectors/gmail.ts`

- [ ] **Step 1: Create the gmail connector**

```typescript
import { google, type gmail_v1 } from "googleapis";
import { readFileSync, existsSync, writeFileSync, chmodSync } from "fs";
import { htmlToText } from "html-to-text";
import type { Connector, SyncResult } from "./types";
import type { TraulDB } from "../db/database";
import { type TraulConfig, getSyncStartTimestamp } from "../lib/config";
import { getTokenPath } from "../commands/gmail-auth";
import * as log from "../lib/logger";

function getAuthClient(config: TraulConfig, accountName: string) {
  const tokenPath = getTokenPath(accountName);
  if (!existsSync(tokenPath)) {
    return null;
  }

  const tokens = JSON.parse(readFileSync(tokenPath, "utf-8"));
  const oauth2Client = new google.auth.OAuth2(
    config.gmail.client_id,
    config.gmail.client_secret,
  );
  oauth2Client.setCredentials(tokens);

  // Auto-save refreshed tokens
  oauth2Client.on("tokens", (newTokens) => {
    const merged = { ...tokens, ...newTokens };
    writeFileSync(tokenPath, JSON.stringify(merged, null, 2));
    chmodSync(tokenPath, 0o600);
  });

  return oauth2Client;
}

function decodeBody(part: gmail_v1.Schema$MessagePart): string {
  if (part.body?.data) {
    return Buffer.from(part.body.data, "base64url").toString("utf-8");
  }
  return "";
}

function extractBody(payload: gmail_v1.Schema$MessagePart): string {
  // Try plain text first
  if (payload.mimeType === "text/plain") {
    return decodeBody(payload);
  }

  if (payload.parts) {
    // Look for text/plain in parts
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain") {
        return decodeBody(part);
      }
    }
    // Fallback to HTML
    for (const part of payload.parts) {
      if (part.mimeType === "text/html") {
        const html = decodeBody(part);
        return htmlToText(html, { wordwrap: false });
      }
    }
    // Recurse into multipart
    for (const part of payload.parts) {
      if (part.mimeType?.startsWith("multipart/")) {
        const result = extractBody(part);
        if (result) return result;
      }
    }
  }

  // Fallback: HTML body on payload itself
  if (payload.mimeType === "text/html") {
    return htmlToText(decodeBody(payload), { wordwrap: false });
  }

  return "";
}

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function parseEmailAddress(from: string): { name: string; email: string } {
  const match = from.match(/^(.+?)\s*<(.+?)>$/);
  if (match) {
    return { name: match[1].replace(/^"|"$/g, "").trim(), email: match[2] };
  }
  return { name: from, email: from };
}

function truncateSubject(subject: string, maxLen = 200): string {
  if (!subject) return "(no subject)";
  return subject.length > maxLen ? subject.slice(0, maxLen) + "..." : subject;
}

async function syncAccount(
  db: TraulDB,
  config: TraulConfig,
  accountName: string,
  labels: string[],
  result: SyncResult,
): Promise<void> {
  const auth = getAuthClient(config, accountName);
  if (!auth) {
    log.warn(`Gmail account "${accountName}" not authenticated. Run: traul gmail auth ${accountName}`);
    return;
  }

  const gmail = google.gmail({ version: "v1", auth });
  const cursorKey = `${accountName}:all`;
  const existingCursor = db.getSyncCursor("gmail", cursorKey);
  const syncStartTs = getSyncStartTimestamp(config);
  const afterEpochMs = existingCursor
    ? parseInt(existingCursor)
    : syncStartTs !== "0"
      ? parseInt(syncStartTs) * 1000
      : undefined;

  let query = "";
  if (afterEpochMs) {
    const afterSecs = Math.floor(afterEpochMs / 1000);
    query = `after:${afterSecs}`;
  }
  if (labels.length > 0) {
    query += " " + labels.map((l) => `label:${l}`).join(" ");
  }
  query = query.trim();

  log.info(`  [${accountName}] query: "${query || "(all)"}"`);

  let pageToken: string | undefined;
  let latestInternalDate = afterEpochMs ?? 0;
  let msgCount = 0;
  const contactCache = new Map<string, boolean>();

  do {
    const listResp = await gmail.users.messages.list({
      userId: "me",
      q: query || undefined,
      maxResults: 100,
      pageToken,
    });

    const messageIds = listResp.data.messages ?? [];
    if (messageIds.length === 0) break;

    // Fetch messages with concurrency limit
    const CONCURRENCY = 20;
    for (let i = 0; i < messageIds.length; i += CONCURRENCY) {
      const batch = messageIds.slice(i, i + CONCURRENCY);
      const messages = await Promise.all(
        batch.map((m) =>
          gmail.users.messages.get({
            userId: "me",
            id: m.id!,
            format: "full",
          }).then((r) => r.data)
        ),
      );

      for (const msg of messages) {
        if (!msg.id || !msg.payload) continue;

        const headers = msg.payload.headers;
        const subject = getHeader(headers, "Subject");
        const from = getHeader(headers, "From");
        const to = getHeader(headers, "To");
        const cc = getHeader(headers, "Cc");
        const internalDate = parseInt(msg.internalDate ?? "0");

        const body = extractBody(msg.payload);
        if (!body.trim()) continue;

        const fromParsed = parseEmailAddress(from);
        const threadId = msg.threadId ?? msg.id;

        db.upsertMessage({
          source: "gmail",
          source_id: `${accountName}:${msg.id}`,
          channel_id: `${accountName}:${threadId}`,
          channel_name: truncateSubject(subject),
          thread_id: threadId,
          author_id: fromParsed.email,
          author_name: fromParsed.name,
          content: body,
          sent_at: Math.floor(internalDate / 1000),
          metadata: JSON.stringify({
            labels: msg.labelIds,
            snippet: msg.snippet,
            to,
            cc,
          }),
        });
        msgCount++;

        // Ensure contacts for From, To, Cc
        const addresses = [from, ...to.split(","), ...cc.split(",")]
          .map((a) => a.trim())
          .filter(Boolean);

        for (const addr of addresses) {
          const parsed = parseEmailAddress(addr);
          if (contactCache.has(parsed.email)) continue;
          contactCache.set(parsed.email, true);

          const existing = db.getContactBySourceId("gmail", parsed.email);
          if (!existing) {
            const contactId = db.upsertContact(parsed.name || parsed.email);
            db.upsertContactIdentity({
              contactId,
              source: "gmail",
              sourceUserId: parsed.email,
              username: parsed.email,
              displayName: parsed.name || parsed.email,
            });
            result.contactsAdded++;
          }
        }

        if (internalDate > latestInternalDate) {
          latestInternalDate = internalDate;
        }
      }
    }

    pageToken = listResp.data.nextPageToken ?? undefined;
  } while (pageToken);

  if (latestInternalDate > (afterEpochMs ?? 0)) {
    db.setSyncCursor("gmail", cursorKey, String(latestInternalDate));
  }

  result.messagesAdded += msgCount;
  log.info(`  [${accountName}] ${msgCount} messages`);
}

export const gmailConnector: Connector = {
  name: "gmail",

  async sync(db: TraulDB, config: TraulConfig): Promise<SyncResult> {
    const result: SyncResult = { messagesAdded: 0, messagesUpdated: 0, contactsAdded: 0 };

    if (!config.gmail.client_id || !config.gmail.client_secret) {
      log.warn("Gmail OAuth2 not configured.");
      log.warn("Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET env vars, or add to config.");
      return result;
    }

    // Build account list: configured accounts, or auto-discover from token files
    let accounts = config.gmail.accounts;
    if (accounts.length === 0) {
      // Auto-discover: check for any token files
      const { readdirSync } = await import("fs");
      const { join } = await import("path");
      const { homedir } = await import("os");
      const tokenDir = join(homedir(), ".config", "traul", "gmail");
      try {
        const files = readdirSync(tokenDir).filter((f) => f.endsWith(".json"));
        accounts = files.map((f) => ({ name: f.replace(".json", ""), labels: [] }));
      } catch {
        // Token dir doesn't exist
      }
    }

    if (accounts.length === 0) {
      log.warn("No Gmail accounts configured. Run: traul gmail auth <account-name>");
      return result;
    }

    log.info(`Syncing ${accounts.length} Gmail account(s)...`);
    for (const account of accounts) {
      await syncAccount(db, config, account.name, account.labels, result);
    }

    return result;
  },
};
```

- [ ] **Step 2: Register in sync.ts**

Add import in `src/commands/sync.ts`:

```typescript
import { gmailConnector } from "../connectors/gmail";
```

Add `gmailConnector` to the connectors array.

- [ ] **Step 3: Verify it compiles**

```bash
cd /Users/dandaka/projects/traul && bun build src/index.ts --target bun --outdir /dev/null 2>&1 | tail -3
```

Expected: no errors.

- [ ] **Step 4: Test sync with no accounts configured (should warn gracefully)**

```bash
cd /Users/dandaka/projects/traul && bun run src/index.ts sync gmail
```

Expected: warns about no accounts, exits cleanly.

- [ ] **Step 5: Commit**

```bash
git add src/connectors/gmail.ts src/commands/sync.ts
git commit -m "feat: add gmail connector with multi-account sync"
```

---

## Chunk 4: WhatsApp Auth Flow

### Task 5: Create WAHA Docker Compose file

**Files:**
- Create: `docker-compose.waha.yml`

- [ ] **Step 1: Create the compose file**

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

- [ ] **Step 2: Commit**

```bash
git add docker-compose.waha.yml
git commit -m "feat: add WAHA docker-compose for whatsapp connector"
```

### Task 6: Implement WhatsApp auth command

**Files:**
- Create: `src/commands/whatsapp-auth.ts`

- [ ] **Step 1: Create the whatsapp-auth module**

```typescript
import type { TraulConfig } from "../lib/config";

interface WahaInstance {
  name: string;
  url: string;
  api_key: string;
  session: string;
}

function getHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["X-Api-Key"] = apiKey;
  return headers;
}

export async function runWhatsAppAuth(config: TraulConfig, accountName: string): Promise<void> {
  const instance = config.whatsapp.instances.find((i) => i.name === accountName);
  if (!instance) {
    console.error(`WhatsApp instance "${accountName}" not found in config.`);
    console.error("Add it to whatsapp.instances in ~/.config/traul/config.json:");
    console.error(JSON.stringify({
      whatsapp: {
        instances: [{ name: accountName, url: "http://localhost:3000", api_key: "", session: "default", chats: [] }],
      },
    }, null, 2));
    process.exit(1);
  }

  const { url, api_key, session } = instance;
  const headers = getHeaders(api_key);

  // Start session
  console.log(`Starting WAHA session "${session}" on ${url}...`);
  try {
    const startResp = await fetch(`${url}/api/sessions/start`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: session }),
    });

    if (!startResp.ok && startResp.status !== 409) {
      // 409 = session already exists, which is fine
      const body = await startResp.text();
      console.error(`Failed to start session: ${startResp.status} ${body}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`Cannot reach WAHA at ${url}. Is it running?`);
    console.error("Start it with: docker compose -f docker-compose.waha.yml up -d");
    process.exit(1);
  }

  // Check session status
  const statusResp = await fetch(`${url}/api/sessions/${session}`, { headers });
  const status = await statusResp.json() as { status: string };

  if (status.status === "WORKING") {
    console.log("Session already authenticated!");
    return;
  }

  // Get QR code
  console.log("\nScan this QR code with WhatsApp on your phone:\n");

  const qrResp = await fetch(`${url}/api/sessions/${session}/auth/qr`, { headers });
  if (!qrResp.ok) {
    console.error(`Failed to get QR code: ${qrResp.status}`);
    process.exit(1);
  }

  const qrData = await qrResp.json() as { value: string };

  // Display QR in terminal using simple block characters
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);

  try {
    // Use qrcode-terminal if available via npx, otherwise show raw value
    await execAsync(`echo "${qrData.value}" | npx -y qrcode-terminal`);
  } catch {
    console.log("QR value (scan with a QR reader or open in browser):");
    console.log(`${url}/api/${session}/auth/qr?format=image`);
  }

  // Poll for auth completion
  console.log("\nWaiting for authentication...");
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const checkResp = await fetch(`${url}/api/sessions/${session}`, { headers });
    const checkStatus = await checkResp.json() as { status: string };

    if (checkStatus.status === "WORKING") {
      console.log("WhatsApp authenticated successfully!");
      return;
    }
  }

  console.error("Authentication timed out (120s). Try again.");
  process.exit(1);
}
```

- [ ] **Step 2: Wire up CLI command in index.ts**

Add import:

```typescript
import { runWhatsAppAuth } from "./commands/whatsapp-auth";
```

Add before `program.parse()`:

```typescript
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
```

- [ ] **Step 3: Verify CLI help**

```bash
cd /Users/dandaka/projects/traul && bun run src/index.ts whatsapp auth --help
```

Expected: shows usage with `<account>` argument.

- [ ] **Step 4: Commit**

```bash
git add src/commands/whatsapp-auth.ts src/index.ts
git commit -m "feat: add whatsapp auth command with WAHA QR flow"
```

---

## Chunk 5: WhatsApp Connector

### Task 7: Implement WhatsApp sync connector

**Files:**
- Create: `src/connectors/whatsapp.ts`

- [ ] **Step 1: Create the whatsapp connector**

```typescript
import type { Connector, SyncResult } from "./types";
import type { TraulDB } from "../db/database";
import { type TraulConfig, getSyncStartTimestamp } from "../lib/config";
import * as log from "../lib/logger";

interface WahaChat {
  id: string;
  name: string;
  isGroup: boolean;
}

interface WahaMessage {
  id: string;
  body: string;
  timestamp: number;
  from: string;
  fromMe: boolean;
  hasMedia: boolean;
  mediaUrl?: string;
  ack: number;
  _data?: {
    notifyName?: string;
    type?: string;
  };
}

function getHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["X-Api-Key"] = apiKey;
  return headers;
}

function mediaPlaceholder(msg: WahaMessage): string {
  const type = msg._data?.type ?? "file";
  const typeMap: Record<string, string> = {
    image: "image",
    video: "video",
    ptt: "audio",
    audio: "audio",
    document: "document",
    sticker: "sticker",
  };
  return `[media: ${typeMap[type] ?? type}]`;
}

async function syncInstance(
  db: TraulDB,
  config: TraulConfig,
  instance: { name: string; url: string; api_key: string; session: string; chats: string[] },
  result: SyncResult,
): Promise<void> {
  const { name, url, api_key, session, chats: chatFilter } = instance;
  const headers = getHeaders(api_key);

  // Check session status
  try {
    const statusResp = await fetch(`${url}/api/sessions/${session}`, { headers });
    if (!statusResp.ok) {
      log.warn(`  [${name}] WAHA session "${session}" not found. Run: traul whatsapp auth ${name}`);
      return;
    }
    const status = await statusResp.json() as { status: string };
    if (status.status !== "WORKING") {
      log.warn(`  [${name}] WAHA session not authenticated (status: ${status.status}). Run: traul whatsapp auth ${name}`);
      return;
    }
  } catch (err) {
    log.warn(`  [${name}] Cannot reach WAHA at ${url}. Is it running?`);
    return;
  }

  // List chats
  const chatsResp = await fetch(`${url}/api/sessions/${session}/chats`, { headers });
  if (!chatsResp.ok) {
    log.warn(`  [${name}] Failed to list chats: ${chatsResp.status}`);
    return;
  }
  let allChats = await chatsResp.json() as WahaChat[];

  // Filter chats if configured
  if (chatFilter.length > 0) {
    allChats = allChats.filter(
      (c) => chatFilter.includes(c.id) || chatFilter.some((f) => c.name?.includes(f)),
    );
  }

  log.info(`  [${name}] Syncing ${allChats.length} chats...`);

  const syncStartTs = getSyncStartTimestamp(config);
  const syncStartEpoch = syncStartTs !== "0" ? parseInt(syncStartTs) : 0;

  for (const chat of allChats) {
    const chatName = chat.name || chat.id;
    const cursorKey = `${name}:chat:${chat.id}`;
    const existingCursor = db.getSyncCursor("whatsapp", cursorKey);
    const afterTs = existingCursor ? parseInt(existingCursor) : syncStartEpoch;

    log.info(`    ${chatName}`);

    let offset = 0;
    const PAGE_SIZE = 100;
    let latestTs = afterTs;
    let chatMsgCount = 0;
    let hasMore = true;

    while (hasMore) {
      const msgsResp = await fetch(
        `${url}/api/sessions/${session}/chats/${encodeURIComponent(chat.id)}/messages?limit=${PAGE_SIZE}&offset=${offset}`,
        { headers },
      );

      if (!msgsResp.ok) {
        log.warn(`    Failed to fetch messages: ${msgsResp.status}`);
        break;
      }

      const messages = await msgsResp.json() as WahaMessage[];
      if (messages.length === 0) break;

      // Sort by timestamp ascending to process in chronological order
      messages.sort((a, b) => a.timestamp - b.timestamp);

      for (const msg of messages) {
        // Skip messages before cursor
        if (msg.timestamp <= afterTs) continue;

        const content = msg.body
          ? msg.body
          : msg.hasMedia
            ? mediaPlaceholder(msg)
            : "";

        if (!content) continue;

        const authorName = msg._data?.notifyName ?? (msg.fromMe ? "Me" : msg.from);

        db.upsertMessage({
          source: "whatsapp",
          source_id: `${name}:${msg.id}`,
          channel_id: chat.id,
          channel_name: chatName,
          author_id: msg.from,
          author_name: authorName,
          content,
          sent_at: msg.timestamp,
          metadata: JSON.stringify({
            fromMe: msg.fromMe,
            hasMedia: msg.hasMedia,
            ack: msg.ack,
          }),
        });
        chatMsgCount++;

        if (msg.timestamp > latestTs) {
          latestTs = msg.timestamp;
        }

        // Ensure contact
        if (!msg.fromMe) {
          const existing = db.getContactBySourceId("whatsapp", msg.from);
          if (!existing) {
            const contactId = db.upsertContact(authorName);
            db.upsertContactIdentity({
              contactId,
              source: "whatsapp",
              sourceUserId: msg.from,
              username: msg.from,
              displayName: authorName,
            });
            result.contactsAdded++;
          }
        }
      }

      if (messages.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    if (latestTs > afterTs) {
      db.setSyncCursor("whatsapp", cursorKey, String(latestTs));
    }

    result.messagesAdded += chatMsgCount;
    if (chatMsgCount > 0) {
      log.info(`      ${chatMsgCount} messages`);
    }
  }
}

export const whatsappConnector: Connector = {
  name: "whatsapp",

  async sync(db: TraulDB, config: TraulConfig): Promise<SyncResult> {
    const result: SyncResult = { messagesAdded: 0, messagesUpdated: 0, contactsAdded: 0 };

    if (config.whatsapp.instances.length === 0) {
      log.warn("No WhatsApp instances configured.");
      log.warn("Add whatsapp.instances to ~/.config/traul/config.json");
      return result;
    }

    log.info(`Syncing ${config.whatsapp.instances.length} WhatsApp instance(s)...`);
    for (const instance of config.whatsapp.instances) {
      await syncInstance(db, config, instance, result);
    }

    return result;
  },
};
```

- [ ] **Step 2: Register in sync.ts**

Add import in `src/commands/sync.ts`:

```typescript
import { whatsappConnector } from "../connectors/whatsapp";
```

Add `whatsappConnector` to the connectors array.

- [ ] **Step 3: Verify it compiles**

```bash
cd /Users/dandaka/projects/traul && bun build src/index.ts --target bun --outdir /dev/null 2>&1 | tail -3
```

Expected: no errors.

- [ ] **Step 4: Test sync with no instances configured (should warn gracefully)**

```bash
cd /Users/dandaka/projects/traul && bun run src/index.ts sync whatsapp
```

Expected: warns about no instances, exits cleanly.

- [ ] **Step 5: Commit**

```bash
git add src/connectors/whatsapp.ts src/commands/sync.ts
git commit -m "feat: add whatsapp connector with WAHA multi-instance sync"
```

---

## Chunk 6: Final Integration

### Task 8: Verify full sync command recognizes both connectors

- [ ] **Step 1: Run sync without args to verify both connectors are listed**

```bash
cd /Users/dandaka/projects/traul && bun run src/index.ts -v sync 2>&1 | grep -E "Syncing (gmail|whatsapp)"
```

Expected: both "Syncing gmail..." and "Syncing whatsapp..." appear (with warnings about no config).

- [ ] **Step 2: Verify search/messages work with source filters**

```bash
cd /Users/dandaka/projects/traul && bun run src/index.ts channels --source gmail --json
cd /Users/dandaka/projects/traul && bun run src/index.ts channels --source whatsapp --json
```

Expected: empty results, no errors.

- [ ] **Step 3: Final commit if any remaining changes**

```bash
git status
```
