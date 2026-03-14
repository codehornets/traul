# Personal Intelligence Engine — Strategy & Market Research

*Date: 2026-03-14*

---

## 1. Landscape & Gap Analysis

### 1.1 Proactive vs Reactive

**Current state:** Nearly every tool in this space is reactive — you store data, then query it.

Existing approaches to proactivity:
- **Khoj** (33k stars) — Closest to proactive. Offers "scheduled automations" and agents that can research across docs + web. But automations are still user-configured, not emergent.
- **Pieces** (150k+ users) — OS-level memory with "LTM-2 Long-Term Memory Engine." Automatically captures what you work on across apps. Surfaces context for stand-ups. Closest to "observe" in the observe-suggest-act spectrum.
- **Limitless/Rewind** (now acquired by Meta) — Was the pioneer of passive capture (screen recording + transcription). Proved the market exists but also proved the privacy risk: product is now being sunset outside US.
- **Dust.tt** — Enterprise-focused. "Operating system for AI agents." Agents connect to company knowledge + tools. Good multi-source, but enterprise/team-oriented, not personal.

**The gap:** No tool runs user-defined signal queries on a schedule and proactively notifies. The "cron job for your communication streams" does not exist. Khoj's automations are the closest but they're LLM-driven prompts, not structured queries.

### 1.2 Multi-Source Unification

**Who attempts it:**
- **Cortex** (ProductHunt, 41 reviews) — "Let your AI search all your workspace apps at once." Consumer-grade unified search.
- **Dust.tt** — Connects to Slack, Notion, Google Drive, GitHub, etc. Best enterprise implementation.
- **Pieces** — Captures across IDEs, browsers, chat apps at OS level.
- **Unigraph** (761 stars) — "Local-first universal knowledge graph, personal search engine, and workspace." Ambitious but appears stalled.

**Where they fail:**
- Cortex/Dust require cloud processing — no local option
- Most connectors are read-only ingestion, not bidirectional
- Calendar + email + Slack + git in one query is still not solved for individuals
- Connector maintenance is a massive engineering burden (APIs change constantly)

**The gap:** No tool lets you write a single query that spans Slack threads, email, calendar events, and git commits with structured output. They all do "semantic search across sources" but not "structured query across sources."

### 1.3 SQL-Driven Signals

**Current state:** This approach essentially does not exist in the personal tools space.

Adjacent precedents:
- **Steampipe** — SQL interface to cloud APIs (AWS, GitHub, Slack). Closest technical analog but oriented toward DevOps/infrastructure, not personal productivity.
- **Osquery** — SQL for operating system state. Same pattern applied to OS internals.
- **Dataview** (Obsidian plugin) — SQL-like queries over markdown metadata. Popular (2.1k stars for successor Datacore) but limited to Obsidian vault contents.
- **SilverBullet** (4.9k stars) — Markdown + Lua scripting. Allows programmatic queries over notes but not external sources.

**The gap:** Nobody is doing `SELECT messages FROM slack WHERE channel = 'engineering' AND mentions_me AND my_reply IS NULL AND age > '3 days'` as a personal monitoring system. This is a genuinely novel approach — applying infrastructure monitoring patterns (Prometheus/Grafana alerting) to personal communication streams.

### 1.4 Local-First + Privacy

**Truly local-first tools:**
- **Khoj** — Self-hostable, can run with local LLMs (Llama, etc.)
- **Pieces** — Runs a local OS-level service, processes on-device
- **Obsidian** — Local markdown files, plugins can add AI features
- **SilverBullet** — Self-hosted, local-first markdown platform
- **Unigraph** — Local-first knowledge graph
- **OpenAmnesia** (11 stars, very new) — "Continual learning context engine that securely extracts memory from real activity." Explicitly local-first for agent context.

**The gap:** Local-first tools exist but they all compromise on either (a) requiring an LLM for core features or (b) limited source integration. A tool that indexes locally, queries locally with SQL, and optionally enriches with LLM would be unique.

### 1.5 LLM-Optional

**Current state:** Almost every new tool in this space is LLM-first. The entire value proposition depends on having an LLM.

**Exceptions:**
- **Obsidian + Dataview** — Core is just files + queries. LLM plugins are add-ons.
- **SilverBullet** — Lua scripting over markdown. No LLM required.
- **Steampipe** — Pure SQL over APIs. No AI involved.

**The gap:** Wide open. An intelligence engine where the core loop is "ingest → index → query → alert" using SQL/structured queries, with LLM as an optional enhancement layer for summarization and natural language queries, would be significantly differentiated.

### 1.6 MCP-Native

**Current state:** The MCP ecosystem (81k stars on the servers repo) is exploding, but it's all about individual tool integrations — Slack MCP server, GitHub MCP server, etc.

**No personal knowledge system is designed as an MCP server from the ground up.** Existing MCP servers are single-purpose connectors. Nobody has built a unified personal intelligence layer that:
1. Consumes data from other MCP servers (Slack, email, calendar, git)
2. Indexes and cross-references it locally
3. Exposes itself as an MCP server for AI assistants to query

This is a genuine whitespace.

### 1.7 The Observe → Suggest → Act Spectrum

**Fully passive (query-based):** Obsidian, Notion, most RAG tools
**Fully autonomous (agent-based):** AutoGPT, Devin-style agents
**Middle ground attempts:**
- **Pieces** — Observes your workflow, suggests context during stand-ups. Does not take action.
- **Khoj** — Can schedule automations but user must define them. Agents act on instruction.
- **GitHub Copilot** — Observes code context, suggests completions. Does not act without approval.

**The gap:** The "suggest" layer is underdeveloped. A system that watches your communication streams, identifies patterns (stale threads, approaching deadlines, contradictions between what was said in Slack vs. email), and surfaces them as actionable signals — without requiring you to ask — is the missing middle ground.

---

## 2. Competitive Landscape Summary

| Tool | Stars/Users | Proactive | Multi-Source | Local-First | LLM-Optional | MCP-Native |
|------|------------|-----------|-------------|-------------|--------------|------------|
| Khoj | 33k stars | Partial | Docs + Web | Self-host | No | No |
| Pieces | 150k users | Yes (OS) | IDE + Browser | Yes | No | No |
| Dust.tt | Enterprise | Agent-based | Many (Slack, Notion, GH) | No | No | No |
| Obsidian+Dataview | Millions | No | Vault only | Yes | Yes | No |
| SilverBullet | 4.9k stars | No | Notes only | Yes | Yes | No |
| Unigraph | 761 stars | No | Limited | Yes | Yes | No |
| Cortex | PH launch | No | Multi-app search | No | No | No |
| Quivr | 39k stars | No | File upload | No (RAG) | No | No |
| OpenAmnesia | 11 stars | Passive capture | IDE sessions | Yes | Partial | No |

**Nobody occupies the intersection of: proactive signals + multi-source + local-first + LLM-optional + MCP-native.**

---

## 3. Naming Research

### 3.1 Taken Names (with significant presence)

| Name | What it is | Stars/Scale |
|------|-----------|-------------|
| Khoj | AI second brain | 33k stars |
| Rewind | Screen capture AI (now Limitless → acquired by Meta) | Sunset |
| Limitless | Meeting AI → acquired by Meta | Sunset |
| Mem | AI note-taking | Funded startup |
| Dust | Enterprise AI agents | Funded startup |
| Cortex | AI workspace search (ProductHunt) + Cortex framework (8k stars) | Taken |
| Quivr | RAG framework ("your second brain") | 39k stars |
| Pieces | Developer memory/context | 150k users |
| Recall | Personal AI Encyclopedia (ProductHunt) | Taken |
| Capacities | "Studio for your mind" (ProductHunt) | Taken |
| Sentinel | Alibaba microservices framework | 23k stars |
| Nexus | Multiple projects (GitNexus 12.8k) | Heavily used |
| Lumen | Laravel packages (11k+ stars) | Heavily used |
| Filament | PHP admin panel | 30k stars |
| Nerve | Multiple projects (2.4k stars) | Moderate |
| Vigil | LLM security scanner (3k stars) | Moderate |
| Beacon | ESP32 Marauder context (10k stars) | Moderate |

### 3.2 Naming Patterns in the Space

- **Brain/Memory metaphors:** Second Brain, Mem, Recall, Quivr, Capacities — *heavily saturated*
- **Intelligence metaphors:** Cortex, Pieces (LTM-2) — *moderately saturated*
- **Nature/Organic:** Khoj (search in Urdu), Dust — *less pattern, more unique*
- **Observation/Awareness:** Rewind, Limitless — *some saturation*

### 3.3 Available Name Candidates

**Low conflict, strong metaphor:**

| Name | GitHub Conflict | Rationale |
|------|----------------|-----------|
| **Trawl** | 324 stars (unrelated) | Fishing metaphor — actively scanning depths, pulling up what matters. Implies thoroughness without AI hype. |
| **Sift** | 2k stars (computer vision, unrelated) | To separate signal from noise. Direct, verb-based, implies active filtering. |
| **Pith** | 517 stars (unrelated "pithos") | The essential core/substance. Botanical term — the central tissue. Implies getting to the heart of things. |
| **Tendril** | 264 stars (unrelated) | A reaching, connecting structure. Implies organic growth and multi-source connection without being "brain." |
| **Grasp** | 1.8k stars (unrelated) | To understand + to hold. Double meaning: comprehension and capture. |

---

## 4. Positioning Recommendations

### 4.1 What to Build (Priority Features)

1. **SQL-like signal definitions over communication streams** — The killer differentiator. Let users express "what matters" as structured queries, not natural language prompts. Example: `WHERE thread.stale > 3d AND thread.involves_me AND NOT thread.replied_by_me`. This is the "Prometheus for your work life" angle.

2. **Local-first SQLite index with MCP connectors** — Ingest from Slack, email, calendar, git via MCP servers. Store in local SQLite. The MCP ecosystem provides the connectors; you provide the unified index and query layer.

3. **Scheduled signal evaluation (cron-based)** — Signals run on a schedule (every hour, every morning). Results surface as a daily briefing or push notifications. This is the proactive layer that nobody has.

4. **MCP server interface** — Expose the intelligence engine as an MCP server so Claude, Cursor, or any MCP-compatible AI can query your unified personal context. "What did the team discuss about the API migration last week?" answered from structured local data.

5. **LLM as enhancement layer, not core** — Core loop works with pure SQL queries. LLM adds: natural language query translation to SQL, summarization of signal results, and suggested new signals based on patterns.

### 4.2 What NOT to Build

- **Another note-taking app** — Obsidian, Notion, SilverBullet own this. Do not compete.
- **A RAG chatbot** — Quivr (39k stars), Khoj, and dozens of others. Saturated.
- **Screen/audio recording** — Limitless tried this, got acquired by Meta. Privacy nightmare, needs hardware. Avoid.
- **An AI agent framework** — Dust, LangChain, CrewAI own this. Not your fight.
- **A UI-heavy app** — Start CLI/config-first. The target user (developers/power users) prefers config files over GUIs.

### 4.3 Positioning Statement

**For developers and power users** who are drowning in communication channels and scattered context,

**[Name]** is a **local-first personal signal engine** that turns your Slack, email, calendar, and git into a queryable database with scheduled alerts,

**Unlike** Khoj, Pieces, or Obsidian plugins which are LLM-first reactive tools,

**[Name]** lets you define what matters as structured queries that run on autopilot — no AI required, LLM-enhanced when you want it.

### 4.4 Tagline Candidates

- "SQL for your work life"
- "Structured signals from scattered streams"
- "Your communication streams, queryable"
- "Monitor what matters. Locally."
- "The missing cron job for your context"

### 4.5 Key Differentiators (Elevator Pitch)

1. **Signals, not search** — You define what matters once; it watches forever
2. **SQL, not prompts** — Deterministic, auditable, LLM-optional
3. **Local-first, MCP-native** — Your data stays on your machine; any AI can query it
4. **Proactive, not reactive** — Surfaces insights before you ask

---

## 5. Recommended Name: **Sift**

**Primary recommendation: Sift**

- Clear, memorable, one syllable
- Verb that implies active intelligence: to examine carefully, to separate valuable from worthless
- No significant GitHub conflict in this domain (existing "sift" repos are computer vision, unrelated)
- Works as both noun and verb: "Run a sift" / "Sift through your streams"
- Not a brain/memory metaphor — avoids the saturated "second brain" positioning
- Implies the core value prop: signal extraction from noise

**Alternatives in order of preference:**

1. **Sift** — Active filtering metaphor. Best overall.
2. **Trawl** — Deep scanning metaphor. Slightly more aggressive connotation.
3. **Pith** — The essential core. More abstract, harder to Google.
4. **Tendril** — Organic multi-source connection. More poetic, might be too soft.
5. **Grasp** — Understanding + capture. Slightly generic.

---

## 6. Suggested First Milestone

**v0.1 — "One signal, one source"**
- Single MCP connector (Slack)
- Local SQLite index of messages
- One signal definition in YAML/SQL
- Cron-based evaluation
- CLI output of matched signals
- Zero LLM dependency

This proves the core thesis in the smallest possible scope. Everything else (more sources, LLM layer, MCP server interface, daily briefings) layers on top.
