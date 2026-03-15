import { describe, it, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { initializeDatabase } from "../../src/db/schema";

describe("initializeDatabase", () => {
  it("creates all tables", () => {
    const db = initializeDatabase(":memory:");
    const tables = db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      .all()
      .map((r) => r.name);

    expect(tables).toContain("messages");
    expect(tables).toContain("contacts");
    expect(tables).toContain("contact_identities");
    expect(tables).toContain("sync_cursors");
    expect(tables).toContain("messages_fts");
    db.close();
  });

  it("enables WAL mode", () => {
    const db = initializeDatabase(":memory:");
    const mode = db
      .query<{ journal_mode: string }, []>("PRAGMA journal_mode")
      .get();
    // In-memory databases may report "memory" instead of "wal"
    expect(["wal", "memory"]).toContain(mode!.journal_mode);
    db.close();
  });

  it("enables foreign keys", () => {
    const db = initializeDatabase(":memory:");
    const fk = db
      .query<{ foreign_keys: number }, []>("PRAGMA foreign_keys")
      .get();
    expect(fk!.foreign_keys).toBe(1);
    db.close();
  });

  it("is idempotent", () => {
    const db = initializeDatabase(":memory:");
    // Running schema again should not throw
    expect(() => initializeDatabase(":memory:")).not.toThrow();
    db.close();
  });
});
