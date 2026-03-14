# Personal Intelligence Engine — Deep Research

**Date:** 2026-03-14
**Purpose:** Competitive landscape, architecture patterns, gap analysis, and strategic recommendations for building a local-first personal intelligence engine.

---

## 1. Landscape Overview

### 1.1 AI-Powered Personal Knowledge / Second Brain

**Khoj** (khoj-ai/khoj) — ~33k stars
Self-hostable AI second brain. Ingests docs, notes, web, images. Query-driven search with LLM.
Proactive: No — you ask, it answers.
Storage: Postgres + embeddings.
Gap: No communication ingestion (Slack/email/cal). No proactive signals. Document-focused.

**Quivr** (QuivrHQ/quivr) — ~39k stars
RAG-based "second brain" with configurable workflows. Ingests documents and files.
Proactive: No.
Storage: Supabase (Postgres + pgvector).
Gap: Document-focused only. No multi-source comms. No proactive features.

**Mem.ai** — Funded startup (pivoted multiple times)
AI-powered note-taking with "related memories" surfacing. Manual notes + some integrations.
Proactive: Partial — surfaces related memories.
Storage: Cloud, proprietary.
Gap: Cloud-only. Limited source ingestion. Unstable product direction.

**Obsidian + plugins** (Copilot, Smart Connections)
Note-taking with AI plugins that add semantic search over vault content.
Proactive: No.
Storage: Local markdown files.
Gap: No external source ingestion. Plugins add AI search but vault is still a passive store. No communication data.

### 1.2 Agent Memory Systems

**Mem0** (mem0ai/mem0) — ~50k stars
Universal memory layer for AI agents. Stores and retrieves agent conversation context.
Proactive: No — memory retrieval on query.
Storage: Cloud or self-hosted vector store.
Gap: Designed for agent memory, not personal communications. No multi-source ingestion. No signals.

**Letta/MemGPT** (letta-ai/letta) — ~13k stars
Stateful agents with tiered memory (core/archival/recall). Interesting memory architecture.
Proactive: No.
Storage: Postgres + vector.
Gap: Focused on agent-to-agent memory. The tiered memory pattern is useful inspiration but the tool isn't designed for personal data.

**Graphiti** (getzep/graphiti) — ~24k stars
Temporal knowledge graph engine by Zep. Excellent at modeling time-evolving relationships and facts.
Proactive: No.
Storage: Neo4j (heavy dependency).
Gap: Requires Neo4j (JVM, server, memory). Enterprise-focused through Zep. No connectors for personal sources. Strong building block but not a product.

**CrewAI** — ~25k stars
Multi-agent orchestration framework with built-in memory for agent coordination.
Proactive: No.
Storage: Configurable.
Gap: Memory is for agent coordination, not personal knowledge.

### 1.3 Enterprise/Team Knowledge Platforms

**Dust.tt** (dust-tt/dust) — Funded startup, OSS core
Enterprise AI assistant platform with connectors for Slack, Google Drive, Notion, GitHub, etc.
Proactive: Partial — supports scheduled workflows.
Storage: Cloud Postgres.
Gap: Enterprise/team-focused. Heavy infrastructure. Not designed for personal-scale, local-first use. Closest to what we want but wrong scale and deployment model.

**Haystack** (deepset-ai/haystack) — ~18k stars
Open-source AI orchestration framework for building RAG pipelines and agent workflows.
Proactive: No — it's a framework, not a product.
Storage: Configurable.
Gap: Building blocks, not a ready product. No connectors out of the box. You'd use this to build something, not run it.

### 1.4 Personal CRM / Relationship Intelligence

**Clay** (clay.com) — Commercial product
Relationship intelligence CRM. Ingests email, calendar, contacts, LinkedIn. Surfaces relationship insights and follow-up reminders.
Proactive: Yes — surfaces relationship decay, job changes, follow-up suggestions.
Gap: Expensive ($20+/mo). Cloud-only. Focused narrowly on relationships, not general knowledge/communications.

**Monica CRM** (monicahq/monica) — ~22k stars
Open-source personal relationship manager. Manual data entry with reminders.
Proactive: Reminders only.
Storage: MySQL/MariaDB.
Gap: Manual data entry. No automated ingestion. Simple reminders, not intelligence.

**Dex** (getdex.com) — Commercial product
Lightweight personal CRM with LinkedIn sync and contact management.
Proactive: Basic reminders, job change alerts.
Gap: Narrow focus on contacts/networking only. Cloud-only.

### 1.5 Productivity / Calendar Intelligence

**Reclaim.ai** — Commercial product
AI calendar management. Auto-schedules tasks, protects focus time, manages habits.
Proactive: Yes — auto-schedules, protects focus time.
Gap: Calendar-only scope. Acquired/mature product. Not extensible.

**Motion** — Commercial product
AI project + calendar management. Auto-prioritizes and schedules work.
Proactive: Yes — auto-prioritizes and schedules.
Gap: Closed, expensive. Narrow scope (calendar + tasks only).

### 1.6 Screen/Activity Capture

**Rewind / Limitless** — Dead (acquired by Meta, Dec 2025)
Screen + audio recording with AI search over everything you've seen/heard.
Proactive: Partial — surfaced meeting summaries.
Gap: **Shut down.** Privacy nightmare (recorded everything). Proved the demand for personal search but the approach was too invasive.

### 1.7 LLM Augmentation Frameworks

**Fabric** (danielmiessler/fabric) — ~27k stars
Open-source framework for augmenting humans using AI. Crowdsourced prompt patterns run via CLI.
Proactive: No — command-driven.
Storage: None (stateless).
Gap: No memory, no ingestion, no persistence. It's a prompt library, not a knowledge system.

**AutoGPT** — ~173k stars
Autonomous agent platform attempting to chain LLM actions together.
Proactive: Attempted full autonomy.
Gap: Over-hyped, unreliable autonomous loops. Not designed for personal knowledge. The autonomous approach proved too brittle.

### 1.8 Niche / Emerging

**Unigraph** (unigraph-dev/unigraph-dev)
Ambitious universal knowledge graph + personal workspace. Multi-source ingestion planned.
Proactive: Partial.
Storage: Custom graph store.
Gap: Stale (limited recent activity). Complex setup. Ambitious vision but execution stalled.

**Pieces** (pieces.app) — ~150k users
Developer context copilot. Saves code snippets, suggests relevant context during workflow.
Proactive: Partial — suggests relevant snippets.
Storage: Local + cloud.
Gap: Developer-focused only. Not general personal intelligence.

**Espial** (Uzay-G/espial)
Automated knowledge base builder from bookmarks and web content.
Proactive: No.
Storage: SQLite.
Gap: Very narrow scope (bookmarks only).

**Persona** (saxenauts/persona)
Personal knowledge graph from digital footprint. Attempts to build a graph of your online identity.
Proactive: No.
Gap: Early/experimental. Limited sources.

**Engram** (199-biotechnologies/engram) — <10 stars
MCP-based memory service for AI agents. Early attempt at MCP-native memory.
Gap: Tiny project. Simple key-value memory, not multi-source intelligence.

**Samantha MCP** (arcAman07/samantha_mcp) — <10 stars
Another early MCP memory server attempt. Named after the AI from "Her."
Gap: Toy project. No real ingestion or signals.

---

## 2. Architecture Insights

### 2.1 Storage: SQLite is the Right Choice

**Recommendation: SQLite + FTS5 + sqlite-vec**

At personal scale (~100K-1M messages, ~10K contacts, ~5 years of data), SQLite is ideal:

- **Scale fit**: SQLite handles databases up to 281 TB. Personal data will be <1 GB for years
- **Local-first**: Single file, zero config, no server process, works offline
- **Battle-tested at personal scale**: Signal, Apple Notes, Apple Photos, Firefox, Chrome all use SQLite for personal-scale data
- **FTS5 built-in**: Full-text search with no additional dependencies
- **WAL mode**: Concurrent reads with single writer — sufficient for personal use (you're the only writer)
- **Backup**: Just copy the file. Sync via any file sync tool

**Why NOT Postgres**: Requires a server process. Overkill for personal data. Adds deployment complexity that defeats local-first goals.

**Why NOT Neo4j/Graph DBs**: Relationship modeling is valuable but Neo4j is heavy (JVM, server, memory). Better approach: model relationships as tables in SQLite with simple JOINs. Graph queries on personal-scale data are fast enough with SQL.

### 2.2 Search: FTS5 is Enough (Start Here)

**FTS5 capabilities at personal scale:**

- Boolean queries, phrase matching, prefix queries
- BM25 ranking built-in
- Column filters (search only in subject vs body)
- Highlight and snippet extraction
- Performance: sub-millisecond queries on 1M rows

**FTS5 limitations (acceptable at personal scale):**

- No fuzzy matching (misspelling tolerance) — consider `spellfix1` extension
- No faceted search — implement with GROUP BY queries
- No synonyms — add at ingestion time or query expansion

**Don't add Typesense/Meilisearch** unless FTS5 proves insufficient. Extra services = extra complexity for marginal gain at personal scale.

### 2.3 Vector Search: sqlite-vec

**sqlite-vec** (by Alex Garcia) — recommended:

- Pure C, no dependencies, runs as SQLite extension
- Supports float, int8, and binary vectors
- KNN queries via virtual tables
- Works on all platforms (macOS, Linux, Windows, WASM)
- Actively maintained (Alex Garcia is well-known in SQLite ecosystem)
- Performance: ~10ms for KNN over 100K vectors (plenty fast for personal scale)
- Memory: 100K vectors fit in ~37MB RAM

**sqlite-vss** — deprecated in favor of sqlite-vec. Don't use.

**Embedding models for personal comms** (small, fast, local):

- `nomic-embed-text` (137M params, 768 dims) — excellent quality/size ratio, 86% accuracy, runs on CPU via Ollama
- `all-MiniLM-L6-v2` (22M params) — fastest, good enough for semantic search
- `bge-small-en-v1.5` (33M params) — strong for English, small footprint
- Run via Ollama locally for zero-cost, private embeddings

**Hybrid search pattern:**

```sql
-- FTS5 for keyword search
SELECT id, bm25(messages_fts) as text_score
FROM messages_fts WHERE messages_fts MATCH ?

-- sqlite-vec for semantic search
SELECT id, distance FROM vec_messages
WHERE embedding MATCH ? AND k = 20

-- Combine with reciprocal rank fusion (RRF)
SELECT id,
  (1.0 / (60 + text_rank)) + (1.0 / (60 + vec_rank)) as rrf_score
FROM (keyword_results FULL OUTER JOIN vector_results USING(id))
ORDER BY rrf_score DESC
```

### 2.4 Schema Design for Multi-Source Data

```sql
-- Core: normalized message/event store
CREATE TABLE sources (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL,        -- 'slack', 'telegram', 'whatsapp', 'email', 'files', 'linear', 'calendar', 'git'
  name TEXT NOT NULL,        -- 'work-slack', 'personal-email', 'coaching-logs', 'call-transcripts'
  config JSON,               -- connection config
  last_sync_cursor TEXT,     -- for incremental sync
  last_sync_at TEXT
);

CREATE TABLE entities (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL,        -- 'person', 'channel', 'repo', 'project'
  name TEXT NOT NULL,
  metadata JSON,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Entity deduplication: same person across sources
CREATE TABLE entity_aliases (
  entity_id INTEGER REFERENCES entities(id),
  source_id INTEGER REFERENCES sources(id),
  external_id TEXT NOT NULL,  -- source-specific ID
  external_name TEXT,
  UNIQUE(source_id, external_id)
);

CREATE TABLE messages (
  id INTEGER PRIMARY KEY,
  source_id INTEGER REFERENCES sources(id),
  external_id TEXT NOT NULL,      -- source-specific message ID
  thread_id TEXT,                  -- for threading
  parent_id INTEGER REFERENCES messages(id),
  author_entity_id INTEGER REFERENCES entities(id),
  channel_entity_id INTEGER REFERENCES entities(id),
  content TEXT,
  content_type TEXT DEFAULT 'text', -- 'text', 'html', 'markdown'
  content_hash TEXT,                -- for cross-source dedup detection
  metadata JSON,                    -- source-specific fields
  created_at TEXT NOT NULL,
  ingested_at TEXT DEFAULT (datetime('now')),
  UNIQUE(source_id, external_id)
);

-- FTS5 index
CREATE VIRTUAL TABLE messages_fts USING fts5(
  content,
  content=messages,
  content_rowid=id,
  tokenize='porter unicode61'
);

-- Vector embeddings (via sqlite-vec)
CREATE VIRTUAL TABLE vec_messages USING vec0(
  id INTEGER PRIMARY KEY,
  embedding float[768]  -- nomic-embed-text dimension
);

-- Documents (markdown files, coaching logs, call transcripts)
CREATE TABLE documents (
  id INTEGER PRIMARY KEY,
  source_id INTEGER REFERENCES sources(id),
  file_path TEXT NOT NULL,        -- relative path from source root
  title TEXT,                      -- extracted from first heading or filename
  section TEXT,                    -- heading-level section (for granular search)
  section_index INTEGER DEFAULT 0, -- order within file
  content TEXT NOT NULL,
  content_hash TEXT,               -- detect changes on re-sync
  file_mtime TEXT,                 -- file modification time (sync cursor)
  metadata JSON,                   -- tags, frontmatter fields
  created_at TEXT NOT NULL,        -- file creation or frontmatter date
  ingested_at TEXT DEFAULT (datetime('now')),
  UNIQUE(source_id, file_path, section_index)
);

-- FTS5 index for documents
CREATE VIRTUAL TABLE documents_fts USING fts5(
  title,
  section,
  content,
  content=documents,
  content_rowid=id,
  tokenize='porter unicode61'
);

-- Events (calendar, deadlines, milestones)
CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  source_id INTEGER REFERENCES sources(id),
  external_id TEXT,
  title TEXT,
  description TEXT,
  start_at TEXT,
  end_at TEXT,
  attendees JSON,    -- [{entity_id, role, status}]
  metadata JSON,
  UNIQUE(source_id, external_id)
);

-- Signals (proactive alerts)
CREATE TABLE signals (
  id INTEGER PRIMARY KEY,
  signal_type TEXT NOT NULL,   -- 'stale_thread', 'missed_followup', 'deadline_approaching'
  severity TEXT DEFAULT 'info', -- 'info', 'warning', 'urgent'
  title TEXT NOT NULL,
  description TEXT,
  related_message_id INTEGER REFERENCES messages(id),
  related_entity_id INTEGER REFERENCES entities(id),
  metadata JSON,
  created_at TEXT DEFAULT (datetime('now')),
  dismissed_at TEXT,           -- user dismissed
  acted_on_at TEXT             -- user took action
);

-- Signal definitions (user-customizable)
CREATE TABLE signal_definitions (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  query TEXT NOT NULL,          -- SQL query that returns signal matches
  schedule TEXT DEFAULT '0 8 * * *',  -- cron expression
  severity TEXT DEFAULT 'info',
  enabled INTEGER DEFAULT 1,
  last_run_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 2.5 Connector/Plugin Architecture

**Pattern: Each connector is a standalone module with a standard interface:**

```typescript
interface Connector {
  type: string;                    // 'slack', 'email', etc.

  // Initial setup
  configure(config: ConnectorConfig): Promise<void>;

  // Incremental sync (idempotent, cursor-based)
  sync(cursor?: string): AsyncGenerator<{
    messages: Message[];
    entities: Entity[];
    events: Event[];
    nextCursor: string;
  }>;

  // Real-time (optional)
  watch?(callback: (items: SyncItem[]) => void): void;
}
```

**Incremental sync patterns by source:**

- **Slack**: `conversations.history` with cursor pagination. Store `latest` timestamp as cursor
- **Telegram**: `getUpdates` with offset, or MTProto `pts` for full sync
- **WhatsApp**: Via WAHA (WhatsApp HTTP API) — self-hosted Docker container that wraps WhatsApp Web into a REST API with webhooks. Provides `/api/messages`, `/api/chats`, webhook events for real-time ingestion. Cursor-based sync using message timestamps. Handles QR auth, reconnection, and session persistence. Much cleaner than raw Baileys — proper HTTP API with webhook push for new messages
- **Files (markdown)**: Watch directories for `.md` files. Cursor = file mtime. On change, re-index the file. Split into sections by heading for granular search. Handles coaching logs, call transcripts, notes, any local markdown. Config: list of glob patterns (e.g., `coaching/daily/*.md`, `calls/**/*.md`)
- **Email (IMAP)**: UIDVALIDITY + UID range. Or Gmail API with `historyId`
- **Linear**: GraphQL with `updatedAt` filter + webhook for real-time
- **Calendar**: Google Calendar sync tokens, iCal `SEQUENCE` numbers
- **Git**: `git log --after=<last_sync>` for commits

### 2.6 Deduplication Across Sources

**The same information can appear in multiple sources** (e.g., a Linear notification in Slack AND email). Strategies:

1. **Content hash**: Store `content_hash` (normalized text hash) on each message. Same hash = likely duplicate. Use for detection, not deletion
2. **URL/link-based**: Extract URLs from messages. Same URL = likely same topic. Link as "related" rather than deduplicating
3. **Entity resolution**: Map `@john` in Slack to `john@company.com` in email via `entity_aliases` table
4. **Thread clustering**: Group messages by thread/topic across sources using shared references (Linear issue ID, PR number, etc.)
5. **Don't over-deduplicate**: Different contexts (Slack discussion vs email summary) carry different value. Link them, don't delete duplicates

### 2.7 Proactive Signal Engine (SQL-Driven)

**The key differentiator: Express signals as SQL queries that run on a schedule.**

```sql
-- Signal: Stale threads where I was mentioned but didn't respond
SELECT m.thread_id, m.content, m.created_at, e.name as author
FROM messages m
JOIN entities e ON m.author_entity_id = e.id
WHERE m.thread_id IN (
  -- Threads where I was mentioned
  SELECT DISTINCT thread_id FROM messages
  WHERE content LIKE '%@me%' OR content LIKE '%dandaka%'
)
AND m.thread_id NOT IN (
  -- Threads where I already responded
  SELECT DISTINCT thread_id FROM messages
  WHERE author_entity_id = (SELECT id FROM entities WHERE name = 'me')
  AND created_at > datetime('now', '-7 days')
)
AND m.created_at > datetime('now', '-7 days')
AND m.created_at < datetime('now', '-1 day')
ORDER BY m.created_at DESC;

-- Signal: Approaching deadlines with no recent activity
SELECT e.title, e.start_at,
  julianday(e.start_at) - julianday('now') as days_until,
  (SELECT COUNT(*) FROM messages m
   WHERE m.metadata->>'$.linear_issue_id' = e.external_id
   AND m.created_at > datetime('now', '-3 days')
  ) as recent_messages
FROM events e
WHERE e.start_at > datetime('now')
AND e.start_at < datetime('now', '+3 days')
HAVING recent_messages = 0;

-- Signal: People I haven't talked to in a while (relationship decay)
SELECT e.name, MAX(m.created_at) as last_contact,
  julianday('now') - julianday(MAX(m.created_at)) as days_silent
FROM entities e
JOIN messages m ON (m.author_entity_id = e.id OR m.channel_entity_id = e.id)
WHERE e.type = 'person'
AND e.metadata->>'$.importance' >= 3
GROUP BY e.id
HAVING days_silent > 14
ORDER BY days_silent DESC;
```

```sql
-- Signal: Coaching commitments not mentioned in recent messages
-- (you committed to something in a daily check-in but there's no activity on it)
SELECT d.content, d.created_at, d.file_path
FROM documents d
WHERE d.source_id IN (SELECT id FROM sources WHERE name = 'coaching-logs')
AND d.content LIKE '%commit%'
AND d.created_at > datetime('now', '-7 days')
AND NOT EXISTS (
  SELECT 1 FROM messages m
  WHERE m.content LIKE '%' || substr(d.content, instr(d.content, 'commit'), 40) || '%'
  AND m.created_at > d.created_at
);

-- Signal: Action items from call transcripts with no follow-up
SELECT d.content, d.title, d.created_at
FROM documents d
WHERE d.source_id IN (SELECT id FROM sources WHERE name = 'call-transcripts')
AND (d.content LIKE '%action item%' OR d.content LIKE '%follow up%' OR d.content LIKE '%TODO%')
AND d.created_at > datetime('now', '-14 days')
AND d.created_at < datetime('now', '-2 days');
```

**Evaluation: Cron-based (recommended for v1)**

- Run signal queries every N minutes or on schedule (e.g., morning briefing at 8am)
- Simple, predictable, debuggable
- Event-driven can come later (trigger signals when new messages arrive)

### 2.8 Relevance Scoring Without LLM

**Composite score combining multiple signals:**

```sql
SELECT m.id,
  -- Recency: exponential decay, half-life of 14 days
  EXP(-0.0495 * (julianday('now') - julianday(m.created_at))) as recency_score,

  -- Frequency: how active is this thread?
  (SELECT COUNT(*) FROM messages WHERE thread_id = m.thread_id
   AND created_at > datetime('now', '-7 days')) * 0.1 as activity_score,

  -- Importance: author importance + channel importance
  COALESCE(e.metadata->>'$.importance', 1) * 0.2 as author_score,

  -- Personal relevance: was I mentioned or involved?
  CASE WHEN m.content LIKE '%@me%' THEN 0.5 ELSE 0 END as mention_score

FROM messages m
JOIN entities e ON m.author_entity_id = e.id
```

**Memory decay function** (inspired by ACT-R cognitive architecture):

```typescript
// Exponential decay with frequency reinforcement
function relevanceScore(ageInHours: number, accessCount: number, halfLifeHours: number = 336): number {
  const decay = Math.exp(-0.693 * ageInHours / halfLifeHours);
  const frequency = Math.log(1 + accessCount);
  return decay * (1 + frequency);
}
```

### 2.9 CLI Design (Unix-Way)

**Philosophy:** Small, composable commands with minimal output. Each command does one thing. Output is plain text, pipeable, grep-friendly. Designed to be called from scripts, cron, or AI agents via Bash tool — no special protocol needed.

**Core commands:**

```bash
# Sync — pull new messages from sources
sift sync                     # sync all sources
sift sync slack               # sync one source
sift sync files               # re-index watched markdown directories
sift sync --status            # show last sync timestamps

# Search — query across all sources
sift search "quarterly review"                    # keyword search
sift search "quarterly review" --source slack     # filter by source
sift search "priorities" --source files           # search only local files
sift search "quarterly review" --after 2026-03-01 # time filter
sift search "quarterly review" --limit 5          # limit results
sift search "quarterly review" --json             # machine-readable output

# Signals — surface proactive alerts
sift signals                          # all current signals
sift signals --type stale_thread      # filter by type
sift signals --severity urgent        # filter by severity
sift signals dismiss 42               # dismiss a signal
sift signals ack 42                   # mark as acted on

# Briefing — daily summary
sift briefing                 # today's briefing
sift briefing --date 2026-03-13

# Entity — look up a person/channel/project
sift entity "John Smith"      # find across all sources
sift entity "John Smith" --messages   # include recent messages

# Thread — get full thread context
sift thread slack:C04ABC123:1234567890

# Raw SQL — for power users and custom signals
sift query "SELECT * FROM messages WHERE content LIKE '%deploy%' ORDER BY created_at DESC LIMIT 10"
```

**Output format:** Compact, one-line-per-result by default. Minimal context load when piped to AI agents.

```
# sift signals
[urgent] stale_thread: @alice asked about API migration (3d ago, #backend)
[warn]   missed_followup: PR #142 review requested by @bob (2d ago)
[info]   relationship_decay: Haven't talked to @carol in 18 days

# sift search "deploy"
2026-03-14 09:15 [slack/#ops] @dave: deploying v2.3 to staging now
2026-03-13 16:42 [email/inbox] Deploy checklist for Friday release
2026-03-12 11:00 [telegram/team] @eve: can we push deploy to Monday?
2026-03-14 08:00 [files/coaching] daily/2026-03-14: deploy risk flagged in priorities
2026-03-11 14:30 [files/calls] call-with-cto: discussed deploy timeline for v2.3
```

**Why CLI over MCP/API:**
- Any AI agent can already call CLI tools via Bash — no protocol needed
- Composable: `sift signals | grep urgent | wc -l`
- Scriptable: cron jobs, shell aliases, piped workflows
- Minimal output = small context window footprint when AI agents use it
- No server process to manage — just a binary that reads SQLite

---

## 3. Gap Analysis

### 3.1 The Proactive Gap (Biggest Opportunity)

Almost nothing in the personal space is truly proactive. The landscape breaks into:

- **Passive stores** (Obsidian, Notion, note-taking apps) — you put things in, you search for things
- **Query-driven RAG** (Khoj, Quivr, Mem.ai) — you ask questions, they retrieve context
- **Calendar assistants** (Reclaim, Motion) — proactive but only for scheduling
- **Enterprise platforms** (Dust.tt) — have scheduled workflows but are team/company-scoped

Nobody is doing personal-scale proactive signal scanning across communication sources. This is the primary differentiation opportunity.

### 3.2 The Multi-Source Unification Gap

You cannot search across Slack + email + calendar + git in one query today as an individual. Enterprise tools (Dust, Glean) do this for companies but require admin deployment, are cloud-only, expensive, and team-scoped.

The closest personal tools:
- Rewind/Limitless tried (screen capture approach) — now dead
- Khoj does docs/notes but not communications
- No open-source tool unifies personal comms in a searchable store

### 3.3 The SQL-Driven Signals Gap

Nobody is doing this. The monitoring/alerting pattern (Prometheus/Grafana for infrastructure) applied to personal communications doesn't exist as a product. Closest analogies:

- **Linear/Jira notifications** — single tool, notification-based (noisy), not signal-based (intelligent)
- **Email filters/rules** — primitive pattern matching, single source
- **IFTTT/Zapier** — cross-source triggers but no query/analysis capability

This is a genuinely novel approach: treating personal communications as a data stream and running SQL-based alerting queries against it.

### 3.4 The Local-First + Privacy Gap

Truly local-first options are rare:

- Khoj can self-host but still needs cloud LLM by default
- Obsidian is local but has no intelligence layer
- Most "AI memory" tools (Mem.ai, Mem0 cloud) send everything to cloud APIs

Growing demand for local-first AI, especially for personal/sensitive communications.

### 3.5 The LLM-Optional Gap

Everything new is LLM-first. But for search and signals, you don't need an LLM:

- FTS5 handles keyword search perfectly
- SQL queries handle signal detection perfectly
- LLM is only needed for: (a) embeddings for semantic search, (b) summarizing briefings

Making core functionality work without LLM is a strong differentiator for privacy-conscious users, offline use, and cost reduction.

### 3.6 The Unix-Tool Gap

No personal knowledge system ships as a simple CLI tool. Everything is either a web app, an Electron app, or an API server. A Unix-way CLI that reads a local SQLite file — pipeable, scriptable, callable from any AI agent via Bash — is a genuinely different approach. Zero infrastructure, zero protocols, just a binary and a database file.

### 3.7 The Observe-Suggest-Act Spectrum

Most tools are either fully passive (you query them) or try to be fully autonomous (AutoGPT-style, unreliable). The sweet spot is **observe + suggest**: the system watches your streams, surfaces signals, but you decide what to act on. This is the Prometheus model — alerts are surfaced, humans decide response. Nobody is implementing this middle ground for personal communications.

---

## 4. Recommended Approach

### 4.1 What to Build (Priority Order)

**Phase 1: Foundation (Weeks 1-4)**

1. SQLite database with the schema above
2. FTS5 full-text search
3. 5 core connectors: Slack, Telegram, WhatsApp, Email (IMAP/Gmail), Files (markdown directories)
4. CLI: `sift sync`, `sift search`, `sift entity`, `sift query`

**Phase 2: Intelligence Layer (Weeks 5-8)**

1. Signal engine with SQL-driven signal definitions
2. 5-10 built-in signal queries (stale threads, missed follow-ups, relationship decay, deadline proximity, unanswered mentions)
3. Daily briefing generation (with optional LLM summarization)
4. CLI: `sift signals`, `sift briefing`, `sift signals dismiss`
5. sqlite-vec for semantic search (hybrid with FTS5)

**Phase 3: Expansion (Weeks 9-12)**

1. Additional connectors: Linear, Calendar, Git
2. Entity resolution across sources
3. Web UI for browsing signals and search results
4. Custom signal definitions (user-written SQL)
5. Signal history and analytics

### 4.2 What NOT to Build

- **Screen recording** — Rewind tried, privacy nightmare, now dead
- **Autonomous agent loops** — AutoGPT-style "let AI decide what to do" is unreliable
- **Note-taking features** — Obsidian, Notion own this space
- **Team/enterprise features** — Stay personal-first
- **Custom graph database** — SQLite with good schema modeling covers personal-scale relationships
- **API server / MCP server** — CLI + SQLite file is the interface. No server process needed

### 4.3 Key Differentiators

1. **Proactive signals, not just search** — The only personal tool that tells you what you're missing
2. **SQL-driven signal engine** — Transparent, debuggable, customizable alerting on your own data
3. **Local-first, LLM-optional** — Core search and signals work offline with zero API costs
4. **Unix-way CLI** — Pipeable, scriptable, zero infrastructure. Any AI agent calls it via Bash
5. **Multi-source unification** — One search across all your communications

### 4.4 Positioning

**Target user:** Developer/PM/founder who uses 5+ communication tools and misses things. Power user who wants control (local-first, SQL-customizable) rather than a magic black box.

**Pitch:** "Prometheus for your communications. Ingest Slack, Telegram, WhatsApp, email into a local SQLite database. Run SQL-based signal queries to surface stale threads, missed follow-ups, and approaching deadlines. Unix-way CLI — pipe it, script it, call it from any AI agent."

**Tagline candidates:**

- "Proactive signals across all your communications"
- "The monitoring system for your work life"
- "Sift signal from noise, across every channel"

### 4.5 Name Suggestions

**Names that are TAKEN** (avoid these):

- Sentry — error monitoring (huge)
- Cortex — AI workspace search (ProductHunt) + Cortex framework (8k stars)
- Sentinel — Alibaba microservices (23k stars)
- Nexus — multiple projects (12k+ stars)
- Vigil — LLM security scanner (3k stars)
- Beacon — ESP32 Marauder context (10k stars)
- Recall, Capacities, Mem, Dust, Pieces — all taken by existing products

**Naming patterns to AVOID:** Brain/memory metaphors (saturated: "Second Brain", Mem, Recall, Quivr, Capacities)

**Recommended candidates** (low GitHub conflict, strong metaphor):

**Sift**
To separate signal from noise. Active verb. Clear value prop. Works as noun ("run a sift") and verb.
GitHub conflict: 2k stars (computer vision, unrelated domain).

**Trawl**
Deep scanning metaphor — actively pulling up what matters from the depths.
GitHub conflict: 324 stars (unrelated).

**Pith**
The essential core/substance. Botanical term. Implies getting to the heart of things.
GitHub conflict: 517 stars (unrelated "pithos").

**Tendril**
Reaching, connecting structure. Organic multi-source metaphor without being "brain."
GitHub conflict: 264 stars (unrelated).

**Sigint**
Signal intelligence (intelligence community term). Memorable, niche developer appeal.
GitHub conflict: Low.

**Lookout**
Watching, proactive, scanning the horizon.
GitHub conflict: Low.

**Top recommendation: Sift** — One syllable, memorable, directly implies the core value: filtering signal from noise across communication streams. Not a brain metaphor. Works in conversation: "What did Sift find today?" / "Let me sift through last week."

**Runner-up: Trawl** — Stronger metaphor for deep/thorough scanning but slightly more aggressive connotation.

---

## 5. Technical Stack Recommendation

```
Runtime:        Bun (TypeScript)
Database:       SQLite (via bun:sqlite)
Full-text:      FTS5 (built into SQLite)
Vector search:  sqlite-vec (loaded as extension)
Embeddings:     Ollama + nomic-embed-text (local, optional)
LLM:            Ollama or Claude API (optional, for briefing summaries only)
Scheduling:     system cron
CLI:            Commander.js or custom
```

**Why Bun:** Fast, TypeScript-native, good SQLite support, aligns with existing tooling.

---

## 6. Comparable Art / Inspiration (Non-Competitors)

**Prometheus + Grafana**
The monitoring pattern applied to infrastructure — we apply it to communications.

**Superhuman split inbox**
Proactive email triage — we do this across ALL sources.

**Linear's triage queue**
Opinionated workflow for processing signals — inspiration for signal management UX.

**Datadog monitors**
SQL-like queries that fire alerts — directly analogous to our signal definitions.

---

## 7. Suggested First Milestone (v0.1)

The smallest useful version:

1. Two connectors: Files (markdown) + one message stream (Slack or Telegram)
2. SQLite with FTS5 (no vectors yet)
3. One signal definition: "Coaching commitments with no follow-up activity"
4. CLI output: `sift sync` + `sift signals` + `sift search <query>`
5. Zero LLM dependency

This proves the core thesis — multi-source ingestion + SQL signals + Unix CLI — in the simplest possible form.
