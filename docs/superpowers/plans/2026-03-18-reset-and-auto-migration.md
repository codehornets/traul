# Reset Command & Auto-Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `traul reset` command for manual data layer resets and auto-migration that detects version mismatches (chunker algorithm, embed model/dims) on startup and rebuilds stale data automatically.

**Architecture:** A new `traul_meta` key-value table stores version constants (`chunker_version`, `embed_model`, `embed_dims`). On DB init, stored values are compared against code constants; mismatches trigger cascading resets. A new `traul reset <layer>` CLI command provides manual control over the same operations.

**Tech Stack:** Bun, bun:sqlite, bun:test, Commander.js

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/db/schema.ts` | Add `traul_meta` table DDL |
| `src/db/database.ts` | Add `getMeta`/`setMeta`/`resetChunks`/`resetSyncCursors` methods |
| `src/db/migrations.ts` | New — version comparison + cascading reset logic |
| `src/lib/chunker.ts` | Export `CHUNKER_VERSION` constant |
| `src/commands/reset.ts` | New — `traul reset` command handler |
| `src/index.ts` | Wire `reset` command, deprecate `reset-embed` |
| `test/db/schema.test.ts` | Test `traul_meta` table creation |
| `test/db/migrations.test.ts` | New — auto-migration tests |
| `test/db/database.test.ts` | Test new DB methods |
| `test/commands/reset.test.ts` | New — reset command tests |

---

### Task 1: Add `traul_meta` Table to Schema

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `test/db/schema.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `test/db/schema.test.ts`:

```typescript
it("creates traul_meta table", () => {
  const db = initializeDatabase(":memory:");
  const tables = db
    .query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    .all()
    .map((r) => r.name);

  expect(tables).toContain("traul_meta");
  db.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/dandaka/projects/traul && bun test test/db/schema.test.ts`
Expected: FAIL — `traul_meta` not in table list

- [ ] **Step 3: Add `traul_meta` table DDL to `SCHEMA_SQL`**

In `src/db/schema.ts`, append to `SCHEMA_SQL` before the closing backtick:

```sql
CREATE TABLE IF NOT EXISTS traul_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/dandaka/projects/traul && bun test test/db/schema.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts test/db/schema.test.ts
git commit -m "feat: add traul_meta table for version tracking"
```

---

### Task 2: Add `getMeta`/`setMeta` Methods to TraulDB

**Files:**
- Modify: `src/db/database.ts`
- Modify: `test/db/database.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `test/db/database.test.ts`:

```typescript
describe("meta", () => {
  it("returns null for missing key", () => {
    expect(db.getMeta("nonexistent")).toBeNull();
  });

  it("stores and retrieves a value", () => {
    db.setMeta("chunker_version", "1");
    expect(db.getMeta("chunker_version")).toBe("1");
  });

  it("overwrites existing value", () => {
    db.setMeta("chunker_version", "1");
    db.setMeta("chunker_version", "2");
    expect(db.getMeta("chunker_version")).toBe("2");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/dandaka/projects/traul && bun test test/db/database.test.ts`
Expected: FAIL — `db.getMeta is not a function`

- [ ] **Step 3: Implement `getMeta` and `setMeta`**

In `src/db/database.ts`, add to the `TraulDB` class:

```typescript
getMeta(key: string): string | null {
  const row = this.db
    .query<{ value: string }, [string]>(
      "SELECT value FROM traul_meta WHERE key = ?"
    )
    .get(key);
  return row?.value ?? null;
}

setMeta(key: string, value: string): void {
  this.db.run(
    "INSERT INTO traul_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value]
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/dandaka/projects/traul && bun test test/db/database.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/db/database.ts test/db/database.test.ts
git commit -m "feat: add getMeta/setMeta for version tracking"
```

---

### Task 3: Add `resetSyncCursors` and `resetChunks` Methods

**Files:**
- Modify: `src/db/database.ts`
- Modify: `test/db/database.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `test/db/database.test.ts`:

```typescript
describe("resetSyncCursors", () => {
  it("clears all cursors for a source", () => {
    db.setSyncCursor("markdown", "file:a.md", "hash1");
    db.setSyncCursor("markdown", "file:b.md", "hash2");
    db.setSyncCursor("slack", "channel:C1", "ts1");

    db.resetSyncCursors("markdown");

    expect(db.getSyncCursor("markdown", "file:a.md")).toBeNull();
    expect(db.getSyncCursor("markdown", "file:b.md")).toBeNull();
    expect(db.getSyncCursor("slack", "channel:C1")).toBe("ts1");
  });

  it("clears all cursors when no source given", () => {
    db.setSyncCursor("markdown", "file:a.md", "hash1");
    db.setSyncCursor("slack", "channel:C1", "ts1");

    db.resetSyncCursors();

    expect(db.getSyncCursor("markdown", "file:a.md")).toBeNull();
    expect(db.getSyncCursor("slack", "channel:C1")).toBeNull();
  });
});

describe("resetChunks", () => {
  it("deletes all chunks and their embeddings", () => {
    db.upsertMessage({
      source: "markdown",
      source_id: "md:abc",
      channel_name: "notes",
      author_name: "doc",
      content: "x".repeat(3000),
      sent_at: 1700000000,
    });

    const msg = db.db
      .query<{ id: number }, [string]>("SELECT id FROM messages WHERE source_id = ?")
      .get("md:abc");

    db.replaceChunks(msg!.id, [
      { index: 0, content: "chunk 0", embeddingInput: "chunk 0" },
      { index: 1, content: "chunk 1", embeddingInput: "chunk 1" },
    ]);

    const chunksBefore = db.getChunkEmbeddingStats();
    expect(chunksBefore.total_chunks).toBe(2);

    db.resetChunks();

    const chunksAfter = db.getChunkEmbeddingStats();
    expect(chunksAfter.total_chunks).toBe(0);
  });

  it("does not delete messages", () => {
    db.upsertMessage({
      source: "markdown",
      source_id: "md:abc",
      channel_name: "notes",
      author_name: "doc",
      content: "some content",
      sent_at: 1700000000,
    });

    db.resetChunks();

    const stats = db.getStats();
    expect(stats.total_messages).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/dandaka/projects/traul && bun test test/db/database.test.ts`
Expected: FAIL — methods not defined

- [ ] **Step 3: Implement `resetSyncCursors` and `resetChunks`**

In `src/db/database.ts`, add to the `TraulDB` class:

```typescript
resetSyncCursors(source?: string): void {
  if (source) {
    this.db.run("DELETE FROM sync_cursors WHERE source = ?", [source]);
  } else {
    this.db.run("DELETE FROM sync_cursors");
  }
}

resetChunks(): void {
  this.db.run("DELETE FROM vec_chunks");
  this.db.run("DELETE FROM chunks");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/dandaka/projects/traul && bun test test/db/database.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/db/database.ts test/db/database.test.ts
git commit -m "feat: add resetSyncCursors and resetChunks methods"
```

---

### Task 4: Export `CHUNKER_VERSION` from Chunker

**Files:**
- Modify: `src/lib/chunker.ts`
- Modify: `test/lib/chunker.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `test/lib/chunker.test.ts`:

```typescript
import { CHUNKER_VERSION } from "../../src/lib/chunker";

describe("CHUNKER_VERSION", () => {
  it("exports a version string", () => {
    expect(typeof CHUNKER_VERSION).toBe("string");
    expect(CHUNKER_VERSION.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/dandaka/projects/traul && bun test test/lib/chunker.test.ts`
Expected: FAIL — `CHUNKER_VERSION` is not exported

- [ ] **Step 3: Add the constant**

In `src/lib/chunker.ts`, add after the existing constants:

```typescript
export const CHUNKER_VERSION = "1";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/dandaka/projects/traul && bun test test/lib/chunker.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/chunker.ts test/lib/chunker.test.ts
git commit -m "feat: export CHUNKER_VERSION constant"
```

---

### Task 5: Implement Auto-Migration Module

**Files:**
- Create: `src/db/migrations.ts`
- Create: `test/db/migrations.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `test/db/migrations.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { TraulDB } from "../../src/db/database";
import { runMigrations, type MigrationResult } from "../../src/db/migrations";
import { CHUNKER_VERSION } from "../../src/lib/chunker";
import { EMBED_MODEL, EMBED_DIMS } from "../../src/lib/embeddings";

describe("runMigrations", () => {
  let db: TraulDB;

  beforeEach(() => {
    db = new TraulDB(":memory:");
  });

  it("sets initial meta values on fresh database", () => {
    const result = runMigrations(db);

    expect(db.getMeta("chunker_version")).toBe(CHUNKER_VERSION);
    expect(db.getMeta("embed_model")).toBe(EMBED_MODEL);
    expect(db.getMeta("embed_dims")).toBe(String(EMBED_DIMS));
    expect(result.chunksReset).toBe(false);
    expect(result.embeddingsReset).toBe(false);
    expect(result.syncCursorsReset).toBe(false);
  });

  it("resets chunks when chunker_version changes", () => {
    // Simulate old version
    db.setMeta("chunker_version", "0");
    db.setMeta("embed_model", EMBED_MODEL);
    db.setMeta("embed_dims", String(EMBED_DIMS));

    // Add a chunk to verify it gets deleted
    db.upsertMessage({
      source: "markdown",
      source_id: "md:test",
      channel_name: "notes",
      author_name: "doc",
      content: "x".repeat(3000),
      sent_at: 1700000000,
    });
    const msg = db.db
      .query<{ id: number }, [string]>("SELECT id FROM messages WHERE source_id = ?")
      .get("md:test");
    db.replaceChunks(msg!.id, [
      { index: 0, content: "old chunk", embeddingInput: "old chunk" },
    ]);

    // Add a sync cursor for markdown
    db.setSyncCursor("markdown", "file:test.md", "oldhash");

    const result = runMigrations(db);

    expect(result.chunksReset).toBe(true);
    expect(result.embeddingsReset).toBe(true); // cascade
    expect(result.syncCursorsReset).toBe(true); // cascade: markdown cursors cleared
    expect(db.getChunkEmbeddingStats().total_chunks).toBe(0);
    expect(db.getEmbeddingStats().embedded_messages).toBe(0);
    expect(db.getSyncCursor("markdown", "file:test.md")).toBeNull();
  });

  it("resets embeddings when embed_model changes", () => {
    db.setMeta("chunker_version", CHUNKER_VERSION);
    db.setMeta("embed_model", "old-model");
    db.setMeta("embed_dims", String(EMBED_DIMS));

    const result = runMigrations(db);

    expect(result.embeddingsReset).toBe(true);
    expect(result.chunksReset).toBe(false);
    expect(db.getMeta("embed_model")).toBe(EMBED_MODEL);
    expect(db.getEmbeddingStats().embedded_messages).toBe(0);
  });

  it("resets embeddings when embed_dims changes", () => {
    db.setMeta("chunker_version", CHUNKER_VERSION);
    db.setMeta("embed_model", EMBED_MODEL);
    db.setMeta("embed_dims", "512");

    const result = runMigrations(db);

    expect(result.embeddingsReset).toBe(true);
    expect(result.chunksReset).toBe(false);
    expect(db.getEmbeddingStats().embedded_messages).toBe(0);
  });

  it("does nothing when all versions match", () => {
    // Run once to set initial values
    runMigrations(db);

    // Add some data
    db.upsertMessage({
      source: "slack",
      source_id: "C1:1",
      channel_name: "eng",
      author_name: "bob",
      content: "hello",
      sent_at: 1700000000,
    });
    db.setSyncCursor("slack", "channel:C1", "ts1");

    // Run again — should be a no-op
    const result = runMigrations(db);

    expect(result.chunksReset).toBe(false);
    expect(result.embeddingsReset).toBe(false);
    expect(result.syncCursorsReset).toBe(false);
    expect(db.getSyncCursor("slack", "channel:C1")).toBe("ts1");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/dandaka/projects/traul && bun test test/db/migrations.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the migrations module**

Create `src/db/migrations.ts`:

```typescript
import type { TraulDB } from "./database";
import { CHUNKER_VERSION } from "../lib/chunker";
import { EMBED_MODEL, EMBED_DIMS } from "../lib/embeddings";
import * as log from "../lib/logger";

export interface MigrationResult {
  chunksReset: boolean;
  embeddingsReset: boolean;
  syncCursorsReset: boolean;
}

export function runMigrations(db: TraulDB): MigrationResult {
  const result: MigrationResult = {
    chunksReset: false,
    embeddingsReset: false,
    syncCursorsReset: false,
  };

  const storedChunkerVersion = db.getMeta("chunker_version");
  const storedEmbedModel = db.getMeta("embed_model");
  const storedEmbedDims = db.getMeta("embed_dims");

  const currentDims = String(EMBED_DIMS);

  // Chunker version change → reset chunks + embeddings + markdown cursors
  if (storedChunkerVersion !== null && storedChunkerVersion !== CHUNKER_VERSION) {
    log.info(`Chunker updated (v${storedChunkerVersion} → v${CHUNKER_VERSION}), rechunking on next sync...`);
    db.resetChunks();
    db.resetEmbeddings(EMBED_DIMS);
    db.resetSyncCursors("markdown");
    result.chunksReset = true;
    result.embeddingsReset = true;
    result.syncCursorsReset = true;
  }

  // Embed model or dims change → reset embeddings only
  if (
    !result.embeddingsReset &&
    storedEmbedModel !== null &&
    (storedEmbedModel !== EMBED_MODEL || storedEmbedDims !== currentDims)
  ) {
    const reason =
      storedEmbedModel !== EMBED_MODEL
        ? `model changed (${storedEmbedModel} → ${EMBED_MODEL})`
        : `dimensions changed (${storedEmbedDims} → ${currentDims})`;
    log.info(`Embedding ${reason}, re-embed with 'traul embed'...`);
    db.resetEmbeddings(EMBED_DIMS);
    result.embeddingsReset = true;
  }

  // Update stored values
  db.setMeta("chunker_version", CHUNKER_VERSION);
  db.setMeta("embed_model", EMBED_MODEL);
  db.setMeta("embed_dims", currentDims);

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/dandaka/projects/traul && bun test test/db/migrations.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/db/migrations.ts test/db/migrations.test.ts
git commit -m "feat: add auto-migration for chunker/embed version changes"
```

---

### Task 6: Wire Auto-Migration into DB Init

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add `runMigrations` call after DB construction**

In `src/index.ts`, after line `const db = new TraulDB(config.database.path);`, add:

```typescript
import { runMigrations } from "./db/migrations";
```

(at the top with other imports) and:

```typescript
runMigrations(db);
```

(after the `db` construction)

- [ ] **Step 2: Run the full test suite to ensure no regressions**

Run: `cd /Users/dandaka/projects/traul && bun test`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: run auto-migration on startup"
```

---

### Task 7: Implement `traul reset` Command

**Files:**
- Create: `src/commands/reset.ts`
- Create: `test/commands/reset.test.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `test/commands/reset.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { TraulDB } from "../../src/db/database";
import { runReset } from "../../src/commands/reset";

describe("runReset", () => {
  let db: TraulDB;

  beforeEach(() => {
    db = new TraulDB(":memory:");
    // Seed data
    db.upsertMessage({
      source: "slack",
      source_id: "C1:1",
      channel_name: "eng",
      author_name: "bob",
      content: "hello",
      sent_at: 1700000000,
    });
    db.upsertMessage({
      source: "markdown",
      source_id: "md:abc",
      channel_name: "notes",
      author_name: "doc",
      content: "x".repeat(3000),
      sent_at: 1700000001,
    });
    const msg = db.db
      .query<{ id: number }, [string]>("SELECT id FROM messages WHERE source_id = ?")
      .get("md:abc");
    db.replaceChunks(msg!.id, [
      { index: 0, content: "chunk 0", embeddingInput: "chunk 0" },
    ]);
    db.setSyncCursor("slack", "channel:C1", "ts1");
    db.setSyncCursor("markdown", "file:a.md", "hash1");
  });

  it("reset sync clears all cursors", () => {
    runReset(db, "sync", {});
    expect(db.getSyncCursor("slack", "channel:C1")).toBeNull();
    expect(db.getSyncCursor("markdown", "file:a.md")).toBeNull();
  });

  it("reset sync with --source filters by source", () => {
    runReset(db, "sync", { source: "markdown" });
    expect(db.getSyncCursor("markdown", "file:a.md")).toBeNull();
    expect(db.getSyncCursor("slack", "channel:C1")).toBe("ts1");
  });

  it("reset chunks deletes chunks and resets embeddings", () => {
    runReset(db, "chunks", {});
    expect(db.getChunkEmbeddingStats().total_chunks).toBe(0);
    expect(db.getEmbeddingStats().embedded_messages).toBe(0);
  });

  it("reset embed drops vec tables", () => {
    // Should not throw
    runReset(db, "embed", {});
    // Vec tables recreated — stats should work
    expect(db.getEmbeddingStats().embedded_messages).toBe(0);
  });

  it("reset all clears everything", () => {
    runReset(db, "all", {});
    expect(db.getSyncCursor("slack", "channel:C1")).toBeNull();
    expect(db.getChunkEmbeddingStats().total_chunks).toBe(0);
    expect(db.getEmbeddingStats().embedded_messages).toBe(0);
  });

  it("preserves messages on all reset layers", () => {
    runReset(db, "all", {});
    expect(db.getStats().total_messages).toBe(2);
  });

  it("throws on invalid layer", () => {
    expect(() => runReset(db, "invalid", {})).toThrow("Unknown layer");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/dandaka/projects/traul && bun test test/commands/reset.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the reset command**

Create `src/commands/reset.ts`:

```typescript
import type { TraulDB } from "../db/database";
import { EMBED_DIMS } from "../lib/embeddings";

type Layer = "sync" | "chunks" | "embed" | "all";

const VALID_LAYERS: Layer[] = ["sync", "chunks", "embed", "all"];

export function runReset(
  db: TraulDB,
  layer: string,
  options: { source?: string }
): void {
  if (!VALID_LAYERS.includes(layer as Layer)) {
    throw new Error(`Unknown layer: ${layer}. Valid layers: ${VALID_LAYERS.join(", ")}`);
  }

  const doSync = layer === "sync" || layer === "all";
  const doChunks = layer === "chunks" || layer === "all";
  const doEmbed = layer === "embed" || layer === "all" || layer === "chunks";

  if (doSync) {
    db.resetSyncCursors(options.source);
    const scope = options.source ? `${options.source} sync cursors` : "all sync cursors";
    console.log(`Reset ${scope}. Run 'traul sync' to refetch.`);
  }

  if (doChunks) {
    db.resetChunks();
    console.log("Reset all chunks. They will be regenerated on next 'traul sync' or 'traul embed'.");
  }

  if (doEmbed) {
    db.resetEmbeddings(EMBED_DIMS);
    console.log("Reset all embeddings. Run 'traul embed' to regenerate.");
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/dandaka/projects/traul && bun test test/commands/reset.test.ts`
Expected: All PASS

- [ ] **Step 5: Wire the command into `src/index.ts`**

Add the import at the top:

```typescript
import { runReset } from "./commands/reset";
```

Add the command after the existing `reset-embed` command:

```typescript
program
  .command("reset")
  .description("Reset a data layer (sync, chunks, embed, all)")
  .argument("<layer>", "layer to reset: sync, chunks, embed, all")
  .option("-s, --source <source>", "filter by source (for sync layer)")
  .action(async (layer: string, options) => {
    runReset(db, layer, options);
    db.close();
  });
```

Also deprecate the old `reset-embed` command by replacing its action to delegate to `runReset`:

```typescript
program
  .command("reset-embed")
  .description("(deprecated: use 'traul reset embed') Drop all embeddings")
  .action(async () => {
    console.log("Note: 'reset-embed' is deprecated, use 'traul reset embed' instead.");
    runReset(db, "embed", {});
    db.close();
  });
```

- [ ] **Step 6: Run full test suite**

Run: `cd /Users/dandaka/projects/traul && bun test`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add src/commands/reset.ts test/commands/reset.test.ts src/index.ts
git commit -m "feat: add traul reset command for manual data layer resets"
```

---

### Task 8: Update Documentation

**Files:**
- Modify: `skill.md`

- [ ] **Step 1: Add `traul reset` documentation to `skill.md`**

Add a section documenting:
- `traul reset sync [--source <source>]` — clear sync cursors, refetch on next sync
- `traul reset chunks` — delete all chunks (implies embed reset)
- `traul reset embed` — drop and recreate vector tables
- `traul reset all` — reset everything (sync + chunks + embed)
- Auto-migration behavior: traul detects version changes on startup and resets automatically

- [ ] **Step 2: Commit**

```bash
git add skill.md
git commit -m "docs: document traul reset command and auto-migration"
```
