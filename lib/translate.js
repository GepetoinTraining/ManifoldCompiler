/**
 * translate.js — Client-Side σ⁻¹ Operator
 *
 * Maps language → topology. Pure math. No LLM.
 * Same lexicons as the server's translate.py.
 *
 * Every chat message gets decomposed here before anything else.
 * Words are classified, addressed, stored on the Klein bottle.
 * The accumulated surface IS the context.
 *
 * (c) 2026 — Manifold Matrices / PRIMOS
 */

import { openKleinDB, createEntry, writeEntry, loadCert, writeCell, readRow } from './klein';

// ================================================================
// CATEGORY LEXICONS — same as server translate.py
// ================================================================

const LAYER_WORDS = {
  2: new Set([  // Verbs / action
    "is","are","was","were","be","been","being",
    "do","does","did","done",
    "has","have","had","having",
    "will","can","could","should","would","may","might","must",
    "shall","need",
    "run","make","get","take","give","build","create","remove",
    "add","set","put","go","come","see","know","think","say",
    "use","find","tell","ask","work","call","try","leave",
    "keep","let","begin","show","hear","play","move","live",
    "believe","hold","bring","happen","write","read","learn",
    "grow","turn","start","stop","open","close","change",
    "follow","watch","remember","understand","compute","encode",
    "decode","derive","solve","prove","verify","check",
  ]),
  3: new Set([  // Spatial / setting
    "in","on","at","from","to","into","onto","through",
    "between","above","below","inside","outside","within",
    "beyond","across","along","around","behind","beside",
    "where","here","there","everywhere","nowhere",
    "space","place","position","location","point","center",
    "surface","layer","skin","boundary","edge","field",
    "up","down","left","right","near","far","north","south",
    "room","world","home","ground","top","bottom","side",
  ]),
  5: new Set([  // Temporal / modal
    "when","then","now","before","after","during","while",
    "until","since","once","already","yet","still","soon",
    "if","unless","whether","else",
    "time","moment","cycle","tick","clock","phase","epoch",
    "always","never","sometimes","often","rarely",
    "frequency","period","duration","interval","delay",
    "today","tomorrow","yesterday","morning","night",
    "early","late","first","last","next","previous",
  ]),
  7: new Set([  // Entity / POV
    "i","you","he","she","it","we","they",
    "me","him","her","us","them",
    "my","your","his","its","our","their",
    "who","what","which","whom","whose",
    "the","a","an","this","that","these","those",
    "each","every","all","some","any","no","many","few",
    "self","soul","identity","name","person","human",
    "prime","number","torus","manifold","lattice","system",
    "student","teacher","conductor","observer",
  ]),
};

const RES = 36000;

// ================================================================
// CLASSIFY
// ================================================================

function clean(w) {
  return w.toLowerCase().replace(/[.,;:!?"'()\[\]{}—\-–*/=#>|`~@$%^&+\\]/g, '');
}

function classify(word) {
  const w = clean(word);
  let mask = 0;
  if (LAYER_WORDS[2].has(w)) mask |= 1;
  if (LAYER_WORDS[3].has(w)) mask |= 2;
  if (LAYER_WORDS[5].has(w)) mask |= 4;
  if (LAYER_WORDS[7].has(w)) mask |= 8;
  return mask;
}

function primesFromMask(mask) {
  const p = [];
  if (mask & 1) p.push(2);
  if (mask & 2) p.push(3);
  if (mask & 4) p.push(5);
  if (mask & 8) p.push(7);
  return p;
}

// ================================================================
// WORD COORDINATE STORE (IndexedDB)
// ================================================================

const WORD_STORE = 'word_coords';
const WORD_DB_VERSION = 2;  // bump klein DB version to add word_coords

/**
 * Ensure word_coords object store exists.
 * Call openTranslateDB instead of openKleinDB to get both stores.
 */
export function openTranslateDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('klein_bottle', WORD_DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      // Klein bottle stores (from klein.js)
      if (!db.objectStoreNames.contains('surface')) {
        const surface = db.createObjectStore('surface', { keyPath: 'tick' });
        surface.createIndex('u', 'u');
        surface.createIndex('v', 'v');
        surface.createIndex('weight', 'weight');
        surface.createIndex('ts', 'ts');
        surface.createIndex('synced', 'synced');
      }
      if (!db.objectStoreNames.contains('cert')) {
        db.createObjectStore('cert', { keyPath: 'key' });
      }
      for (const layer of [2, 3, 5, 7, 11, 13]) {
        const name = `layer_${layer}`;
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'row' });
        }
      }

      // Word coordinates store
      if (!db.objectStoreNames.contains(WORD_STORE)) {
        const wc = db.createObjectStore(WORD_STORE, { keyPath: 'word' });
        wc.createIndex('theta', 'theta');
        wc.createIndex('phi', 'phi');
        wc.createIndex('count', 'count');
        wc.createIndex('mask', 'mask');
      }
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

// ================================================================
// TRANSLATE_IN — σ⁻¹: Language → Topology
// ================================================================

/**
 * Decompose a text message into prime-addressed word coordinates.
 * Stores each word on the Klein bottle's local DB.
 * Returns V(t) and word data.
 *
 * This runs on EVERY chat message before it goes anywhere.
 */
export async function translateIn(text, db) {
  const words = text.split(/\s+/);
  const wordData = [];
  const counts = { 2: 0, 3: 0, 5: 0, 7: 0 };
  let totalClassified = 0;
  let logDepth = 0;
  let theta = 0;

  const tx = db.transaction(WORD_STORE, 'readwrite');
  const store = tx.objectStore(WORD_STORE);

  for (const raw of words) {
    const w = clean(raw);
    if (!w || w.length < 2) continue;

    const mask = classify(raw);
    const primes = primesFromMask(mask);

    // Count categories
    for (const p of primes) {
      counts[p]++;
      totalClassified++;
      logDepth += Math.log(p);
    }

    // Look up or assign coordinates
    const existing = await idbGet(store, w);

    let wt, wp;
    if (existing) {
      wt = existing.theta;
      wp = existing.phi;
      existing.count++;
      store.put(existing);
    } else {
      wt = theta;
      wp = 0;
      store.put({ word: w, theta, phi: 0, count: 1, mask });
      theta = (theta + 1) % RES;
    }

    wordData.push({ word: w, theta: wt, phi: wp, mask, primes });
  }

  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = (e) => reject(e.target.error);
  });

  // V(t) — voice state vector
  const safe = Math.max(totalClassified, 1);
  const v = [
    counts[2] / safe,  // a₂: action density
    counts[3] / safe,  // a₃: spatial density
    counts[5] / safe,  // a₅: temporal density
    counts[7] / safe,  // a₇: entity density
  ];

  return {
    v,
    words: wordData,
    stats: counts,
    totalWords: wordData.length,
    totalClassified,
    logDepth,
  };
}

// ================================================================
// INGEST — Decompose + Store on Klein Surface
// ================================================================

/**
 * Full ingest pipeline for a chat message.
 * 1. translateIn — classify, address, store word coords
 * 2. Create signed TPB entry on the Klein surface
 * 3. Write to prime layer tables (layer 13 index)
 * 4. Return V(t) + context summary for schema composition
 */
export async function ingest(text, db, tick, origin = 'user') {
  // Load cert for signing
  const cert = await loadCert(db);
  const zeta = cert?.zeta || 0;

  // Step 1: decompose
  const translation = await translateIn(text, db);

  // Step 2: signed entry on the surface
  const capacity = 360;  // base capacity
  const entry = createEntry(text, tick, zeta, capacity, origin);
  await writeEntry(db, entry);

  // Step 3: index in layer 13
  // Each unique new word gets a row in layer 13
  const newWords = translation.words.filter(w => w.mask > 0);
  for (const wd of newWords) {
    const col = `c${wd.primes[0] || 7}`;  // primary prime column
    const row = 2 + tick;  // row 1 is header, data starts at 2
    await writeCell(db, 13, row, col, {
      word: wd.word,
      weight: wd.primes.reduce((a, b) => a * b, 1),
      tick,
      theta: wd.theta,
    });
  }

  return {
    v: translation.v,
    stats: translation.stats,
    totalWords: translation.totalWords,
    logDepth: translation.logDepth,
    tick,
    sig: entry.sig,
  };
}

// ================================================================
// COMPOSE CONTEXT — Build schema from accumulated surface
// ================================================================

/**
 * Query the local Klein bottle and compose a context FRAGMENT
 * for the synapse (haiku/sonnet) to receive.
 *
 * Returns a Mermaid SUBGRAPH (not a full flowchart).
 * This nests cleanly inside:
 *   - Individual: kernel schema wraps it
 *   - Team: leader_container_schema nests all members
 *   - Opus: sees all subgraphs at once
 *
 * uuid namespaces all node IDs to prevent collision when
 * multiple members' contexts compose into one team schema.
 */
export async function composeContext(db, currentV, uuid = 'local') {
  const ns = uuid.slice(0, 8);  // namespace prefix

  // Get top words by count
  const tx = db.transaction(WORD_STORE, 'readonly');
  const store = tx.objectStore(WORD_STORE);
  const allWords = await new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });

  const topWords = allWords
    .filter(w => w.mask > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // Get recent surface entries
  const stx = db.transaction('surface', 'readonly');
  const surface = stx.objectStore('surface');
  const allEntries = await new Promise((resolve, reject) => {
    const req = surface.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
  const recentEntries = allEntries.slice(-5);

  // Build Mermaid FRAGMENT — subgraph only, no flowchart TD
  const lines = [];

  lines.push(`  subgraph KLEIN_${ns}["Klein Surface — ${ns}"]`);

  // Voice state
  if (currentV) {
    const labels = ['action', 'space', 'time', 'entity'];
    const dominant = currentV.indexOf(Math.max(...currentV));
    lines.push(`    ${ns}_voice["V(t) ${labels[dominant]} | ${currentV.map(x => x.toFixed(2)).join(',')}"]`);
  }

  // Top concepts
  for (const w of topWords) {
    const primes = primesFromMask(w.mask);
    const id = ns + '_' + w.word.replace(/[^a-z0-9]/g, '_');
    lines.push(`    ${id}["${w.word} x${w.count} p=${primes.join(',')}"]${w.mask & 8 ? ':::entity' : ''}`);
  }

  // Recent entries (compact, tagged by origin)
  if (recentEntries.length > 0) {
    for (const e of recentEntries) {
      const preview = typeof e.content === 'string'
        ? e.content.slice(0, 25).replace(/"/g, "'")
        : 'entry';
      const tag = e.origin || 'user';
      const style = tag === 'synapse' ? ':::synapse'
        : tag === 'team' ? ':::team'
        : tag === 'torus' ? ':::shadow'
        : '';
      lines.push(`    ${ns}_t${e.tick}["${tag}|t${e.tick}: ${preview}"]${style}`);
    }
  }

  lines.push('  end');

  // Internal edges
  if (topWords.length > 0 && currentV) {
    const firstWord = ns + '_' + topWords[0].word.replace(/[^a-z0-9]/g, '_');
    lines.push(`  ${firstWord} --> ${ns}_voice`);
  }

  return lines.join('\n');
}

// ================================================================
// HELPERS
// ================================================================

function idbGet(store, key) {
  const req = store.get(key);
  return new Promise((resolve) => {
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

export { LAYER_WORDS, classify, primesFromMask, clean };
