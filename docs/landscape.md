# Personal Intelligence Engine — Competitive Landscape Analysis

**Date:** 2026-03-14
**Purpose:** Map existing products and open-source projects that build "personal intelligence engines" — systems that ingest multiple communication/work sources and provide proactive insights or unified search.

---

## Tier 1: Closest to "Personal Intelligence Engine"

### Khoj (khoj-ai/khoj)

- **What it does:** Self-hostable AI second brain that answers questions from your docs or the web, builds custom agents, schedules automations, and does deep research.
- **Data sources:** Markdown/Org files, PDF, images, web pages, GitHub repos, Notion, and more via connectors. Supports local files and online sources.
- **Proactive features:** Yes — scheduled automations can run research/checks without being asked. Custom agents can be triggered on schedules.
- **Storage/search:** Vector embeddings + full-text search. Uses PostgreSQL with pgvector.
- **Open source:** Yes (AGPL-3.0)
- **GitHub:** 33.4k stars, actively maintained (5,148 commits as of March 2026)
- **Shortcomings:** Primarily document-focused. No native Slack/email/calendar ingestion. No real "signal detection" — automations are user-defined, not learned. No communication intelligence layer.

### Limitless (formerly Rewind.ai)

- **What it does:** Recorded everything on your screen and made it searchable via AI. Hardware pendant captured meetings. **Acquired by Meta in late 2025** — no longer selling to new customers. Sunsetting non-Pendant functionality.
- **Data sources:** Screen recordings, audio from meetings (via Pendant hardware), browser history.
- **Proactive features:** Limited — primarily search/recall. Some contextual suggestions based on what you were working on.
- **Storage/search:** Local-first storage with cloud sync option. Compressed screen recording with OCR + embeddings.
- **Open source:** No (proprietary, now part of Meta)
- **Shortcomings:** Dead product for new users. Was the closest to a true "personal intelligence engine" but scope was capture-and-recall, not proactive intelligence. No communication source integration beyond meetings.

### Mem.ai

- **What it does:** AI-powered note-taking app that organizes information automatically and surfaces related notes. Uses AI to connect your thoughts.
- **Data sources:** Notes, documents. Limited external integrations.
- **Proactive features:** Some — "Related memories" surface automatically. AI-powered organization and tagging.
- **Storage/search:** Cloud-based. Semantic search over notes.
- **Open source:** No (proprietary SaaS)
- **Shortcomings:** Closed ecosystem. No multi-source ingestion (email, Slack, calendar). Proactive features are limited to note suggestions, not cross-source intelligence.

### Dust.tt

- **What it does:** Platform for building and deploying custom AI agents connected to company knowledge and tools. "Operating system for AI agents."
- **Data sources:** Slack, Google Drive, Notion, Confluence, GitHub, and more via connectors. Strong enterprise integration story.
- **Proactive features:** Yes — agents can be triggered by events (Slack messages, etc.) and run autonomously. But designed for teams/orgs, not personal use.
- **Storage/search:** Cloud-based. Indexes connected data sources for RAG retrieval.
- **Open source:** Partially (dust-tt/dust on GitHub, 1.3k stars, 21.7k commits — very active). Core platform code is open but hosted service is primary offering.
- **Shortcomings:** Enterprise/team focused, not personal. Pricing reflects org use. Not designed as a personal intelligence layer. No local-first option.

---

## Tier 2: Memory/Knowledge Infrastructure (Building Blocks)

### Mem0 (mem0ai/mem0)

- **What it does:** Universal memory layer for AI agents. Provides persistent, user-scoped memory that agents can read/write to across sessions. Formerly called Embedchain.
- **Data sources:** Any data passed through the API. Supports text, conversations, documents. Integrates with LangChain, CrewAI, AutoGPT.
- **Proactive features:** No — purely a memory storage/retrieval layer. No autonomous surfacing.
- **Storage/search:** Hybrid — vector store (multiple backends: Qdrant, Chroma, PGVector) + graph memory. Supports BM25 + semantic search.
- **Open source:** Yes (Apache 2.0), 49.8k stars — very popular
- **Shortcomings:** Infrastructure, not a product. You'd build a personal intelligence engine ON TOP of Mem0. No connectors, no UI for end users, no proactive signals.

### Graphiti by Zep (getzep/graphiti)

- **What it does:** Builds real-time knowledge graphs for AI agents. Extracts entities and relationships from conversations/text and maintains a temporal knowledge graph.
- **Data sources:** Conversation transcripts, text passages. Data must be fed via API.
- **Proactive features:** No autonomous features. Designed as infrastructure for agent memory.
- **Storage/search:** Neo4j graph database. Combines graph traversal with vector similarity search. Has an MCP server for integration.
- **Open source:** Yes (Apache 2.0), 23.7k stars, active development
- **Shortcomings:** Purely infrastructure. Excellent knowledge graph but no ingestion connectors, no proactive features. Would be a component in a larger system.

### Letta / MemGPT (letta-ai/letta)

- **What it does:** Platform for building stateful agents with advanced memory that can learn and self-improve over time. Pioneered the concept of "memory management" for LLMs (paging context in/out like virtual memory).
- **Data sources:** Conversation history, documents loaded via API. No native connectors to external services.
- **Proactive features:** Agents can self-modify their memory and instructions. Not proactive in the "surface insights" sense, but agents can evolve autonomously.
- **Storage/search:** PostgreSQL-based. Tiered memory: core memory (always in context), archival memory (searchable), recall memory (conversation history).
- **Open source:** Yes (Apache 2.0), 21.6k stars
- **Shortcomings:** Agent framework, not a personal intelligence product. No multi-source ingestion. No proactive signal detection. Building a personal intelligence engine on Letta would require significant custom work.

### Persona (saxenauts/persona)

- **What it does:** Personal Knowledge Graph that builds user memory and personality models from digital footprint. Graph-vector hybrid agent memory.
- **Data sources:** Digital footprint data (details sparse — appears to support text/conversation ingestion via API).
- **Proactive features:** None apparent — focuses on memory retrieval for agents.
- **Storage/search:** Graph + vector hybrid approach.
- **Open source:** Yes, 23 stars — very early stage
- **Shortcomings:** Tiny project, early stage. Interesting concept (personality from digital footprint) but not production-ready.

---

## Tier 3: RAG / Search Frameworks

### Quivr (QuivrHQ/quivr)

- **What it does:** Opinionated RAG framework for integrating GenAI into apps. "Your second brain, empowered by generative AI."
- **Data sources:** Any file type (PDF, docs, etc.), any vectorstore (PGVector, Faiss), any LLM.
- **Proactive features:** None — purely query-driven RAG.
- **Storage/search:** Vector search via multiple backends. Modular architecture.
- **Open source:** Yes (AGPL-3.0), 39k stars
- **Shortcomings:** RAG library, not a personal intelligence product. No connectors to communication tools. No proactive features. Framework for building, not a solution.

### Haystack (deepset-ai/haystack)

- **What it does:** Open-source AI orchestration framework for building production-ready LLM applications. Modular pipelines for RAG, agents, semantic search, and conversational systems.
- **Data sources:** Extensive document loaders. Any text/document source via pipeline components.
- **Proactive features:** None built-in. Could be used to build proactive systems.
- **Storage/search:** Supports multiple vector stores and retrievers. Pipeline-based architecture with explicit control over retrieval, routing, memory.
- **Open source:** Yes (Apache 2.0), 24.5k stars
- **Shortcomings:** Framework, not a product. Would require significant custom development to become a personal intelligence engine. No communication source connectors out of the box.

---

## Tier 4: Agent Frameworks (Could Be Used to Build PIE)

### AutoGPT (Significant-Gravitas/AutoGPT)

- **What it does:** Platform for building, deploying, and running autonomous AI agents. Visual builder for agent workflows.
- **Data sources:** Via tool integrations — web browsing, file reading, API calls.
- **Proactive features:** Agents run autonomously by design. But general-purpose, not personal-intelligence-specific.
- **Storage/search:** Agent memory system with short-term and long-term storage.
- **Open source:** Yes, 182k stars (most-starred AI project)
- **Shortcomings:** General-purpose agent platform. No personal knowledge focus. Memory system is basic. Not designed for multi-source personal data ingestion.

### CrewAI (crewAIInc/crewAI)

- **What it does:** Framework for orchestrating role-playing, autonomous AI agents that work together on complex tasks.
- **Data sources:** Via tools — web search, file reading, API integrations.
- **Proactive features:** Multi-agent collaboration is autonomous. Has memory system (short-term, long-term, entity memory).
- **Storage/search:** Built-in memory with RAG capabilities. Supports embeddings.
- **Open source:** Yes, 46.1k stars
- **Shortcomings:** Task-execution framework, not a personal intelligence system. Memory is session/task-scoped, not a persistent personal knowledge store.

### Semantic Kernel (microsoft/semantic-kernel)

- **What it does:** Microsoft's open-source SDK for integrating LLMs into apps. Supports agents, plugins, memory, and planners.
- **Data sources:** Via plugins — extensible to any source.
- **Proactive features:** None built-in. Supports building autonomous agents with planning capabilities.
- **Storage/search:** Memory system with multiple vector store backends.
- **Open source:** Yes (MIT), 27.5k stars
- **Shortcomings:** SDK/framework, not a product. .NET-first (Python support added later). Enterprise-oriented. No personal intelligence features.

---

## Tier 5: Productivity / Workflow Tools (Adjacent)

### Fabric (danielmiessler/fabric)

- **What it does:** Open-source framework for augmenting humans using AI via a modular system of crowdsourced prompt patterns. CLI tool that pipes content through AI "patterns" (e.g., summarize, extract wisdom, analyze).
- **Data sources:** stdin/pipes — YouTube transcripts, articles, text files. Manual input, not automated ingestion.
- **Proactive features:** None — entirely user-initiated. You pipe content to a pattern.
- **Storage/search:** No persistent storage. Stateless prompt-based processing.
- **Open source:** Yes (MIT), 39.7k stars
- **Shortcomings:** No memory, no ingestion, no search. Excellent for one-off AI processing but fundamentally stateless. Opposite of a persistent intelligence engine.

### Reclaim.ai

- **What it does:** AI-powered calendar management. Auto-schedules tasks, habits, focus time, and meetings. Defends time blocks intelligently.
- **Data sources:** Google Calendar, Outlook, Slack (status sync), Jira, Asana, Todoist, ClickUp, Google Tasks.
- **Proactive features:** Yes — automatically reschedules tasks, defends focus time, surfaces scheduling conflicts, and optimizes your week.
- **Storage/search:** Cloud SaaS. Calendar + task data.
- **Open source:** No (proprietary SaaS)
- **Shortcomings:** Calendar/time-management only. No knowledge search, no communication intelligence. Excellent at what it does but narrow scope.

### Motion

- **What it does:** AI-powered "super app" combining task management, project management, docs, calendar, meeting notes, and search.
- **Data sources:** Calendar, tasks, projects, meeting transcripts, docs. Internal data only.
- **Proactive features:** Yes — AI auto-schedules tasks, creates action items from meetings, sends follow-up emails, builds workflows.
- **Storage/search:** Cloud SaaS. AI search across all internal data (docs, notes, tasks, communications).
- **Open source:** No (proprietary SaaS)
- **Shortcomings:** Walled garden — only searches its own data. No integration with external knowledge sources, email, or Slack content. Expensive ($19-34/mo).

---

## Tier 6: Personal CRM Tools

### Monica CRM (monicahq/monica)

- **What it does:** Open-source personal CRM for tracking relationships with friends, family, and contacts. Stores interaction history, reminders, family details, activities.
- **Data sources:** Manual entry only. No auto-sync from email, calendar, or social media.
- **Proactive features:** Reminders for birthdays and follow-ups. Basic, rule-based.
- **Storage/search:** Laravel/MySQL. Traditional full-text search.
- **Open source:** Yes, 24.4k stars
- **Shortcomings:** Entirely manual data entry. No AI features. No communication ingestion. No intelligence layer. Good concept but stuck in pre-AI paradigm.

### Dex

- **What it does:** Personal CRM that syncs with LinkedIn, email, and other tools. Tracks relationships, reminds you to follow up, shows job changes.
- **Data sources:** LinkedIn (sync), email, iCloud Contacts, Google Contacts.
- **Proactive features:** Yes — notifies when contacts change jobs (via LinkedIn), reminds you to reach out based on frequency goals.
- **Storage/search:** Cloud SaaS. Contact-centric search.
- **Open source:** No (proprietary)
- **Shortcomings:** Contact/relationship focused only. No knowledge search, no document ingestion. LinkedIn-dependent for much of its value. No AI summarization of interactions.

### Clay

- **What it does:** GTM (go-to-market) platform combining AI agents, data enrichment, and intent data for sales teams. Not a personal CRM — enterprise sales tool.
- **Data sources:** 100+ data enrichment providers, CRM data, intent signals.
- **Proactive features:** Yes — intent-based triggers, automated outreach.
- **Storage/search:** Cloud SaaS. Proprietary data enrichment.
- **Open source:** No
- **Shortcomings:** Enterprise sales tool, not personal intelligence. Included here because often mentioned alongside personal CRM tools, but fundamentally different use case.

---

## Tier 7: Obsidian Ecosystem

### Obsidian + Copilot Plugin (logancyang/obsidian-copilot)

- **What it does:** AI copilot inside Obsidian vault. Chat with notes, semantic search, agent mode with tool calling, multimedia understanding (PDFs, YouTube, images, web).
- **Data sources:** Obsidian vault (markdown files), PDFs, YouTube videos, web pages, images.
- **Proactive features:** "Relevant Notes" suggests semantically similar notes. Agent Mode (paid) autonomously triggers vault/web searches. But no scheduled/background proactive features.
- **Storage/search:** Local embeddings (optional). Vault search works without embeddings. Supports OpenAI, local models, and 100+ APIs.
- **Open source:** Yes (partially — core is open, Plus features are paid), 6.4k stars
- **Shortcomings:** Vault-only scope. No email, Slack, calendar, or communication source ingestion. No proactive signal surfacing. Reactive — you must ask.

### Obsidian + Smart Connections (brianpetro/obsidian-smart-connections)

- **What it does:** Shows semantically related notes via AI embeddings. Chat with your notes. Uses local models by default (no API key required).
- **Data sources:** Obsidian vault only.
- **Proactive features:** Connections view automatically shows related notes while you write. Passive but contextual.
- **Storage/search:** Local embeddings using built-in model. No external dependencies required.
- **Open source:** Yes, 4.7k stars
- **Shortcomings:** Vault-only. No external data sources. No communication intelligence. Suggestions are similarity-based, not insight-based.

---

## Tier 8: Niche / Emerging Projects

### Unigraph (unigraph-dev/unigraph-dev)

- **What it does:** Local-first universal knowledge graph, personal search engine, and workspace. Aims to be "the operating system for your information life."
- **Data sources:** Web bookmarks, notes, todos, RSS feeds, email (planned). Graph-based data model where everything is connected.
- **Proactive features:** Backlinks and graph connections surface relationships. Some automated organization.
- **Storage/search:** Local dgraph database. Graph queries + full-text search.
- **Open source:** Yes, 761 stars. Last update Feb 2026 — appears semi-active.
- **Shortcomings:** Ambitious vision but appears stalled. Small team. No AI/LLM integration. Limited real-world adoption.

### Espial (Uzay-G/espial)

- **What it does:** Engine for automated organization and discovery in knowledge bases. Uses NLP to surface connections between notes you didn't explicitly create. "Intended serendipity."
- **Data sources:** File-based knowledge bases (Obsidian, Zettelkasten, etc.).
- **Proactive features:** Yes — actively suggests links between notes. Surfaces domains/ideas to explore based on current note-taking activity.
- **Storage/search:** NLP embeddings for similarity detection.
- **Open source:** Yes, 178 stars. Small project.
- **Shortcomings:** Note-focused only. No communication sources. No LLM integration. Academic/experimental.

### Aether Agent (takzen/aether-agent)

- **What it does:** "Autonomous, local-first personal intelligence layer." Features Active World Model, Qdrant Graph Memory, Circadian Rhythms, and MCP integration.
- **Data sources:** Designed to connect to digital life and IDEs via MCP.
- **Proactive features:** Yes — circadian rhythms suggest it has time-aware proactive behavior. "Hidden brain for your digital life."
- **Storage/search:** Qdrant vector DB + graph memory.
- **Open source:** Yes, 5 stars — extremely early stage (March 2026)
- **Shortcomings:** Essentially a concept/prototype. Interesting architecture but no real adoption or proven functionality.

### Engram (199-biotechnologies/engram)

- **What it does:** High-quality MCP server for personal memory with hybrid search (BM25 + ColBERT + Knowledge Graph).
- **Data sources:** Text/conversation data via MCP protocol.
- **Proactive features:** None — memory server only.
- **Storage/search:** Hybrid: BM25 + ColBERT + Knowledge Graph. Interesting multi-modal retrieval.
- **Open source:** Yes, 3 stars — very early
- **Shortcomings:** MCP server only, not a full system. Interesting search approach but no ingestion or proactive features.

### Samantha MCP (arcAman07/samantha_mcp)

- **What it does:** Headless MCP server that captures personal memories (learning styles, hobbies, preferences) from conversational text. Exports user profiles.
- **Data sources:** Conversational text from any MCP client (Claude Desktop, Cursor, etc.).
- **Proactive features:** None — passive memory capture and retrieval.
- **Storage/search:** JSON-based user profiles.
- **Open source:** Yes, 7 stars
- **Shortcomings:** Very narrow scope. Profile/preference storage only. Not a knowledge system.

---

## Summary Matrix

| Tool | Multi-Source Ingestion | Proactive Signals | Unified Search | Open Source | Stars | Best For |
|---|---|---|---|---|---|---|
| **Khoj** | Partial (docs, not comms) | Scheduled automations | Yes (docs) | Yes | 33.4k | Self-hosted doc Q&A |
| **Limitless/Rewind** | Screen + audio | Limited | Yes | No | Dead | Was: total recall |
| **Mem.ai** | Notes only | Related notes | Yes (notes) | No | N/A | AI note-taking |
| **Dust.tt** | Yes (Slack, Drive, etc.) | Yes (event-driven agents) | Yes | Partial | 1.3k | Enterprise agent platform |
| **Mem0** | Via API only | No | Yes (hybrid) | Yes | 49.8k | Agent memory layer |
| **Graphiti/Zep** | Via API only | No | Yes (graph+vector) | Yes | 23.7k | Knowledge graph infra |
| **Letta/MemGPT** | Via API only | Self-modifying agents | Yes | Yes | 21.6k | Stateful agent memory |
| **Quivr** | Files only | No | Yes (RAG) | Yes | 39k | RAG framework |
| **Haystack** | Docs via loaders | No | Yes (pipeline) | Yes | 24.5k | AI pipeline framework |
| **AutoGPT** | Via tools | Autonomous agents | No | Yes | 182k | General agent platform |
| **CrewAI** | Via tools | Multi-agent collab | No | Yes | 46.1k | Agent orchestration |
| **Fabric** | stdin/pipes | No | No | Yes | 39.7k | One-off AI processing |
| **Reclaim.ai** | Calendar + tasks | Yes (auto-schedule) | No | No | N/A | Calendar optimization |
| **Motion** | Calendar + tasks + docs | Yes (auto-schedule) | Yes (internal) | No | N/A | Work management |
| **Monica CRM** | Manual only | Reminders | Contacts only | Yes | 24.4k | Personal CRM |
| **Dex** | LinkedIn + email | Job change alerts | Contacts only | No | N/A | Relationship CRM |
| **Obsidian Copilot** | Vault + web + PDF | Related notes | Vault only | Partial | 6.4k | Vault AI assistant |
| **Smart Connections** | Vault only | Related notes | Vault only | Yes | 4.7k | Note connections |
| **Unigraph** | Notes + bookmarks | Graph connections | Yes (graph) | Yes | 761 | Knowledge graph workspace |
| **Espial** | File KB only | Link suggestions | Similarity | Yes | 178 | Note discovery |

---

## Key Gaps in the Landscape

### 1. No True Multi-Source Personal Intelligence Engine Exists

The closest products are either:
- **Enterprise-focused** (Dust.tt) — right features, wrong audience
- **Document-focused** (Khoj, Quivr) — no communication source ingestion
- **Dead** (Limitless/Rewind) — was closest to the vision but acquired by Meta
- **Infrastructure** (Mem0, Graphiti, Letta) — building blocks, not products

### 2. Proactive Intelligence Is Almost Non-Existent

Almost every tool is reactive — you ask, it answers. Exceptions:
- **Reclaim.ai** and **Motion** are proactive but only for calendar/scheduling
- **Dust.tt** has event-driven agents but is enterprise-only
- **Dex** alerts on job changes — narrow but truly proactive
- **Espial** suggests note connections — closest to "proactive discovery" in personal knowledge

Nobody is doing: "You haven't responded to this important Slack thread in 3 days" or "This email from last week contradicts what was discussed in yesterday's meeting."

### 3. Communication Intelligence Is a Blind Spot

No open-source tool unifies search across Slack + email + calendar + documents. Enterprise tools (Microsoft Copilot, Google Gemini for Workspace, Glean) do this but are closed, expensive, and company-scoped.

### 4. SQL-Driven Signal Detection Is Novel

No tool found uses the approach of expressing personal signals as queries that run periodically (e.g., "threads where I was mentioned but haven't responded"). This is monitoring/alerting applied to personal communications — a fundamentally different paradigm from RAG.

### 5. MCP-Native Personal Knowledge Is Emerging

Several tiny projects (Engram, Samantha MCP, Open Brain) are building MCP servers for personal memory, but none are comprehensive. This is a nascent space with no clear winner.

### 6. Local-First + AI Is Rare

Khoj and Obsidian plugins are the main local-first options. Most "AI memory" tools are cloud-based. True local-first personal intelligence with no data leaving your machine remains underserved.

---

## Architectural Patterns Observed

**Pattern A: RAG-over-documents** (Khoj, Quivr, Haystack)
Query your docs with AI. Mature but limited to documents. No cross-source intelligence.

**Pattern B: Agent memory layer** (Mem0, Graphiti, Letta)
Persistent memory for AI agents. Powerful infrastructure but not a product. Requires custom integration.

**Pattern C: Autonomous agent platform** (AutoGPT, CrewAI, Dust)
Agents that can use tools and act autonomously. Could be adapted for personal intelligence but require significant custom development.

**Pattern D: Calendar/task optimization** (Reclaim, Motion)
Narrow but effective. Proactive within their domain. Not extensible to knowledge/communication.

**Pattern E: Knowledge graph workspace** (Unigraph, Obsidian + plugins)
Connected notes with discovery features. Limited to what you explicitly put in. No communication ingestion.

**Pattern F: Personal CRM** (Monica, Dex)
Relationship-focused. Manual or LinkedIn-only data. No knowledge/document dimension.

---

## What a True Personal Intelligence Engine Would Combine

1. **Multi-source ingestion** (Pattern A + C): Slack, email, calendar, docs, browser history, git
2. **Persistent knowledge graph** (Pattern B + E): Entities, relationships, temporal evolution
3. **Proactive signal detection** (novel): SQL-like queries over ingested data running on schedules
4. **Unified search** (Pattern A): Semantic + keyword across all sources
5. **Local-first architecture** (Pattern E): Data never leaves your machine
6. **MCP interface** (Pattern B): Any AI client can access your knowledge
7. **LLM-optional core** (novel): Core search and signals work without LLM. LLM enhances with summaries/synthesis.

No existing tool combines all of these. The closest assembly would be: **Mem0 (memory) + Graphiti (knowledge graph) + custom connectors (ingestion) + custom signal engine (proactive) + MCP server (interface)**.
