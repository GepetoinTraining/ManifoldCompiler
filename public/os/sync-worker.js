/**
 * sync-worker.js — Service Worker for IndexedDB ↔ Turso sync
 *
 * Runs in background. Syncs client IndexedDB with the kernel,
 * which in turn syncs with Turso cloud.
 *
 * Chain: IndexedDB (client) ↔ Kernel (localhost:3141) ↔ Turso (cloud)
 *
 * When online: push local changes to kernel, pull remote changes.
 * When offline: queue writes, serve from IndexedDB.
 *
 * (c) 2026 — ManifoldOS / PRIMOS
 */

const API = 'http://localhost:3141';
const SYNC_INTERVAL = 30000; // 30s
const QUEUE_STORE = 'sync_queue';

// ================================================================
// INSTALL + ACTIVATE
// ================================================================

self.addEventListener('install', (e) => {
  console.log('[sync-worker] installed');
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  console.log('[sync-worker] active');
  e.waitUntil(self.clients.claim());
  startSyncLoop();
});

// ================================================================
// SYNC LOOP — Periodic background sync
// ================================================================

let syncTimer = null;

function startSyncLoop() {
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = setInterval(() => doSync(), SYNC_INTERVAL);
  // Initial sync after 2s
  setTimeout(() => doSync(), 2000);
}

async function doSync() {
  try {
    // 1. Push queued writes to kernel
    await pushQueue();

    // 2. Tell kernel to sync with Turso
    await fetch(`${API}/api/status`); // heartbeat — kernel syncs on its own schedule

    // 3. Notify clients
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'sync-complete', ts: Date.now() });
    });
  } catch (e) {
    // Offline — queue persists, will retry next interval
    console.log('[sync-worker] offline, will retry');
  }
}

// ================================================================
// WRITE QUEUE — Store writes when offline, push when online
// ================================================================

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('manifoldos', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function enqueue(action) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    tx.objectStore(QUEUE_STORE).add({
      ...action,
      queued_at: Date.now(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function pushQueue() {
  const db = await openDB();
  const items = await new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readonly');
    const req = tx.objectStore(QUEUE_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = (e) => reject(e.target.error);
  });

  if (items.length === 0) return;

  let pushed = 0;
  for (const item of items) {
    try {
      const r = await fetch(`${API}${item.endpoint}`, {
        method: item.method || 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.body),
      });
      if (r.ok) {
        // Remove from queue
        const tx2 = db.transaction(QUEUE_STORE, 'readwrite');
        tx2.objectStore(QUEUE_STORE).delete(item.id);
        pushed++;
      }
    } catch (e) {
      // Still offline for this endpoint — leave in queue
      break;
    }
  }
  if (pushed > 0) {
    console.log(`[sync-worker] pushed ${pushed}/${items.length} queued writes`);
  }
}

// ================================================================
// MESSAGE HANDLER — Client can request sync or enqueue writes
// ================================================================

self.addEventListener('message', (e) => {
  const { type, payload } = e.data;

  if (type === 'sync-now') {
    doSync();
  }

  if (type === 'enqueue-write') {
    // Payload: { endpoint, method, body }
    enqueue(payload).then(() => {
      e.source.postMessage({ type: 'enqueue-ack', endpoint: payload.endpoint });
    });
  }

  if (type === 'queue-status') {
    openDB().then(db => {
      const tx = db.transaction(QUEUE_STORE, 'readonly');
      const req = tx.objectStore(QUEUE_STORE).count();
      req.onsuccess = () => {
        e.source.postMessage({ type: 'queue-count', count: req.result });
      };
    });
  }
});

// ================================================================
// FETCH INTERCEPT — Cache API responses for offline
// ================================================================

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Only intercept our API calls
  if (!url.pathname.startsWith('/api/')) return;

  // GET requests: try network, fall back to cache
  if (e.request.method === 'GET') {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          // Cache the response
          const clone = response.clone();
          caches.open('manifoldos-api').then(cache => {
            cache.put(e.request, clone);
          });
          return response;
        })
        .catch(() => {
          // Offline: serve from cache
          return caches.match(e.request).then(cached => {
            return cached || new Response(
              JSON.stringify({ O: null, R: null, error: 'offline' }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
  }

  // POST requests: try network, queue if offline
  if (e.request.method === 'POST') {
    e.respondWith(
      fetch(e.request.clone()).catch(async () => {
        // Offline: queue the write
        const body = await e.request.json();
        await enqueue({
          endpoint: url.pathname,
          method: 'POST',
          body,
        });
        return new Response(
          JSON.stringify({ O: { queued: true }, R: null }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
  }
});
