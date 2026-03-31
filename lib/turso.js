/**
 * turso.js — Server-side Turso client for API routes
 *
 * The ONLY connection between ManifoldCompiler and persistent state.
 * No kernel. No proxy. No localhost. Just the cloud DB.
 *
 * (c) 2026 — Manifold Matrices / PRIMOS
 */

import { createClient } from '@libsql/client';

let _client = null;

function getClient() {
  if (!_client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || !authToken) {
      throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set');
    }
    _client = createClient({ url, authToken });
  }
  return _client;
}

/**
 * Run a SELECT query. Returns array of row objects.
 */
export async function tursoQuery(sql, args = []) {
  const client = getClient();
  const result = await client.execute({ sql, args });
  return result.rows;
}

/**
 * Run an INSERT/UPDATE/DELETE. Returns { rowsAffected }.
 */
export async function tursoExecute(sql, args = []) {
  const client = getClient();
  const result = await client.execute({ sql, args });
  return { rowsAffected: result.rowsAffected };
}

/**
 * Register a user in Turso. Writes to humans_cloud.
 */
export async function registerUser(uuid, name, email, profession) {
  const now = new Date().toISOString();
  await tursoExecute(
    `INSERT OR REPLACE INTO humans_cloud (uuid, name, email, profession, created, last_seen)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [uuid, name, email || null, profession || null, now, now]
  );
  return uuid;
}

/**
 * Look up a user by uuid. Reads humans_server first (enriched), falls back to humans_cloud.
 */
export async function lookupUser(uuid) {
  // Server-enriched version first
  let rows = await tursoQuery(
    'SELECT uuid, name, email, profession FROM humans_server WHERE uuid = ?',
    [uuid]
  );
  if (rows.length > 0) return rows[0];
  // Fall back to cloud (user-written)
  rows = await tursoQuery(
    'SELECT uuid, name, email, profession FROM humans_cloud WHERE uuid = ?',
    [uuid]
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Look up a user by email. Same server-first, cloud-fallback pattern.
 */
export async function lookupByEmail(email) {
  let rows = await tursoQuery(
    'SELECT uuid, name, email, profession FROM humans_server WHERE email = ?',
    [email]
  );
  if (rows.length > 0) return rows[0];
  rows = await tursoQuery(
    'SELECT uuid, name, email, profession FROM humans_cloud WHERE email = ?',
    [email]
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Write sync entries (from client Klein bottle → Turso).
 */
export async function pushEntries(uuid, entries) {
  await tursoExecute(`CREATE TABLE IF NOT EXISTS surface (
    tick INTEGER, uuid TEXT, u REAL, v REAL, content TEXT,
    weight INTEGER, origin TEXT, sig TEXT, ts INTEGER, synced INTEGER,
    PRIMARY KEY (tick, uuid))`);

  let count = 0;
  for (const entry of entries) {
    await tursoExecute(
      `INSERT OR REPLACE INTO surface (tick, uuid, u, v, content, weight, origin, sig, ts, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [entry.tick, uuid, entry.u, entry.v,
       typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content),
       entry.weight, entry.origin || 'user', entry.sig, entry.ts]
    );
    count++;
  }
  return count;
}

/**
 * Pull enrichments from Turso (server wrote these with origin='torus').
 */
export async function pullEnrichments(uuid, sinceTick = 0) {
  const rows = await tursoQuery(
    `SELECT * FROM surface WHERE uuid = ? AND origin = 'torus' AND tick > ? ORDER BY tick`,
    [uuid, sinceTick]
  );
  return rows;
}
