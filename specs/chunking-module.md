# Chunking Module Spec

## Summary

Add a standalone chunking module (`src/lib/chunker.ts`) and a `chunks` DB table to support full-content indexing of large documents (call transcripts, long markdown files). The chunker is a pure function with no DB/config dependencies — connectors call it and store chunks themselves.

## Architecture

```
Connector → chunkText(text, opts) → [{content, index}]
         → db.upsertMessage(full text)
         → db.replaceChunks(messageId, chunks)
         → FTS + embeddings point to chunks table
```

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Storage | New `chunks` table | Clean separation, original message keeps full text |
| Strategy | Fixed-size with word-aligned overlap | Simple, predictable, good enough for v1 |
| Scope | Large content only (>2000 chars) | Small messages don't benefit, avoids overhead |
| Search UX | Show chunk content + source metadata | User sees relevant excerpt, not full 40k doc |
| Re-sync | Delete all chunks, re-chunk | Simple, correct. Re-embedding cost acceptable |
| Module API | Pure function: text in, chunks out | Zero dependencies, maximum reusability |
| Chunk size | ~1500 chars (~300 words) | Fits embedding model context (2048 tokens) |
| Context | Prepend doc title/path to embedding input | Grounds chunk in document context |
| Overlap | Word-aligned ~200 chars | Avoids mid-word splits |

## DB Schema

```sql
CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(message_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_chunks_message ON chunks(message_id);
```

FTS and vector tables will index chunks instead of messages (for chunked content):
- `chunks_fts` — FTS5 virtual table on chunks.content
- `vec_chunks` — vector table for chunk embeddings

## Module Interface

```typescript
// src/lib/chunker.ts

interface ChunkOptions {
  maxChunkSize?: number;    // default: 1500
  overlap?: number;         // default: 200
  docTitle?: string;        // prepended to each chunk for embedding context
}

interface Chunk {
  index: number;
  content: string;          // raw chunk text (no title prepended)
  embeddingInput: string;   // with title prepended (used for embedding)
}

function chunkText(text: string, options?: ChunkOptions): Chunk[];
function shouldChunk(text: string, threshold?: number): boolean; // default threshold: 2000
```

## Connector Changes

### Markdown connector
- Remove 8000-char truncation
- Store full content in `messages.content`
- If `shouldChunk(content)`, call `chunkText()` and store via `db.replaceChunks()`

### Other connectors (future)
- Same pattern: check `shouldChunk()`, chunk if needed

## Search Changes

- Hybrid search checks `chunks` table first for chunked messages
- Results return chunk content + parent message metadata (source, channel, author, path)
- Non-chunked messages searched as before (backward compatible)

## Embed Changes

- `getUnembeddedMessages` also returns unembedded chunks
- Chunks are embedded using `chunk.embeddingInput` (with doc title prefix)
- Vector stored in `vec_chunks` table

## Migration

- Existing messages remain untouched
- Next `traul sync` for markdown will detect content hash change (since we now store full content vs truncated) and re-sync, triggering chunking
- Next `traul embed` picks up new chunks
