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

  const tx = db.transaction(WORD_STORE, 'readwrite');
  const store = tx.objectStore(WORD_STORE);

  // Get current word count to continue theta from where we left off
  const existingCount = await new Promise(r => {
    const req = store.count();
    req.onsuccess = () => r(req.result);
    req.onerror = () => r(0);
  });
  let nextTheta = existingCount;  // new words get theta after all existing

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
      wt = nextTheta % RES;
      wp = 0;
      store.put({ word: w, theta: wt, phi: 0, count: 1, mask });
      nextTheta++;
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

  // Strip tags before decomposition — tags are metadata, not words
  const cleanText = text
    .replace(/<imagine\s+name="[^"]*">[\s\S]*?<\/imagine>/g, '')
    .replace(/<program\s+name="[^"]*">[\s\S]*?<\/program>/g, '')
    .trim() || text;

  // Step 1: decompose
  const translation = await translateIn(cleanText, db);

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
 * Query the local Klein bottle and compose a context FRAGMENT.
 *
 * Returns a Mermaid SUBGRAPH namespaced by uuid.
 * EVOLVES with each turn:
 *   - Adaptive node count from V(t) concentration
 *   - Words scored by count × prime density (not just count)
 *   - Recent turns compressed to summary, not verbatim
 *   - Fewer tokens as conversation deepens
 */
export async function composeContext(db, currentV, uuid = 'local') {
  const ns = uuid.slice(0, 8);

  // Get all classified words
  const tx = db.transaction(WORD_STORE, 'readonly');
  const store = tx.objectStore(WORD_STORE);
  const allWords = await new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });

  // Score words: count × prime axis count (richer words score higher)
  const scored = allWords
    .filter(w => w.mask > 0)
    .map(w => ({
      ...w,
      primes: primesFromMask(w.mask),
      score: w.count * Math.max(1, primesFromMask(w.mask).length),
    }))
    .sort((a, b) => b.score - a.score);

  // Adaptive node count from V(t) concentration
  // Focused conversation (high dominant) = fewer nodes needed
  // Dispersed (all ~0.25) = more nodes for breadth
  const concentration = currentV ? Math.max(...currentV) : 0.25;
  const nodeCount = Math.round(4 + (1 - concentration) * 8);  // 4-12
  const topWords = scored.slice(0, nodeCount);

  // Get surface entry count + recent origins (compressed)
  const stx = db.transaction('surface', 'readonly');
  const surface = stx.objectStore('surface');
  const allEntries = await new Promise((resolve, reject) => {
    const req = surface.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });

  // Compress recent turns to origin counts (not verbatim entries)
  const recent = allEntries.slice(-10);
  const originCounts = { user: 0, synapse: 0, team: 0, torus: 0 };
  for (const e of recent) {
    originCounts[e.origin || 'user']++;
  }

  // Build Mermaid FRAGMENT
  const lines = [];
  lines.push(`  subgraph KLEIN_${ns}["Klein — ${allWords.length}w ${allEntries.length}t"]`);

  // Voice state
  if (currentV) {
    const labels = ['action', 'space', 'time', 'entity'];
    const dominant = currentV.indexOf(Math.max(...currentV));
    lines.push(`    ${ns}_v["V(t) ${labels[dominant]} ${currentV.map(x => x.toFixed(2)).join(',')}"]`);
  }

  // Top concepts by score
  for (const w of topWords) {
    const id = ns + '_' + w.word.replace(/[^a-z0-9]/g, '_');
    lines.push(`    ${id}["${w.word} x${w.count} p=${w.primes.join(',')}"]${w.mask & 8 ? ':::entity' : ''}`);
  }

  // Compressed recent summary (one line, not 5 entries)
  const recentParts = [];
  if (originCounts.user > 0) recentParts.push(`${originCounts.user}u`);
  if (originCounts.synapse > 0) recentParts.push(`${originCounts.synapse}s`);
  if (originCounts.team > 0) recentParts.push(`${originCounts.team}t`);
  if (originCounts.torus > 0) recentParts.push(`${originCounts.torus}e`);
  if (recentParts.length > 0) {
    lines.push(`    ${ns}_recent["last10: ${recentParts.join('/')}"]`);
  }

  lines.push('  end');

  // Edge: top concept → voice
  if (topWords.length > 0 && currentV) {
    const firstWord = ns + '_' + topWords[0].word.replace(/[^a-z0-9]/g, '_');
    lines.push(`  ${firstWord} --> ${ns}_v`);
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

// ================================================================
// CONVERSATION GRAPH — φ-cut pruning per turn
// ================================================================

const PHI_VAL = (1 + Math.sqrt(5)) / 2;
const PHI_INV = 1 / PHI_VAL;     // 0.618
const PHI_3 = PHI_INV ** 3;       // 0.236 survival ratio

/**
 * Prune a text to its semantic bones using the golden cut.
 * Returns { bones: string[], water: string, waterAddress: number }
 *
 * bones = the words that survived (carry structural weight)
 * water = the pruned words bag-of-worded into one string
 * waterAddress = prime product of all pruned word axes
 */
export function phiPrune(text) {
  const words = text.split(/\s+/).map(w => clean(w)).filter(w => w.length >= 2);
  if (words.length === 0) return { bones: [], water: '', waterAddress: 1 };

  // Weight each word by prime product of its axes
  const weighted = words.map(w => {
    const mask = classify(w);
    const primes = primesFromMask(mask);
    const weight = primes.length > 0 ? primes.reduce((a, b) => a * b, 1) : 0;
    return { word: w, weight, mask, primes };
  });

  // Sort by weight descending
  const sorted = [...weighted].sort((a, b) => b.weight - a.weight);

  // Keep top 1/φ³ of unique words
  const uniqueWords = [...new Set(sorted.map(w => w.word))];
  const keepCount = Math.max(1, Math.ceil(uniqueWords.length * PHI_3));

  // Take the heaviest unique words
  const seen = new Set();
  const boneSet = new Set();
  for (const w of sorted) {
    if (!seen.has(w.word)) {
      seen.add(w.word);
      if (boneSet.size < keepCount) {
        boneSet.add(w.word);
      }
    }
  }

  const bones = weighted.filter(w => boneSet.has(w.word)).map(w => w.word);
  const waterWords = weighted.filter(w => !boneSet.has(w.word));

  // Water address: product of all unique prime axes in pruned words
  const waterAxes = new Set();
  for (const w of waterWords) {
    for (const p of w.primes) waterAxes.add(p);
  }
  let waterAddress = 1;
  for (const p of waterAxes) waterAddress *= p;

  return {
    bones,
    water: waterWords.map(w => w.word).join(' '),
    waterAddress,
  };
}

/**
 * Build the conversation graph turn by turn.
 *
 * Each turn:
 *   1. User message arrives as x
 *   2. AI response is x·x (expansion)
 *   3. φ-prune the combined (user+response) → bones become NODES
 *   4. Next turn receives: new message + bones from previous turn
 *   5. Connections between bones across turns = EDGES (GCD > 1)
 *
 * The graph grows but tokens stay flat because pruning keeps only the bones.
 */
export function buildConversationGraph(turns) {
  const nodes = [];       // { word, weight, turn, primes }
  const edges = [];       // { from, to, gcd }
  let prevBones = [];

  for (let t = 0; t < turns.length; t++) {
    const turn = turns[t];
    const text = turn.text || '';

    // Prune this turn
    const { bones } = phiPrune(text);

    // Each bone becomes a node
    const turnNodes = [];
    for (const word of bones) {
      const mask = classify(word);
      const primes = primesFromMask(mask);
      const weight = primes.length > 0 ? primes.reduce((a, b) => a * b, 1) : 7;
      const node = { word, weight, turn: t, primes, role: turn.role || 'user' };
      turnNodes.push(node);
      nodes.push(node);
    }

    // Edges: connect bones across turns by shared prime factors
    for (const curr of turnNodes) {
      for (const prev of prevBones) {
        const g = gcd(curr.weight, prev.weight);
        if (g > 1) {
          edges.push({ from: prev.word, to: curr.word, gcd: g, fromTurn: prev.turn, toTurn: t });
        }
      }
    }

    prevBones = turnNodes;
  }

  return { nodes, edges };
}

function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

/**
 * Compose context from conversation graph instead of raw word counts.
 * The graph IS the conversation — nodes are bones, edges are connections.
 * Token count stays flat because only bones survive.
 */
export function composeContextFromGraph(graph, currentV, uuid = 'local') {
  const ns = uuid.slice(0, 8);

  // Take most recent and heaviest nodes (cap at 10)
  const recentNodes = graph.nodes.slice(-20);
  const byWord = {};
  for (const n of recentNodes) {
    if (!byWord[n.word] || n.weight > byWord[n.word].weight) {
      byWord[n.word] = n;
    }
  }
  const topNodes = Object.values(byWord)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10);

  const lines = [];
  lines.push(`  subgraph KLEIN_${ns}["Klein — ${graph.nodes.length}n ${graph.edges.length}e"]`);

  // Voice
  if (currentV) {
    const labels = ['action', 'space', 'time', 'entity'];
    const dominant = currentV.indexOf(Math.max(...currentV));
    lines.push(`    ${ns}_v["V(t) ${labels[dominant]} ${currentV.map(x => x.toFixed(2)).join(',')}"]`);
  }

  // Bone nodes
  for (const n of topNodes) {
    const id = ns + '_' + n.word.replace(/[^a-z0-9]/g, '_');
    const tag = n.role === 'user' ? '' : ':::synapse';
    lines.push(`    ${id}["${n.word} w=${n.weight} t${n.turn}"]${tag}`);
  }

  lines.push('  end');

  // Edges between bones
  const recentEdges = graph.edges.slice(-8);
  for (const e of recentEdges) {
    const fromId = ns + '_' + e.from.replace(/[^a-z0-9]/g, '_');
    const toId = ns + '_' + e.to.replace(/[^a-z0-9]/g, '_');
    lines.push(`  ${fromId} -->|gcd=${e.gcd}| ${toId}`);
  }

  // Voice edge
  if (topNodes.length > 0 && currentV) {
    const firstId = ns + '_' + topNodes[0].word.replace(/[^a-z0-9]/g, '_');
    lines.push(`  ${firstId} --> ${ns}_v`);
  }

  return lines.join('\n');
}

export { LAYER_WORDS, classify, primesFromMask, clean };
