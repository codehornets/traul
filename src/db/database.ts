import { Database } from "bun:sqlite";
import { initializeDatabase } from "./schema";
import * as Q from "./queries";

export interface MessageRow {
  id: number;
  source: string;
  source_id: string;
  channel_name: string | null;
  thread_id: string | null;
  author_name: string | null;
  content: string;
  sent_at: number;
  metadata: string | null;
  rank?: number;
}

export interface EmbeddingStats {
  total_messages: number;
  embedded_messages: number;
}

export interface ChunkEmbeddingStats {
  total_chunks: number;
  embedded_chunks: number;
}

export interface Stats {
  total_messages: number;
  total_channels: number;
  total_contacts: number;
}

export class TraulDB {
  db: Database;

  constructor(path: string) {
    this.db = initializeDatabase(path);
  }

  upsertMessage(msg: {
    source: string;
    source_id: string;
    channel_id?: string;
    channel_name?: string;
    thread_id?: string;
    author_id?: string;
    author_name?: string;
    content: string;
    sent_at: number;
    metadata?: string;
  }): void {
    this.db.run(Q.UPSERT_MESSAGE, [
      msg.source,
      msg.source_id,
      msg.channel_id ?? null,
      msg.channel_name ?? null,
      msg.thread_id ?? null,
      msg.author_id ?? null,
      msg.author_name ?? null,
      msg.content,
      msg.sent_at,
      msg.metadata ?? null,
    ]);
  }

  upsertContact(displayName: string): number {
    const row = this.db
      .query<{ id: number }, [string]>(Q.UPSERT_CONTACT)
      .get(displayName);
    return row!.id;
  }

  upsertContactIdentity(identity: {
    contactId: number;
    source: string;
    sourceUserId: string;
    username?: string;
    displayName?: string;
  }): void {
    this.db.run(Q.UPSERT_CONTACT_IDENTITY, [
      identity.contactId,
      identity.source,
      identity.sourceUserId,
      identity.username ?? null,
      identity.displayName ?? null,
    ]);
  }

  getContactBySourceId(
    source: string,
    sourceUserId: string
  ): { id: number; display_name: string } | null {
    return this.db
      .query<{ id: number; display_name: string }, [string, string]>(
        Q.GET_CONTACT_BY_SOURCE_ID
      )
      .get(source, sourceUserId);
  }

  hasMessage(source: string, sourceId: string): boolean {
    return !!this.db
      .query<{ "1": number }, [string, string]>(Q.HAS_MESSAGE)
      .get(source, sourceId);
  }

  getSyncCursor(source: string, key: string): string | null {
    const row = this.db
      .query<{ cursor_value: string }, [string, string]>(Q.GET_SYNC_CURSOR)
      .get(source, key);
    return row?.cursor_value ?? null;
  }

  setSyncCursor(source: string, key: string, value: string): void {
    this.db.run(Q.SET_SYNC_CURSOR, [source, key, value]);
  }

  searchMessages(
    query: string,
    options?: {
      source?: string;
      channel?: string;
      after?: number;
      before?: number;
      limit?: number;
    }
  ): MessageRow[] {
    const limit = options?.limit ?? 20;
    const conditions: string[] = [];
    const params: (string | number)[] = [query];

    if (options?.source) {
      conditions.push("m.source = ?");
      params.push(options.source);
    }
    if (options?.channel) {
      conditions.push("m.channel_name = ?");
      params.push(options.channel);
    }
    if (options?.after) {
      conditions.push("m.sent_at > ?");
      params.push(options.after);
    }
    if (options?.before) {
      conditions.push("m.sent_at < ?");
      params.push(options.before);
    }

    let sql = Q.SEARCH_MESSAGES_FILTERED;
    if (conditions.length > 0) {
      sql += " AND " + conditions.join(" AND ");
    }
    sql += " ORDER BY rank LIMIT ?";
    params.push(limit);

    return this.db.query<MessageRow, (string | number)[]>(sql).all(...params);
  }

  getStats(): Stats {
    return this.db.query<Stats, []>(Q.GET_STATS).get()!;
  }

  getMessages(options?: {
    channel?: string;
    channelLike?: string;
    author?: string;
    source?: string;
    after?: number;
    before?: number;
    limit?: number;
    asc?: boolean;
  }): MessageRow[] {
    const limit = options?.limit ?? 50;
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (options?.channel) {
      conditions.push("m.channel_name = ?");
      params.push(options.channel);
    }
    if (options?.channelLike) {
      conditions.push("m.channel_name LIKE ?");
      params.push(`%${options.channelLike}%`);
    }
    if (options?.author) {
      conditions.push("m.author_name LIKE ?");
      params.push(`%${options.author}%`);
    }
    if (options?.source) {
      conditions.push("m.source = ?");
      params.push(options.source);
    }
    if (options?.after) {
      conditions.push("m.sent_at >= ?");
      params.push(options.after);
    }
    if (options?.before) {
      conditions.push("m.sent_at <= ?");
      params.push(options.before);
    }

    let sql = Q.GET_MESSAGES;
    if (conditions.length > 0) {
      sql += " AND " + conditions.join(" AND ");
    }
    sql += ` ORDER BY m.sent_at ${options?.asc ? "ASC" : "DESC"} LIMIT ?`;
    params.push(limit);

    return this.db.query<MessageRow, (string | number)[]>(sql).all(...params);
  }

  getChannels(options?: {
    source?: string;
    search?: string;
  }): Array<{ source: string; channel_name: string; msg_count: number; last_message: number }> {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (options?.source) {
      conditions.push("source = ?");
      params.push(options.source);
    }
    if (options?.search) {
      conditions.push("channel_name LIKE ?");
      params.push(`%${options.search}%`);
    }

    let sql = Q.GET_CHANNELS;
    if (conditions.length > 0) {
      sql = sql.replace("WHERE 1=1", "WHERE 1=1 AND " + conditions.join(" AND "));
    }

    return this.db
      .query<{ source: string; channel_name: string; msg_count: number; last_message: number }, (string | number)[]>(sql)
      .all(...params);
  }

  insertEmbedding(messageId: number, embedding: Uint8Array): void {
    this.db.run(Q.INSERT_EMBEDDING, [messageId, embedding]);
  }

  getUnembeddedMessages(limit: number = 100): Array<{ id: number; content: string }> {
    return this.db
      .query<{ id: number; content: string }, [number]>(Q.GET_UNEMBEDDED_MESSAGES)
      .all(limit);
  }

  vectorSearch(
    embedding: Uint8Array,
    options?: {
      source?: string;
      channel?: string;
      after?: number;
      before?: number;
      limit?: number;
    }
  ): MessageRow[] {
    const k = options?.limit ?? 20;
    const conditions: string[] = [];
    const params: (Uint8Array | string | number)[] = [embedding, k];

    if (options?.source) {
      conditions.push("m.source = ?");
      params.push(options.source);
    }
    if (options?.channel) {
      conditions.push("m.channel_name = ?");
      params.push(options.channel);
    }
    if (options?.after) {
      conditions.push("m.sent_at > ?");
      params.push(options.after);
    }
    if (options?.before) {
      conditions.push("m.sent_at < ?");
      params.push(options.before);
    }

    let sql = Q.VECTOR_SEARCH;
    if (conditions.length > 0) {
      sql += " AND " + conditions.join(" AND ");
    }

    return this.db.query<MessageRow, (Uint8Array | string | number)[]>(sql).all(...params);
  }

  hybridSearch(
    query: string,
    embedding: Uint8Array,
    options?: {
      source?: string;
      channel?: string;
      after?: number;
      before?: number;
      limit?: number;
    }
  ): MessageRow[] {
    const limit = options?.limit ?? 20;
    const k = limit * 3; // oversample for RRF merging

    const ftsResults = this.searchMessages(query, { ...options, limit: k });
    const vecResults = this.vectorSearch(embedding, { ...options, limit: k });

    // Also search chunks
    const ftsChunkResults = this.searchChunks(query, { ...options, limit: k });
    const vecChunkResults = this.vectorSearchChunks(embedding, { ...options, limit: k });

    // Reciprocal Rank Fusion — use content hash as key to deduplicate chunks from same message
    const RRF_K = 60;
    const scores = new Map<string, { score: number; msg: MessageRow }>();

    const addResults = (results: MessageRow[]) => {
      results.forEach((msg, i) => {
        const rrf = 1.0 / (RRF_K + i + 1);
        // Use id + content prefix as key to keep distinct chunks separate
        const key = `${msg.id}:${msg.content.slice(0, 50)}`;
        const existing = scores.get(key);
        if (existing) {
          existing.score += rrf;
        } else {
          scores.set(key, { score: rrf, msg });
        }
      });
    };

    addResults(ftsResults);
    addResults(vecResults);
    addResults(ftsChunkResults);
    addResults(vecChunkResults);

    return [...scores.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.msg);
  }

  getEmbeddingStats(): EmbeddingStats {
    return this.db.query<EmbeddingStats, []>(Q.EMBEDDING_STATS).get()!;
  }

  deleteOrphanedEmbeddings(): number {
    return this.db.run(Q.DELETE_ORPHANED_EMBEDDINGS).changes;
  }

  deleteOrphanedChunkEmbeddings(): number {
    return this.db.run(Q.DELETE_ORPHANED_CHUNK_EMBEDDINGS).changes;
  }

  replaceChunks(messageId: number, chunks: Array<{ index: number; content: string; embeddingInput: string }>): void {
    // Delete old chunk embeddings first
    const oldChunkIds = this.db
      .query<{ id: number }, [number]>(Q.GET_MESSAGE_CHUNK_IDS)
      .all(messageId);
    for (const { id } of oldChunkIds) {
      this.db.run("DELETE FROM vec_chunks WHERE chunk_id = ?", [id]);
    }

    this.db.run(Q.REPLACE_CHUNKS_DELETE, [messageId]);
    for (const chunk of chunks) {
      this.db.run(Q.INSERT_CHUNK, [messageId, chunk.index, chunk.content, chunk.embeddingInput]);
    }
  }

  getUnembeddedChunks(limit: number = 100): Array<{ id: number; content: string }> {
    return this.db
      .query<{ id: number; content: string }, [number]>(Q.GET_UNEMBEDDED_CHUNKS)
      .all(limit);
  }

  insertChunkEmbedding(chunkId: number, embedding: Uint8Array): void {
    this.db.run(Q.INSERT_CHUNK_EMBEDDING, [chunkId, embedding]);
  }

  getChunkEmbeddingStats(): ChunkEmbeddingStats {
    return this.db.query<ChunkEmbeddingStats, []>(Q.CHUNK_EMBEDDING_STATS).get()!;
  }

  searchChunks(
    query: string,
    options?: {
      source?: string;
      channel?: string;
      after?: number;
      before?: number;
      limit?: number;
    }
  ): MessageRow[] {
    const limit = options?.limit ?? 20;
    const conditions: string[] = [];
    const params: (string | number)[] = [query];

    if (options?.source) {
      conditions.push("m.source = ?");
      params.push(options.source);
    }
    if (options?.channel) {
      conditions.push("m.channel_name = ?");
      params.push(options.channel);
    }
    if (options?.after) {
      conditions.push("m.sent_at > ?");
      params.push(options.after);
    }
    if (options?.before) {
      conditions.push("m.sent_at < ?");
      params.push(options.before);
    }

    let sql = Q.SEARCH_CHUNKS_FILTERED;
    if (conditions.length > 0) {
      sql += " AND " + conditions.join(" AND ");
    }
    sql += " ORDER BY rank LIMIT ?";
    params.push(limit);

    return this.db.query<MessageRow, (string | number)[]>(sql).all(...params);
  }

  vectorSearchChunks(
    embedding: Uint8Array,
    options?: {
      source?: string;
      channel?: string;
      after?: number;
      before?: number;
      limit?: number;
    }
  ): MessageRow[] {
    const k = options?.limit ?? 20;
    const conditions: string[] = [];
    const params: (Uint8Array | string | number)[] = [embedding, k];

    if (options?.source) {
      conditions.push("m.source = ?");
      params.push(options.source);
    }
    if (options?.channel) {
      conditions.push("m.channel_name = ?");
      params.push(options.channel);
    }
    if (options?.after) {
      conditions.push("m.sent_at > ?");
      params.push(options.after);
    }
    if (options?.before) {
      conditions.push("m.sent_at < ?");
      params.push(options.before);
    }

    let sql = Q.VECTOR_SEARCH_CHUNKS;
    if (conditions.length > 0) {
      sql += " AND " + conditions.join(" AND ");
    }

    return this.db.query<MessageRow, (Uint8Array | string | number)[]>(sql).all(...params);
  }

  close(): void {
    this.db.close();
  }
}
