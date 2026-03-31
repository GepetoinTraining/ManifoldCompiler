/**
 * klein.js — Client-Side Klein Bottle Cache
 *
 * The bridge between a static humans row and the living tori.
 * Derived from topology-auth cert. 3 circles, 1 twist, no inside/outside.
 *
 * 6 layers (user-facing):
 *   2  — who they are (identity)
 *   3  — what they do (profession)
 *   5  — their agenda (time, deadlines)
 *   7  — how they see things (POV)
 *   11 — biases, opinions (how they think about what they see)
 *   13 — index (same as server torus)
 *
 * Columns: primes 2–29 (c2, c3, c5, c7, c11, c13, c17, c19, c23, c29)
 * Row 1: header (what each column means in this layer)
 * Row 2+: data (JSON cells: {word, weight, tick, context})
 *
 * (c) 2026 — Manifold Matrices / PRIMOS
 */

import { PHI } from './gate';

// ================================================================
// §0 — CONSTANTS
// ================================================================

const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29];
const LAYERS = [2, 3, 5, 7, 11, 13];

const DB_NAME = 'klein_bottle';
const DB_VERSION = 1;

// ================================================================
// §1 — CERT → GEOMETRY
// ================================================================

/**
 * From cert zeta, compute the Klein bottle geometry.
 * eigenvalues of M = [[phi, zeta], [zeta, phi]] are phi+zeta and phi-zeta.
 * These become the hypersphere radii.
 */
export function certToGeometry(cert) {
  const zeta = cert.zeta;
  const lambda_plus = PHI + zeta;   // R_hyper (outer)
  const lambda_minus = PHI - zeta;  // r_hyper (inner)

  // 3 points inside hypersphere, seeded from cert
  const points = generatePoints(cert.seed, lambda_plus);

  // Centroid
  const centroid = {
    x: (points[0].x + points[1].x + points[2].x) / 3,
    y: (points[0].y + points[1].y + points[2].y) / 3,
    z: (points[0].z + points[1].z + points[2].z) / 3,
  };

  // Distances
  const distFromCentroid = points.map(p =>
    Math.sqrt((p.x - centroid.x) ** 2 + (p.y - centroid.y) ** 2 + (p.z - centroid.z) ** 2)
  );
  const distFromWall = points.map(p =>
    lambda_plus - Math.sqrt(p.x ** 2 + p.y ** 2 + p.z ** 2)
  );

  const d_inner = Math.min(...distFromCentroid);
  const d_outer = Math.min(...distFromWall);

  // Three circle radii
  const radii = [d_inner, (d_inner + d_outer) / 2, lambda_plus - d_outer].sort((a, b) => a - b);

  return {
    R_hyper: lambda_plus,
    r_hyper: lambda_minus,
    r_small: radii[0],  // ↔ 5 (time/agenda)
    r_mid: radii[1],    // ↔ 3 (space/profession) — THE TWISTED ONE
    r_big: radii[2],    // ↔ 2 (identity)
    points,
    centroid,
  };
}

/**
 * Seeded RNG from cert seed string.
 * Deterministic: same seed → same sequence.
 */
function seededRandom(seed, index) {
  let h = 0;
  const s = seed + ':' + index;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  // Normalize to [0, 1)
  return ((h & 0x7fffffff) % 10000) / 10000;
}

function generatePoints(seed, R) {
  const pts = [];
  for (let i = 0; i < 3; i++) {
    const r = R * Math.cbrt(seededRandom(seed, i * 3));
    const theta = 2 * Math.PI * seededRandom(seed, i * 3 + 1);
    const phi = Math.acos(2 * seededRandom(seed, i * 3 + 2) - 1);
    pts.push({
      x: r * Math.sin(phi) * Math.cos(theta),
      y: r * Math.sin(phi) * Math.sin(theta),
      z: r * Math.cos(phi),
    });
  }
  return pts;
}

// ================================================================
// §2 — KLEIN BOTTLE SURFACE
// ================================================================

/**
 * Klein bottle parametric surface (figure-8 immersion).
 * circle_3 (space/profession) carries the half-twist.
 *
 * u ∈ [0, 2π) — traverses circle_2 (identity)
 * v ∈ [0, 2π) — traverses circle_3 (space, TWISTED)
 */
export function kleinSurface(u, v, geometry) {
  const a = geometry.r_big;    // circle_2
  const b = geometry.r_mid;    // circle_3 (twisted)
  const c = geometry.r_small;  // circle_5

  const halfV = v / 2;
  const sinU = Math.sin(u);
  const sin2U = Math.sin(2 * u);
  const cosHV = Math.cos(halfV);
  const sinHV = Math.sin(halfV);

  const r = a + b * cosHV * sinU - b * sinHV * sin2U;

  return {
    x: r * Math.cos(v),
    y: r * Math.sin(v),
    z: c * (-sinHV * sinU + cosHV * sin2U),
  };
}

/**
 * Map a TPB entry to (u, v) on the Klein bottle.
 */
export function entryToUV(content, tick, capacity) {
  // u from content hash → position on identity circle
  let h = 0;
  const s = typeof content === 'string' ? content : JSON.stringify(content);
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  const u = ((h & 0x7fffffff) % 36000) / 36000 * 2 * Math.PI;

  // v from tick → sequential position on space circle
  const v = (tick % capacity) / capacity * 2 * Math.PI;

  return { u, v };
}

// ================================================================
// §3 — TRAJECTORY SIGNING (from topology-auth)
// ================================================================

function createMatrix(zeta) {
  return [[PHI, zeta], [zeta, PHI]];
}

function matMul(a, b) {
  return [
    [a[0][0] * b[0][0] + a[0][1] * b[1][0], a[0][0] * b[0][1] + a[0][1] * b[1][1]],
    [a[1][0] * b[0][0] + a[1][1] * b[1][0], a[1][0] * b[0][1] + a[1][1] * b[1][1]],
  ];
}

function matPow(m, n) {
  if (n === 0) return [[1, 0], [0, 1]];
  if (n === 1) return m;
  if (n % 2 === 0) { const half = matPow(m, n / 2); return matMul(half, half); }
  return matMul(m, matPow(m, n - 1));
}

/**
 * Compute trajectory signature at tick n.
 * This IS the cert signature. M^n fingerprint.
 */
export function trajectorySign(zeta, n) {
  const M = createMatrix(zeta);
  const powered = matPow(M, Math.max(1, n));
  const trace = powered[0][0] + powered[1][1];
  const det = powered[0][0] * powered[1][1] - powered[0][1] * powered[1][0];
  const eigPlus = powered[0][0] + powered[0][1];
  const eigMinus = powered[0][0] - powered[0][1];
  return `${eigPlus.toFixed(10)}:${eigMinus.toFixed(10)}:${trace.toFixed(10)}:${det.toFixed(10)}`;
}

// ================================================================
// §4 — LOCAL CACHE (IndexedDB)
// ================================================================

/**
 * Open the Klein bottle database.
 */
export function openKleinDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      // TPB entries on the surface
      if (!db.objectStoreNames.contains('surface')) {
        const surface = db.createObjectStore('surface', { keyPath: 'tick' });
        surface.createIndex('u', 'u');
        surface.createIndex('v', 'v');
        surface.createIndex('weight', 'weight');
        surface.createIndex('ts', 'ts');
        surface.createIndex('synced', 'synced');
        surface.createIndex('origin', 'origin');
      }

      // Cert + geometry
      if (!db.objectStoreNames.contains('cert')) {
        db.createObjectStore('cert', { keyPath: 'key' });
      }

      // Prime grid tables (layers 2,3,5,7,11,13)
      // Each layer is a store. Row 1 = header. Columns = c2..c29.
      for (const layer of LAYERS) {
        const name = `layer_${layer}`;
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'row' });
        }
      }
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

// ================================================================
// §5 — LAYER HEADERS (row 1 of each prime table)
// ================================================================

const LAYER_HEADERS = {
  // Layer 2: who they are
  2: {
    c2: 'name', c3: 'origin', c5: 'born', c7: 'self-image',
    c11: 'core belief', c13: 'shadow', c17: 'aspiration',
    c19: 'imagination', c23: 'agency', c29: 'faith',
  },
  // Layer 3: what they do
  3: {
    c2: 'role', c3: 'domain', c5: 'tenure', c7: 'method',
    c11: 'specialty', c13: 'gap', c17: 'freedom',
    c19: 'side project', c23: 'impact', c29: 'calling',
  },
  // Layer 5: agenda, time, deadlines
  5: {
    c2: 'current task', c3: 'workspace', c5: 'deadline', c7: 'priority shift',
    c11: 'time quality', c13: 'overdue', c17: 'optional',
    c19: 'someday', c23: 'commitment', c29: 'patience',
  },
  // Layer 7: how they see things
  7: {
    c2: 'lens', c3: 'frame', c5: 'tempo', c7: 'perspective',
    c11: 'filter', c13: 'blind spot', c17: 'curiosity',
    c19: 'vision', c23: 'judgment', c29: 'intuition',
  },
  // Layer 11: biases, opinions
  11: {
    c2: 'preference', c3: 'comfort zone', c5: 'rhythm', c7: 'stance',
    c11: 'conviction', c13: 'aversion', c17: 'openness',
    c19: 'hypothesis', c23: 'taste', c29: 'trust',
  },
  // Layer 13: index (same as server)
  13: {
    c2: 'entry', c3: 'location', c5: 'timestamp', c7: 'transform',
    c11: 'quality', c13: 'reference', c17: 'link',
    c19: 'imagined', c23: 'authored', c29: 'prayer',
  },
};

/**
 * Initialize headers for all layers (row 1).
 */
export async function initHeaders(db) {
  for (const layer of LAYERS) {
    const tx = db.transaction(`layer_${layer}`, 'readwrite');
    const store = tx.objectStore(`layer_${layer}`);
    const existing = await idbGet(store, 1);
    if (!existing) {
      store.put({ row: 1, ...LAYER_HEADERS[layer] });
    }
    await tx.done;
  }
}

// ================================================================
// §6 — TPB ENTRY CREATION
// ================================================================

/**
 * Create a signed TPB entry on the Klein bottle surface.
 *
 * origin distinguishes voice:
 *   'user'    — human typed this
 *   'synapse' — user's AI responded
 *   'team'    — another member's Klein bottle (via team chat)
 *   'torus'   — server pipeline enrichment (intrusive thought)
 */
export function createEntry(content, tick, zeta, capacity, origin = 'user') {
  const { u, v } = entryToUV(content, tick, capacity);

  // Weight is purely accumulative. No fold, no prime locking.
  // Just tick + 1. The server does the structural work.
  return {
    tick,
    u,
    v,
    content,
    weight: tick + 1,
    origin,
    sig: trajectorySign(zeta, tick),
    ts: Date.now(),
    synced: 0,  // 0 = not synced to Turso, 1 = synced
  };
}

/**
 * Write entry to IndexedDB.
 */
export async function writeEntry(db, entry) {
  const tx = db.transaction('surface', 'readwrite');
  tx.objectStore('surface').put(entry);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(entry);
    tx.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Get all unsynced entries (for Turso batch).
 */
export async function getUnsynced(db) {
  const tx = db.transaction('surface', 'readonly');
  const index = tx.objectStore('surface').index('synced');
  const req = index.getAll(0);
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Mark entries as synced.
 */
export async function markSynced(db, ticks) {
  const tx = db.transaction('surface', 'readwrite');
  const store = tx.objectStore('surface');
  for (const tick of ticks) {
    const entry = await idbGet(store, tick);
    if (entry) {
      entry.synced = 1;
      store.put(entry);
    }
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

// ================================================================
// §7 — CERT STORAGE
// ================================================================

/**
 * Store cert + computed geometry.
 */
export async function storeCert(db, cert) {
  const geometry = certToGeometry(cert);
  const tx = db.transaction('cert', 'readwrite');
  tx.objectStore('cert').put({
    key: 'active',
    ...cert,
    geometry,
  });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(geometry);
    tx.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Load active cert + geometry.
 */
export async function loadCert(db) {
  const tx = db.transaction('cert', 'readonly');
  const req = tx.objectStore('cert').get('active');
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = (e) => reject(e.target.error);
  });
}

// ================================================================
// §8 — LAYER READ/WRITE
// ================================================================

/**
 * Write a cell to a layer table.
 * layer: 2|3|5|7|11|13
 * row: integer (2+ for data, 1 is header)
 * col: 'c2'|'c3'|...|'c29'
 * value: any (will be JSON stringified)
 */
export async function writeCell(db, layer, row, col, value) {
  const storeName = `layer_${layer}`;
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  const existing = await idbGet(store, row) || { row };
  existing[col] = typeof value === 'string' ? value : JSON.stringify(value);
  store.put(existing);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Read a full row from a layer.
 */
export async function readRow(db, layer, row) {
  const tx = db.transaction(`layer_${layer}`, 'readonly');
  const req = tx.objectStore(`layer_${layer}`).get(row);
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Read all rows from a layer.
 */
export async function readLayer(db, layer) {
  const tx = db.transaction(`layer_${layer}`, 'readonly');
  const req = tx.objectStore(`layer_${layer}`).getAll();
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = (e) => reject(e.target.error);
  });
}

// ================================================================
// HELPERS
// ================================================================

function idbGet(store, key) {
  const req = store.get(key);
  return new Promise((resolve) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

export { PRIMES, LAYERS, LAYER_HEADERS };
