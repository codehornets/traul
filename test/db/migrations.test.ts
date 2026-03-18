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
    db.setMeta("chunker_version", "0");
    db.setMeta("embed_model", EMBED_MODEL);
    db.setMeta("embed_dims", String(EMBED_DIMS));

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
    db.setSyncCursor("markdown", "file:test.md", "oldhash");

    const result = runMigrations(db);

    expect(result.chunksReset).toBe(true);
    expect(result.embeddingsReset).toBe(true);
    expect(result.syncCursorsReset).toBe(true);
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
    runMigrations(db);

    db.upsertMessage({
      source: "slack",
      source_id: "C1:1",
      channel_name: "eng",
      author_name: "bob",
      content: "hello",
      sent_at: 1700000000,
    });
    db.setSyncCursor("slack", "channel:C1", "ts1");

    const result = runMigrations(db);

    expect(result.chunksReset).toBe(false);
    expect(result.embeddingsReset).toBe(false);
    expect(result.syncCursorsReset).toBe(false);
    expect(db.getSyncCursor("slack", "channel:C1")).toBe("ts1");
  });
});
