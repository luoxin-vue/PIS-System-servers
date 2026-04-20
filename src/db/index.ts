import { createClient, type Client, type ResultSet } from '@libsql/client';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let client: Client | null = null;

function resolveDatabaseUrl(): string {
  const envUrl = process.env.TURSO_DATABASE_URL?.trim();
  if (envUrl) return envUrl;
  const dataDir = join(__dirname, '..', '..', 'data');
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  const dbPath = process.env.DB_PATH || join(dataDir, 'inventory.db');
  return pathToFileURL(dbPath).href;
}

export function getClient(): Client {
  if (!client) {
    const url = resolveDatabaseUrl();
    const authToken = process.env.TURSO_AUTH_TOKEN?.trim() || undefined;
    if (url.startsWith('libsql://') && !authToken) {
      console.warn('TURSO_AUTH_TOKEN is not set; Turso requests will fail.');
    }
    client = createClient({ url, authToken });
  }
  return client;
}

export async function initDb(): Promise<void> {
  const schemaPath = join(__dirname, 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  const c = getClient();
  await c.execute('PRAGMA foreign_keys = ON');
  await c.executeMultiple(schema);
}

export function row0<T extends Record<string, unknown>>(rs: ResultSet): T | undefined {
  if (rs.rows.length === 0) return undefined;
  return rs.rows[0] as unknown as T;
}

export function rowsAll<T extends Record<string, unknown>>(rs: ResultSet): T[] {
  return rs.rows as unknown as T[];
}

export function insertId(rs: ResultSet): number {
  const id = rs.lastInsertRowid;
  if (id === undefined) return 0;
  return Number(id);
}
