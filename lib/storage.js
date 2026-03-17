// ════════════════════════════════════════════════════════════
// STORAGE — localStorage schema + helpers
// ════════════════════════════════════════════════════════════
// All state lives in localStorage. No server. Fully standalone.
// The only table initialized by the IDE is mm_loop (the ledger).
// Everything else is earned through barcodes.
// ════════════════════════════════════════════════════════════

const KEYS = {
  // ── Core (initialized by IDE) ──
  loop:      'mm_loop',       // The ledger table — heart of the system
  scans:     'mm_scans',      // Raw barcode strings, append-only master ledger

  // ── Earned (written by barcodes, never by IDE) ──
  tensors:   'mm_tensors',    // prime → CSS string
  nodes:     'mm_nodes',      // ContentNode[] for Page tab
  pending:   'mm_pending',    // prime → string[] awaiting generation
  audit:     'mm_audit',      // AuditEntry[] structured log
  db:        'mm_db',         // Earned DB tables
  lexChars:  'mm_lex_chars',  // char → prime
  lexWords:  'mm_lex_words',  // product → word
  lexRWords: 'mm_lex_rwords', // word → product
};

// ── Generic helpers ──

export function load(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ════════════════════════════════════════════════════════════
// mm_loop — THE LEDGER TABLE
// ════════════════════════════════════════════════════════════
//
// Schema:
//   value    : number   — the number itself
//   type     : string   — 'prime' | 'composite'
//   origin   : string   — how it got here (e.g. "scanned", "2×3")
//   cost     : number   — φ² (~2.618) for primes, 0 for composites
//   tick     : number   — generation order (0-indexed)
//   consumed : boolean  — has a barcode used this number yet?
//
// ════════════════════════════════════════════════════════════

/**
 * Load the ledger. Returns [] if empty.
 */
export function loadLoop() {
  return load(KEYS.loop) || [];
}

/**
 * Save the ledger.
 */
export function saveLoop(rows) {
  save(KEYS.loop, rows);
}

/**
 * Get the generated set as a Set<number> from the ledger.
 * This is the set that the gate checks against.
 */
export function getGenerated(loop) {
  return new Set(loop.map(row => row.value));
}

/**
 * Get all unconsumed values: SELECT * FROM mm_loop WHERE consumed = false
 */
export function getUnconsumed(loop) {
  return loop.filter(row => !row.consumed);
}

/**
 * Add a prime to the ledger + expand composites.
 * origin: 'scanned' for manual entry, 'auto' for auto-generated
 */
export function addPrime(loop, prime, phi2, origin = 'scanned') {
  const generated = new Set(loop.map(r => r.value));
  const tick = loop.length;
  const newRows = [];

  if (generated.has(prime)) return { loop, newRows: [], alreadyExists: true };

  const primeRow = {
    value: prime, type: 'prime', origin,
    cost: phi2, tick, consumed: false,
  };
  newRows.push(primeRow);
  generated.add(prime);

  // Generate composites: prime × every existing value
  const existingValues = loop.map(r => r.value);
  for (const ev of existingValues) {
    const product = prime * ev;
    if (!generated.has(product)) {
      newRows.push({
        value: product, type: 'composite',
        origin: `${prime}×${ev}`, cost: 0,
        tick: tick + newRows.length, consumed: false,
      });
      generated.add(product);
    }
  }

  return { loop: [...loop, ...newRows], newRows, alreadyExists: false };
}

/**
 * Run the MM loop: generate all primes from 2 up to N.
 * Each prime expands the ledger with its composites.
 * This is how a barcode auto-unlocks its required prime.
 */
export function generatePrimesUpTo(loop, n, phi2, isPrimeFn) {
  let current = loop;
  let totalNew = 0;
  for (let i = 2; i <= n; i++) {
    if (isPrimeFn(i)) {
      const result = addPrime(current, i, phi2, 'auto');
      if (!result.alreadyExists) {
        current = result.loop;
        totalNew += result.newRows.length;
      }
    }
  }
  return { loop: current, totalNew };
}

/**
 * Manually multiply two values from the ledger.
 * Both must exist. Product is added as composite if new.
 */
export function multiplyValues(loop, a, b) {
  const generated = new Set(loop.map(r => r.value));
  if (!generated.has(a) || !generated.has(b)) return { loop, added: false, reason: 'value not in ledger' };

  const product = a * b;
  if (generated.has(product)) return { loop, added: false, reason: 'already exists' };

  const row = {
    value: product,
    type: 'composite',
    origin: `${a}×${b}`,
    cost: 0,
    tick: loop.length,
    consumed: false,
  };

  return { loop: [...loop, row], added: true, product, row };
}

/**
 * Mark a value as consumed (used by a barcode).
 */
export function consumeValue(loop, value) {
  return loop.map(row =>
    row.value === value && !row.consumed
      ? { ...row, consumed: true }
      : row
  );
}

// ── Scan ledger (single-use barcodes) ──

export function loadScans() {
  return load(KEYS.scans) || [];
}

/**
 * Check if a barcode has already been scanned. Each barcode is SINGLE USE.
 */
export function isScanUsed(raw) {
  return loadScans().includes(raw);
}

export function appendScan(raw) {
  const scans = loadScans();
  scans.push(raw);
  save(KEYS.scans, scans);
  return scans;
}

// ── Pending queue ──

export function loadPending() {
  return load(KEYS.pending) || {};
}

export function savePending(pending) {
  save(KEYS.pending, pending);
}

export function addPending(prime, barcode) {
  const pending = loadPending();
  if (!pending[prime]) pending[prime] = [];
  pending[prime].push(barcode);
  savePending(pending);
}

// ── Tensors (CSS) ──

export function loadTensors() {
  return load(KEYS.tensors) || {};
}

export function saveTensors(tensors) {
  save(KEYS.tensors, tensors);
}

// ── Nodes (content) ──

export function loadNodes() {
  return load(KEYS.nodes) || [];
}

export function saveNodes(nodes) {
  save(KEYS.nodes, nodes);
}

// ── Audit ──

export function loadAudit() {
  return load(KEYS.audit) || [];
}

export function appendAudit(entry) {
  const audit = loadAudit();
  audit.push({ ...entry, timestamp: new Date().toISOString() });
  save(KEYS.audit, audit);
  return audit;
}

// ── Nuclear option ──

export function clearAll() {
  Object.values(KEYS).forEach(key => localStorage.removeItem(key));
}

export { KEYS };
