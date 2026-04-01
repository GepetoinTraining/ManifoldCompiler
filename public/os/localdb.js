/**
 * localdb.js — Client-side state persistence via IndexedDB
 *
 * Mirrors kernel state locally so the UI doesn't refetch on every frame.
 * Syncs on boot, then caches. Changes go to kernel AND local.
 *
 * Stores: spaces, scenes, objects, meeps, inbox, preferences
 *
 * (c) 2026 — ManifoldOS / PRIMOS
 */

const DB_NAME = 'manifoldos';
const DB_VERSION = 1;

const STORES = {
  spaces:      { keyPath: 'space_id' },
  scenes:      { keyPath: 'space_id' },
  objects:     { keyPath: 'id' },
  meeps:       { keyPath: 'id' },
  inbox:       { keyPath: 'id' },
  preferences: { keyPath: 'key' },
  cache:       { keyPath: 'key' },  // generic key-value for anything
};

let db = null;

function open() {
  if (db) return Promise.resolve(db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      for (const [name, opts] of Object.entries(STORES)) {
        if (!d.objectStoreNames.contains(name)) {
          d.createObjectStore(name, opts);
        }
      }
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

// ================================================================
// GENERIC OPS
// ================================================================

async function put(store, data) {
  const d = await open();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(store, 'readwrite');
    tx.objectStore(store).put(data);
    tx.oncomplete = () => resolve(data);
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function get(store, key) {
  const d = await open();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function getAll(store) {
  const d = await open();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function del(store, key) {
  const d = await open();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function clear(store) {
  const d = await open();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(store, 'readwrite');
    tx.objectStore(store).clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
}

// ================================================================
// SYNC — Pull from kernel, cache locally
// ================================================================

async function syncSpaces(apiBase, uuid) {
  try {
    const r = await fetch(`${apiBase}/api/space/list?uuid=${uuid}`);
    const d = await r.json();
    const spaces = d.O || [];
    await clear('spaces');
    for (const s of spaces) await put('spaces', s);
    await put('cache', { key: 'spaces_synced', ts: Date.now() });
    return spaces;
  } catch (e) {
    // Offline — serve from cache
    return await getAll('spaces');
  }
}

async function syncScene(apiBase, uuid, spaceId, resolution) {
  try {
    const r = await fetch(`${apiBase}/api/space/scene?uuid=${uuid}&space_id=${spaceId}&resolution=${resolution || 16}`);
    const d = await r.json();
    const scene = d.O;
    if (scene) {
      await put('scenes', { ...scene, space_id: spaceId });
      // Also cache individual objects
      if (scene.objects) {
        for (const obj of scene.objects) {
          await put('objects', obj);
        }
      }
      await put('cache', { key: `scene_${spaceId}_synced`, ts: Date.now() });
    }
    return scene;
  } catch (e) {
    // Offline — serve from cache
    return await get('scenes', spaceId);
  }
}

async function syncStatus(apiBase) {
  try {
    const r = await fetch(`${apiBase}/api/status`);
    const d = await r.json();
    const status = d.O;
    if (status) await put('cache', { key: 'status', ...status, ts: Date.now() });
    return status;
  } catch (e) {
    return await get('cache', 'status');
  }
}

// ================================================================
// PREFERENCES — UI state that persists across sessions
// ================================================================

async function getPref(key, defaultValue) {
  const row = await get('preferences', key);
  return row ? row.value : defaultValue;
}

async function setPref(key, value) {
  return put('preferences', { key, value });
}

// ================================================================
// CACHE AGE — How stale is the data?
// ================================================================

async function cacheAge(key) {
  const row = await get('cache', key);
  if (!row || !row.ts) return Infinity;
  return Date.now() - row.ts;
}

async function isFresh(key, maxAgeMs) {
  return (await cacheAge(key)) < (maxAgeMs || 30000); // default 30s
}

// ================================================================
// EXPORT
// ================================================================

export {
  open, put, get, getAll, del, clear,
  syncSpaces, syncScene, syncStatus,
  getPref, setPref,
  cacheAge, isFresh,
  DB_NAME, DB_VERSION,
};
