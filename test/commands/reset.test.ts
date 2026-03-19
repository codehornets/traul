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
    runReset(db, "embed", {});
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
