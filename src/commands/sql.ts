import type { TraulDB } from "../db/database";

const ALLOWED_PREFIXES = ["SELECT", "PRAGMA", "WITH", "EXPLAIN"];
const FORBIDDEN_PATTERN = /;\s*\S/;

interface SqlOptions {
  write?: boolean;
}

export function runSql(db: TraulDB, query: string, options?: SqlOptions): Record<string, unknown>[] | { changes: number } {
  const trimmed = query.trim();
  const upper = trimmed.toUpperCase();

  if (!options?.write) {
    if (FORBIDDEN_PATTERN.test(trimmed)) {
      throw new Error("Read-only: multiple statements not allowed");
    }

    const allowed = ALLOWED_PREFIXES.some((p) => upper.startsWith(p));
    if (!allowed) {
      throw new Error(`Read-only: only SELECT, PRAGMA, WITH, and EXPLAIN queries are allowed`);
    }
  }

  const isRead = ALLOWED_PREFIXES.some((p) => upper.startsWith(p));
  if (isRead) {
    return db.db.prepare(trimmed).all() as Record<string, unknown>[];
  }

  const { changes } = db.db.prepare(trimmed).run();
  return { changes };
}

interface ColumnInfo {
  name: string;
  type: string;
  notnull: number;
  pk: number;
}

interface TableInfo {
  name: string;
  type: string;
  columns: ColumnInfo[];
}

export function runSchema(db: TraulDB): TableInfo[] {
  const tables = db.db
    .prepare(
      `SELECT name, type FROM sqlite_master
       WHERE (type = 'table' OR type = 'view')
         AND name NOT LIKE 'sqlite_%'
         AND name NOT LIKE '%_content'
         AND name NOT LIKE '%_idx'
         AND name NOT LIKE '%_data'
         AND name NOT LIKE '%_docsize'
         AND name NOT LIKE '%_config'
       UNION
       SELECT name, type FROM sqlite_master
       WHERE type = 'table' AND name LIKE '%_fts'
       ORDER BY name`
    )
    .all() as { name: string; type: string }[];

  return tables.map((t) => {
    let columns: ColumnInfo[] = [];
    try {
      columns = db.db.prepare(`PRAGMA table_info(${t.name})`).all() as ColumnInfo[];
    } catch {
      // Virtual tables may not support table_info
    }
    return { name: t.name, type: t.type, columns };
  });
}
