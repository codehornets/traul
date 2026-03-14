export const UPSERT_MESSAGE = `
  INSERT INTO messages (source, source_id, channel_id, channel_name, thread_id, author_id, author_name, content, sent_at, metadata)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(source, source_id) DO UPDATE SET
    content = excluded.content,
    metadata = excluded.metadata,
    updated_at = unixepoch()
`;

export const UPSERT_CONTACT = `
  INSERT INTO contacts (display_name)
  VALUES (?)
  ON CONFLICT(display_name) DO UPDATE SET
    updated_at = unixepoch()
  RETURNING id
`;

export const UPSERT_CONTACT_IDENTITY = `
  INSERT INTO contact_identities (contact_id, source, source_user_id, username, display_name)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(source, source_user_id) DO UPDATE SET
    username = excluded.username,
    display_name = excluded.display_name
`;

export const GET_CONTACT_BY_SOURCE_ID = `
  SELECT c.id, c.display_name
  FROM contacts c
  JOIN contact_identities ci ON ci.contact_id = c.id
  WHERE ci.source = ? AND ci.source_user_id = ?
`;

export const GET_SYNC_CURSOR = `
  SELECT cursor_value FROM sync_cursors WHERE source = ? AND key = ?
`;

export const SET_SYNC_CURSOR = `
  INSERT INTO sync_cursors (source, key, cursor_value)
  VALUES (?, ?, ?)
  ON CONFLICT(source, key) DO UPDATE SET
    cursor_value = excluded.cursor_value,
    updated_at = unixepoch()
`;

export const SEARCH_MESSAGES = `
  SELECT m.id, m.source, m.source_id, m.channel_name, m.thread_id,
         m.author_name, m.content, m.sent_at, m.metadata,
         bm25(messages_fts) AS rank
  FROM messages_fts
  JOIN messages m ON messages_fts.rowid = m.id
  WHERE messages_fts MATCH ?
  ORDER BY rank
`;

export const SEARCH_MESSAGES_FILTERED = `
  SELECT m.id, m.source, m.source_id, m.channel_name, m.thread_id,
         m.author_name, m.content, m.sent_at, m.metadata,
         bm25(messages_fts) AS rank
  FROM messages_fts
  JOIN messages m ON messages_fts.rowid = m.id
  WHERE messages_fts MATCH ?
`;

export const GET_SIGNAL_DEFINITIONS = `
  SELECT id, name, description, query, severity_expression, enabled
  FROM signal_definitions
  WHERE enabled = 1
`;

export const INSERT_SIGNAL_RESULT = `
  INSERT INTO signal_results (definition_id, message_id, severity, title, detail)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(definition_id, message_id) DO UPDATE SET
    severity = excluded.severity,
    detail = excluded.detail,
    updated_at = unixepoch()
`;

export const GET_SIGNAL_RESULTS = `
  SELECT sr.id, sr.severity, sr.title, sr.detail, sr.created_at,
         sd.name AS signal_name,
         m.channel_name, m.author_name, m.content, m.sent_at
  FROM signal_results sr
  JOIN signal_definitions sd ON sd.id = sr.definition_id
  LEFT JOIN messages m ON m.id = sr.message_id
  WHERE sr.dismissed_at IS NULL
  ORDER BY
    CASE sr.severity WHEN 'urgent' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
    sr.created_at DESC
`;

export const DISMISS_SIGNAL = `
  UPDATE signal_results SET dismissed_at = unixepoch() WHERE id = ?
`;

export const GET_STATS = `
  SELECT
    (SELECT COUNT(*) FROM messages) AS total_messages,
    (SELECT COUNT(DISTINCT channel_name) FROM messages) AS total_channels,
    (SELECT COUNT(*) FROM contacts) AS total_contacts,
    (SELECT COUNT(*) FROM signal_results WHERE dismissed_at IS NULL) AS active_signals
`;

export const GET_MESSAGE_VOLUME = `
  SELECT date(sent_at, 'unixepoch') AS day, COUNT(*) AS count
  FROM messages
  WHERE sent_at > unixepoch() - (86400 * ?)
  GROUP BY day
  ORDER BY day DESC
`;

export const GET_MESSAGES = `
  SELECT m.id, m.source, m.source_id, m.channel_name, m.thread_id,
         m.author_name, m.content, m.sent_at, m.metadata
  FROM messages m
  WHERE 1=1
`;

export const HAS_MESSAGE = `
  SELECT 1 FROM messages WHERE source = ? AND source_id = ? LIMIT 1
`;

export const INSERT_EMBEDDING = `
  INSERT INTO vec_messages(message_id, embedding)
  VALUES (?, ?)
`;

export const GET_UNEMBEDDED_MESSAGES = `
  SELECT m.id, m.content
  FROM messages m
  LEFT JOIN vec_messages v ON v.message_id = m.id
  WHERE v.message_id IS NULL AND m.content != ''
  ORDER BY m.id
  LIMIT ?
`;

export const VECTOR_SEARCH = `
  SELECT m.id, m.source, m.source_id, m.channel_name, m.thread_id,
         m.author_name, m.content, m.sent_at, m.metadata,
         v.distance
  FROM vec_messages v
  JOIN messages m ON m.id = v.message_id
  WHERE v.embedding MATCH ? AND k = ?
`;

export const EMBEDDING_STATS = `
  SELECT
    (SELECT COUNT(*) FROM messages) AS total_messages,
    (SELECT COUNT(*) FROM vec_messages) AS embedded_messages
`;

export const GET_CHANNELS = `
  SELECT source, channel_name,
         COUNT(*) AS msg_count,
         MAX(sent_at) AS last_message
  FROM messages
  WHERE 1=1
  GROUP BY source, channel_name
  ORDER BY last_message DESC
`;
