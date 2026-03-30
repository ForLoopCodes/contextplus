// SQLite vector storage with namespaces hashes and metadata for retrieval
// FEATURE: Shared vector database layer for search and memory embeddings

import { mkdir, rm } from "fs/promises";
import { join } from "path";
import { DatabaseSync } from "node:sqlite";

export interface VectorRecord {
  key: string;
  hash: string;
  vector: number[];
  metadata: Record<string, string>;
  updatedAt: number;
}

export interface VectorUpsertInput {
  key: string;
  hash: string;
  vector: number[];
  metadata?: Record<string, string>;
}

const CONTEXTPLUS_DIR = ".contextplus";
const EMBEDDINGS_DIR = "embeddings";
const VECTOR_DB_FILE = "vectors.db";

function parseMetadata(value: string | null): Record<string, string> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, string>;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
  }
  return {};
}

function parseVector(value: string): number[] {
  try {
    const parsed = JSON.parse(value) as number[];
    if (Array.isArray(parsed)) return parsed;
  } catch {
  }
  return [];
}

function ensureSchema(db: DatabaseSync): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS vectors (" +
    "namespace TEXT NOT NULL, " +
    "key TEXT NOT NULL, " +
    "hash TEXT NOT NULL, " +
    "vector TEXT NOT NULL, " +
    "metadata TEXT NOT NULL DEFAULT '{}', " +
    "updated_at INTEGER NOT NULL, " +
    "PRIMARY KEY(namespace, key))",
  );
  db.exec("CREATE INDEX IF NOT EXISTS idx_vectors_namespace_updated ON vectors(namespace, updated_at DESC)");
}

async function getDbPath(rootDir: string): Promise<string> {
  const embeddingsPath = join(rootDir, CONTEXTPLUS_DIR, EMBEDDINGS_DIR);
  await mkdir(embeddingsPath, { recursive: true });
  return join(embeddingsPath, VECTOR_DB_FILE);
}

function runTransaction<T>(db: DatabaseSync, runner: () => T): T {
  db.exec("BEGIN");
  try {
    const result = runner();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export async function getVectorDb(rootDir: string): Promise<DatabaseSync> {
  const db = new DatabaseSync(await getDbPath(rootDir));
  ensureSchema(db);
  return db;
}

async function withDb<T>(rootDir: string, runner: (db: DatabaseSync) => T): Promise<T> {
  const db = await getVectorDb(rootDir);
  try {
    return runner(db);
  } finally {
    try {
      db.close();
    } catch {
    }
  }
}

export function closeVectorDb(_rootDir: string): void {
}

export function closeAllVectorDbs(): void {
}

export async function resetVectorDb(rootDir: string): Promise<void> {
  await rm(await getDbPath(rootDir), { force: true });
}

export async function listVectorKeys(rootDir: string, namespace: string): Promise<string[]> {
  return withDb(rootDir, (db) => {
    const rows = db.prepare("SELECT key FROM vectors WHERE namespace = ?").all(namespace) as Array<{ key: string }>;
    return rows.map((row) => row.key);
  });
}

export async function upsertVectors(
  rootDir: string,
  namespace: string,
  vectors: VectorUpsertInput[],
): Promise<void> {
  if (vectors.length === 0) return;

  await withDb(rootDir, (db) => {
    const now = Date.now();
    const statement = db.prepare(
      "INSERT INTO vectors(namespace, key, hash, vector, metadata, updated_at) " +
      "VALUES (?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(namespace, key) DO UPDATE SET " +
      "hash=excluded.hash, vector=excluded.vector, metadata=excluded.metadata, updated_at=excluded.updated_at",
    );

    runTransaction(db, () => {
      for (const vector of vectors) {
        statement.run(
          namespace,
          vector.key,
          vector.hash,
          JSON.stringify(vector.vector),
          JSON.stringify(vector.metadata ?? {}),
          now,
        );
      }
    });
  });
}

export async function deleteVectors(rootDir: string, namespace: string, keys: string[]): Promise<number> {
  if (keys.length === 0) return 0;

  return withDb(rootDir, (db) => {
    const statement = db.prepare("DELETE FROM vectors WHERE namespace = ? AND key = ?");
    return runTransaction(db, () => {
      let deleted = 0;
      for (const key of keys) {
        const result = statement.run(namespace, key) as { changes?: number };
        deleted += result.changes ?? 0;
      }
      return deleted;
    });
  });
}

export async function upsertVector(
  rootDir: string,
  namespace: string,
  key: string,
  hash: string,
  vector: number[],
  metadata: Record<string, string> = {},
): Promise<void> {
  await upsertVectors(rootDir, namespace, [{ key, hash, vector, metadata }]);
}

export async function getVector(rootDir: string, namespace: string, key: string): Promise<VectorRecord | null> {
  return withDb(rootDir, (db) => {
    const row = db.prepare(
      "SELECT key, hash, vector, metadata, updated_at FROM vectors WHERE namespace = ? AND key = ?",
    ).get(namespace, key) as {
      key: string;
      hash: string;
      vector: string;
      metadata: string | null;
      updated_at: number;
    } | undefined;
    if (!row) return null;
    return {
      key: row.key,
      hash: row.hash,
      vector: parseVector(row.vector),
      metadata: parseMetadata(row.metadata),
      updatedAt: row.updated_at,
    };
  });
}

export async function listVectors(rootDir: string, namespace: string): Promise<VectorRecord[]> {
  return withDb(rootDir, (db) => {
    const rows = db.prepare(
      "SELECT key, hash, vector, metadata, updated_at FROM vectors WHERE namespace = ? ORDER BY updated_at DESC",
    ).all(namespace) as Array<{
      key: string;
      hash: string;
      vector: string;
      metadata: string | null;
      updated_at: number;
    }>;
    return rows.map((row) => ({
      key: row.key,
      hash: row.hash,
      vector: parseVector(row.vector),
      metadata: parseMetadata(row.metadata),
      updatedAt: row.updated_at,
    }));
  });
}

export async function deleteVector(rootDir: string, namespace: string, key: string): Promise<void> {
  await deleteVectors(rootDir, namespace, [key]);
}

export async function deleteNamespace(rootDir: string, namespace: string): Promise<number> {
  return withDb(rootDir, (db) => {
    const result = db.prepare("DELETE FROM vectors WHERE namespace = ?").run(namespace) as { changes?: number };
    return result.changes ?? 0;
  });
}
