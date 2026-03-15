import { describe, it, expect, beforeEach } from "bun:test";
import { TraulDB } from "../../src/db/database";

describe("Search command logic", () => {
  let db: TraulDB;

  beforeEach(() => {
    db = new TraulDB(":memory:");

    db.upsertMessage({
      source: "slack",
      source_id: "C1:1",
      channel_name: "engineering",
      author_name: "alice",
      content: "We need to fix the API rate limiting before launch",
      sent_at: 1700000000,
    });
    db.upsertMessage({
      source: "slack",
      source_id: "C1:2",
      channel_name: "engineering",
      author_name: "bob",
      content: "The database migration script failed on staging",
      sent_at: 1700000100,
    });
    db.upsertMessage({
      source: "slack",
      source_id: "C2:1",
      channel_name: "product",
      author_name: "carol",
      content: "Launch timeline looks good, API docs are ready",
      sent_at: 1700000200,
    });
  });

  it("searches by keyword", () => {
    const results = db.searchMessages("API");
    expect(results.length).toBe(2);
  });

  it("filters by source", () => {
    const results = db.searchMessages("API", { source: "slack" });
    expect(results.length).toBe(2);
  });

  it("filters by channel", () => {
    const results = db.searchMessages("API", { channel: "engineering" });
    expect(results.length).toBe(1);
    expect(results[0].author_name).toBe("alice");
  });

  it("filters by time range", () => {
    const results = db.searchMessages("API", {
      after: 1700000050,
    });
    // Only carol's message should match (after the cutoff)
    expect(results.length).toBe(1);
    expect(results[0].author_name).toBe("carol");
  });

  it("filters by channel substring", () => {
    db.upsertMessage({
      source: "markdown",
      source_id: "book:1",
      channel_name: "books/books",
      author_name: "The Lean Startup",
      content: "Build measure learn is the core feedback loop",
      sent_at: 1700000300,
    });

    // Exact prefix should match
    const results = db.searchMessages("feedback", { channel: "books" });
    expect(results.length).toBe(1);
    expect(results[0].channel_name).toBe("books/books");

    // Full name should also match
    const results2 = db.searchMessages("feedback", { channel: "books/books" });
    expect(results2.length).toBe(1);

    // Non-matching substring should return nothing
    const results3 = db.searchMessages("feedback", { channel: "slack" });
    expect(results3.length).toBe(0);
  });
});
