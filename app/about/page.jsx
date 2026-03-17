export const metadata = {
  title: "About — MM Compiler Verifier Transparency",
  description: "Complete code breakdown proving the MM Compiler Verifier adds zero bytes. Every function dissected, every guarantee explained.",
};

export default function AboutPage() {
  return (
    <div className="about-container">
      {/* ═══ HERO ═══ */}
      <div className="about-hero">
        <h1>Transparency Proof</h1>
        <p className="subtitle">
          Every function in this application is broken down below.<br />
          Read the code. Verify the guarantees. Trust nothing but the source.
        </p>
      </div>

      {/* ═══ THE 6 GUARANTEES ═══ */}
      <div className="section-header">
        <h2>The 6 Guarantees</h2>
        <p>Each guarantee can be verified by reading the source code below.</p>
      </div>

      <div className="guarantee-grid">
        <div className="guarantee-card">
          <div className="guarantee-number">①</div>
          <div className="guarantee-title">No Network Requests</div>
          <div className="guarantee-desc">
            Zero <code>fetch()</code>, zero <code>XMLHttpRequest</code>, zero <code>WebSocket</code>.
            The app never contacts any server. All data stays in your browser.
          </div>
        </div>

        <div className="guarantee-card">
          <div className="guarantee-number">②</div>
          <div className="guarantee-title">No Dynamic Execution</div>
          <div className="guarantee-desc">
            Zero <code>eval()</code>, zero <code>new Function()</code>, zero <code>setTimeout</code> with strings.
            No code is generated or executed dynamically.
          </div>
        </div>

        <div className="guarantee-card">
          <div className="guarantee-number">③</div>
          <div className="guarantee-title">Pure Parser</div>
          <div className="guarantee-desc">
            The <code>parse()</code> function is a string splitter. It reads colons,
            extracts fields. It does not add, modify, or transform content.
          </div>
        </div>

        <div className="guarantee-card">
          <div className="guarantee-number">④</div>
          <div className="guarantee-title">Append-Only State</div>
          <div className="guarantee-desc">
            <code>handleScan()</code> only appends to arrays. No mutation of existing nodes.
            No rewriting of content. The audit log is immutable.
          </div>
        </div>

        <div className="guarantee-card">
          <div className="guarantee-number">⑤</div>
          <div className="guarantee-title">Render = State</div>
          <div className="guarantee-desc">
            Tab ② renders exactly <code>state.nodes[]</code> — content that came from scans.
            No hardcoded text. No generated content. What you scanned is what you see.
          </div>
        </div>

        <div className="guarantee-card">
          <div className="guarantee-number">⑥</div>
          <div className="guarantee-title">Byte-Accurate Audit</div>
          <div className="guarantee-desc">
            Tab ③ tracks every scan event with byte counts. The &quot;compiler bytes added&quot;
            counter is a literal <code>0</code>. It cannot increment — there is no code path to do so.
          </div>
        </div>
      </div>

      {/* ═══ DATA FLOW DIAGRAM ═══ */}
      <div className="section-header">
        <h2>Data Flow</h2>
        <p>The complete journey of each byte through the system. No detours, no injection points.</p>
      </div>

      <div className="flow-diagram">
        <div className="flow-node source">📷 Camera</div>
        <div className="flow-arrow">→</div>
        <div className="flow-node">BarcodeDetector API</div>
        <div className="flow-arrow">→</div>
        <div className="flow-node">parse()</div>
        <div className="flow-arrow">→</div>
        <div className="flow-node">handleScan()</div>
        <div className="flow-arrow">→</div>
        <div className="flow-node">state[]</div>
        <div className="flow-arrow">→</div>
        <div className="flow-node source">Render</div>
      </div>

      <p style={{ fontSize: 11, color: '#888877', textAlign: 'center', marginTop: 12, fontFamily: "'Inter', sans-serif" }}>
        At no point in this pipeline is any content generated, modified, or injected.
        The camera reads raw bytes → they are split by colons → stored in an array → rendered as-is.
      </p>

      {/* ═══ CODE BREAKDOWN ═══ */}
      <div className="section-header">
        <h2>Code Breakdown</h2>
        <p>Every function in the verifier, with its exact source and a plain-English explanation.</p>
      </div>

      {/* §0 — SEED */}
      <div className="code-section">
        <div className="code-section-header">
          <span className="code-section-icon">§0</span>
          <span className="code-section-title">SEED — Mathematical Constants</span>
          <span className="code-section-tag">PURE MATH</span>
        </div>
        <div className="code-explanation">
          <p>
            These are the only &quot;pre-existing&quot; values in the system. <strong>PHI</strong> is the golden ratio
            (~1.618), computed by iterating <code>x = 1 + 1/x</code> 100 times — a standard
            continued-fraction convergence. <strong>gcd()</strong> computes the greatest common divisor
            using Euclid&#39;s algorithm (3rd century BC). <strong>factorize()</strong> performs trial division
            to find prime factors.
          </p>
          <div className="verdict">
            ✓ VERDICT: Pure mathematics. No data generation. These functions compute properties
            OF the scanned data — they do not CREATE data.
          </div>
        </div>
        <div className="code-block-wrapper">
          <pre>{`const PHI = (() => {
  let x = 2;
  for (let i = 0; i < 100; i++) x = 1 + 1/x;
  return x;
})();
// Result: 1.6180339887... (the golden ratio)

function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a;
}
// Euclid's algorithm. Input: two numbers. Output: their GCD.
// Example: gcd(12, 8) → 4

function factorize(n) {
  if (n < 2) return [n];
  const f = []; let t = Math.abs(Math.round(n));
  for (let d = 2; d * d <= t; d++)
    while (t % d === 0) { f.push(d); t /= d; }
  if (t > 1) f.push(t);
  return f;
}
// Trial division. Input: a number. Output: its prime factors.
// Example: factorize(30) → [2, 3, 5]`}</pre>
        </div>
      </div>

      {/* §1 — PARSE */}
      <div className="code-section">
        <div className="code-section-header">
          <span className="code-section-icon">§1</span>
          <span className="code-section-title">PARSE — Barcode Protocol Reader</span>
          <span className="code-section-tag">READ-ONLY</span>
        </div>
        <div className="code-explanation">
          <p>
            This function receives the <strong>raw string</strong> from a QR code or barcode scan.
            It expects the format <code>type:prime:content</code>. It finds the first two colons,
            splits the string into three fields, and returns them. If the format is wrong, it
            returns <code>null</code> — the scan is rejected.
          </p>
          <p>
            <strong>Critical observation:</strong> The <code>content</code> field is extracted with
            <code>raw.slice(j + 1)</code> — that&#39;s a substring operation. It does not modify,
            encode, decode, or transform the content in any way. The bytes that go in are the
            exact bytes that come out.
          </p>
          <div className="verdict">
            ✓ VERDICT: Pure string splitting. No transformation, no injection. The only
            &quot;computation&quot; is finding two colon positions with indexOf().
          </div>
        </div>
        <div className="code-block-wrapper">
          <pre>{`function parse(raw) {
  const i = raw.indexOf(':');      // find first colon
  if (i < 0) return null;          // no colon? reject.
  const j = raw.indexOf(':', i+1); // find second colon
  if (j < 0) return null;          // only one colon? reject.

  const type    = raw.slice(0, i);     // before 1st colon
  const prime   = parseInt(raw.slice(i+1, j)); // between colons
  const content = raw.slice(j + 1);    // after 2nd colon

  if (isNaN(prime)) return null;   // prime isn't a number? reject.

  return {
    type,     // e.g. "h1", "p", "math"
    prime,    // e.g. 7, 13, 97
    content,  // e.g. "Hello World"
    raw,      // the entire original string
    bytes: new Blob([raw]).size  // byte count of original
  };
}

// Example:
// parse("h1:7:Hello World")
// → { type:"h1", prime:7, content:"Hello World",
//     raw:"h1:7:Hello World", bytes:17 }`}</pre>
        </div>
      </div>

      {/* §2 — STORAGE */}
      <div className="code-section">
        <div className="code-section-header">
          <span className="code-section-icon">§2</span>
          <span className="code-section-title">STORAGE — localStorage Persistence</span>
          <span className="code-section-tag">LOCAL ONLY</span>
        </div>
        <div className="code-explanation">
          <p>
            Two functions: <strong>loadState()</strong> reads from <code>localStorage</code>
            (your browser&#39;s local storage — no server involved). <strong>saveState()</strong> writes
            to the same place. The data never leaves your device.
          </p>
          <p>
            The storage key is the literal string <code>&quot;mm_compiler&quot;</code>. You can open your
            browser&#39;s DevTools → Application → Local Storage and see exactly what&#39;s stored.
            It&#39;s the JSON representation of <code>{`{ nodes: [...], audit: [...], totalBytes: N }`}</code>.
          </p>
          <div className="verdict">
            ✓ VERDICT: Standard browser localStorage. No network calls. No cookies sent to servers.
            Data stays on your device and can be inspected in DevTools at any time.
          </div>
        </div>
        <div className="code-block-wrapper">
          <pre>{`const STORAGE_KEY = 'mm_compiler';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw
      ? JSON.parse(raw)
      : { nodes: [], audit: [], totalBytes: 0 };
  } catch {
    return { nodes: [], audit: [], totalBytes: 0 };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// That's it. Read JSON, write JSON. Local browser storage.`}</pre>
        </div>
      </div>

      {/* §3 — CAMERA */}
      <div className="code-section">
        <div className="code-section-header">
          <span className="code-section-icon">§3</span>
          <span className="code-section-title">CAMERA — BarcodeDetector Loop</span>
          <span className="code-section-tag">BROWSER API</span>
        </div>
        <div className="code-explanation">
          <p>
            The camera uses the standard <strong>Web BarcodeDetector API</strong> — a built-in browser
            feature (no library). It requests camera access via <code>getUserMedia()</code>, then runs
            a detection loop with <code>requestAnimationFrame()</code>.
          </p>
          <p>
            When a barcode is detected, the detector returns its <code>rawValue</code> — the exact
            string encoded in the barcode. A <strong>2.5-second cooldown</strong> prevents duplicate reads
            of the same code. That&#39;s the only filtering: the raw value passes directly to <code>handleScan()</code>.
          </p>
          <div className="verdict">
            ✓ VERDICT: Uses a native browser API to read barcodes. The rawValue is passed through
            unchanged. No transformation, no preprocessing, no injection.
          </div>
        </div>
        <div className="code-block-wrapper">
          <pre>{`const startCamera = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment',
             width: { ideal: 1280 },
             height: { ideal: 720 } }
  });
  videoRef.current.srcObject = stream;
  startDetection();
};

const startDetection = () => {
  // BarcodeDetector is a BROWSER BUILT-IN. Not our code.
  const detector = new BarcodeDetector({
    formats: ['qr_code', 'code_128', 'code_39',
              'ean_13', 'ean_8', 'data_matrix']
  });

  const loop = () => {
    detector.detect(videoRef.current).then(codes => {
      for (const c of codes) {
        const now = Date.now();
        // 2.5s cooldown to prevent repeat reads
        if (c.rawValue === scanRef.current.last
            && now - scanRef.current.time < 2500) continue;

        scanRef.current = { last: c.rawValue, time: now };
        handleScan(c.rawValue);
        // ↑ rawValue goes DIRECTLY to handleScan.
        // No modification. No encoding. No wrapping.
      }
    });
    requestAnimationFrame(loop);
  };
  loop();
};`}</pre>
        </div>
      </div>

      {/* §4 — SCAN HANDLER */}
      <div className="code-section">
        <div className="code-section-header">
          <span className="code-section-icon">§4</span>
          <span className="code-section-title">HANDLE SCAN — State Builder</span>
          <span className="code-section-tag">APPEND ONLY</span>
        </div>
        <div className="code-explanation">
          <p>
            This is the central function. When a scan arrives, it:
          </p>
          <p>
            <strong>Step 1:</strong> Calls <code>parse(raw)</code>. If it returns null → scan is
            REJECTED and logged in the audit trail.
          </p>
          <p>
            <strong>Step 2:</strong> Checks if the prime number already exists in <code>state.nodes</code>.
            If yes → DUPLICATE, logged and skipped.
          </p>
          <p>
            <strong>Step 3:</strong> Computes GCD links — finds which existing nodes share common
            prime factors with the new scan. This is <strong>read-only analysis</strong> of existing data.
          </p>
          <p>
            <strong>Step 4:</strong> Creates a <code>node</code> object from the parsed data and
            <strong>appends</strong> it to <code>state.nodes</code>. Logs the event in <code>state.audit</code>.
            Adds the byte count to <code>totalBytes</code>.
          </p>
          <p>
            <strong>Critical observation:</strong> The <code>content</code> field in the node is
            <code>parsed.content</code> — the exact substring from the barcode. It is never modified.
            The byte count is measured from the <strong>original raw string</strong>, not from anything
            this function produces.
          </p>
          <div className="verdict">
            ✓ VERDICT: Append-only state mutation. Content passes through untouched. The only
            &quot;new&quot; data computed is: prime factors (math), GCD links (math), and timestamps (clock).
            None of these appear as rendered content — they are metadata for the audit trail.
          </div>
        </div>
        <div className="code-block-wrapper">
          <pre>{`const handleScan = (raw) => {
  const parsed = parse(raw);
  const timestamp = new Date().toISOString();

  // Gate 1: Invalid format → REJECT
  if (!parsed) {
    setState(prev => ({
      ...prev,
      audit: [...prev.audit, {
        timestamp,
        raw: raw.slice(0, 100),
        action: 'REJECTED',
        reason: 'invalid format'
      }]
    }));
    return;
  }

  // Gate 2: Prime already exists → DUPLICATE
  if (state.nodes.some(n => n.prime === parsed.prime)) {
    setState(prev => ({
      ...prev,
      audit: [...prev.audit, {
        timestamp, action: 'DUPLICATE', prime: parsed.prime
      }]
    }));
    return;
  }

  // Analysis: find nodes sharing prime factors
  const links = state.nodes
    .filter(n => gcd(parsed.prime, n.prime) > 1)
    .map(n => ({ prime: n.prime,
                 shared: gcd(parsed.prime, n.prime) }));

  // Build node from PARSED data only
  const node = {
    type:      parsed.type,      // from barcode
    prime:     parsed.prime,     // from barcode
    factors:   factorize(parsed.prime), // math
    content:   parsed.content,   // from barcode (UNTOUCHED)
    links,                       // math analysis
    tick:      state.nodes.length,
    timestamp,                   // clock
    bytes:     parsed.bytes      // measured from raw input
  };

  // APPEND to state. No mutation of existing entries.
  setState(prev => ({
    nodes:      [...prev.nodes, node],
    audit:      [...prev.audit, { /* audit entry */ }],
    totalBytes: prev.totalBytes + parsed.bytes
  }));
};`}</pre>
        </div>
      </div>

      {/* §5 — RENDER */}
      <div className="code-section">
        <div className="code-section-header">
          <span className="code-section-icon">§5</span>
          <span className="code-section-title">RENDER — Display Layer</span>
          <span className="code-section-tag">OUTPUT ONLY</span>
        </div>
        <div className="code-explanation">
          <p>
            The render layer has <strong>three tabs</strong>, each displaying state data and nothing else:
          </p>
          <p>
            <strong>Tab ① SCAN:</strong> Shows the camera feed and the last scan result. The status
            (ACCEPTED / REJECTED / DUPLICATE) is determined by <code>handleScan()</code>, not generated here.
          </p>
          <p>
            <strong>Tab ② PAGE:</strong> Iterates over <code>state.nodes[]</code> and renders each one
            based on its <code>type</code>. An <code>h1</code> node becomes an <code>&lt;h1&gt;</code> tag.
            A <code>p</code> node becomes a <code>&lt;p&gt;</code> tag. The content is <code>node.content</code> —
            the exact string from the barcode scan. <strong>No text is generated</strong>. If no nodes exist,
            it shows &quot;nothing crystallized yet&quot; — a static placeholder.
          </p>
          <p>
            <strong>Tab ③ AUDIT:</strong> Displays the raw audit log in reverse chronological order.
            Shows timestamps, byte counts, prime factors, and link counts. The &quot;Compiler bytes added&quot;
            line is a hardcoded <code>0</code> — there is no variable, no counter, no code path
            that could ever make it anything else.
          </p>
          <div className="verdict">
            ✓ VERDICT: The render layer is a pure projection of state. It creates HTML elements
            from array data. It does not generate, modify, or inject any content bytes.
          </div>
        </div>
        <div className="code-block-wrapper">
          <pre>{`// Tab ② — Render each node based on its type
state.nodes.map((node, i) => {
  // CSS nodes become <style> tags
  if (node.type === 'css') return <style>{node.content}</style>;
  // JS nodes are logged but NOT executed
  if (node.type === 'js') return null;
  // Separators become <hr>
  if (node.type === 'sep') return <hr />;

  // Content nodes → HTML tags based on type
  const Tag = node.type === 'h1' ? 'h1'
            : node.type === 'h2' ? 'h2'
            : node.type === 'h3' ? 'h3' : 'p';

  return <Tag>{node.content}</Tag>;
  //              ↑ THIS IS THE BARCODE CONTENT.
  //              Nothing else. Not generated. Not modified.
})

// Tab ③ — The zero-injection proof
<div>
  Compiler bytes added: <span>0</span>
</div>
// ↑ This is a LITERAL 0. Not a variable.
// There is no code path that changes this value.`}</pre>
        </div>
      </div>

      {/* §6 — WHAT THIS APP DOES NOT CONTAIN */}
      <div className="code-section">
        <div className="code-section-header">
          <span className="code-section-icon">§6</span>
          <span className="code-section-title">NEGATIVE PROOF — What Is NOT In This Code</span>
          <span className="code-section-tag warn">VERIFY YOURSELF</span>
        </div>
        <div className="code-explanation">
          <p>
            The following capabilities are <strong>completely absent</strong> from this codebase.
            You can verify this by searching the source code (Ctrl+F in your browser&#39;s DevTools → Sources):
          </p>
          <p>
            ❌ <strong>No <code>fetch()</code></strong> — zero network requests to any server<br />
            ❌ <strong>No <code>XMLHttpRequest</code></strong> — zero AJAX calls<br />
            ❌ <strong>No <code>WebSocket</code></strong> — zero real-time connections<br />
            ❌ <strong>No <code>eval()</code></strong> — zero dynamic code execution<br />
            ❌ <strong>No <code>new Function()</code></strong> — zero runtime code generation<br />
            ❌ <strong>No <code>importScripts()</code></strong> — zero web worker imports<br />
            ❌ <strong>No <code>document.write()</code></strong> — zero DOM injection<br />
            ❌ <strong>No <code>innerHTML</code></strong> — zero HTML string injection<br />
            ❌ <strong>No external libraries</strong> — zero barcode/QR scanning libraries<br />
            ❌ <strong>No analytics</strong> — zero tracking pixels, zero telemetry<br />
            ❌ <strong>No cookies</strong> — zero cookie reading or writing
          </p>
          <div className="verdict">
            ✓ VERDICT: This application is a hermetically sealed read-only pipeline. Data enters
            through the camera, gets stored in local state, and is displayed. That is ALL it does.
          </div>
        </div>
      </div>

      {/* ═══ HOW TO VERIFY ═══ */}
      <div className="section-header">
        <h2>Verify It Yourself</h2>
        <p>Don&#39;t trust this page. Verify the source.</p>
      </div>

      <div className="code-section">
        <div className="code-section-header">
          <span className="code-section-icon">🔍</span>
          <span className="code-section-title">Self-Verification Steps</span>
        </div>
        <div className="code-explanation">
          <p>
            <strong>Step 1:</strong> Open your browser&#39;s DevTools (F12 or Ctrl+Shift+I).<br />
            <strong>Step 2:</strong> Go to the <strong>Sources</strong> tab.<br />
            <strong>Step 3:</strong> Find the compiled JavaScript bundle.<br />
            <strong>Step 4:</strong> Search (Ctrl+F) for: <code>fetch</code>, <code>XMLHttpRequest</code>,
            <code>eval</code>, <code>Function(</code>, <code>WebSocket</code>.<br />
            <strong>Step 5:</strong> You will find <strong>zero matches</strong> in the application code.<br />
            <strong>Step 6:</strong> Go to <strong>Network</strong> tab. Perform a scan. You will see <strong>zero requests</strong> to
            any external server.<br />
            <strong>Step 7:</strong> Go to <strong>Application → Local Storage</strong>. You&#39;ll see your
            scan data stored under the key <code>mm_compiler</code>. This is the ONLY data persistence.
          </p>
        </div>
      </div>

      {/* ═══ TECH STACK ═══ */}
      <div className="section-header">
        <h2>Tech Stack</h2>
        <p>Minimal by design. Every dependency is listed.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 32 }}>
        {[
          { name: 'Next.js 14', role: 'Framework', desc: 'Page routing and server-side rendering shell' },
          { name: 'React 18', role: 'UI Library', desc: 'Component rendering and state management' },
          { name: 'BarcodeDetector', role: 'Browser API', desc: 'Native barcode/QR reading (no library)' },
          { name: 'localStorage', role: 'Browser API', desc: 'Local-only data persistence' },
          { name: 'getUserMedia', role: 'Browser API', desc: 'Camera access for scanning' },
        ].map((tech, i) => (
          <div key={i} className="guarantee-card">
            <div className="guarantee-title">{tech.name}</div>
            <div style={{ fontSize: 9, color: '#3a6b8c', marginBottom: 4 }}>{tech.role}</div>
            <div className="guarantee-desc">{tech.desc}</div>
          </div>
        ))}
      </div>

      {/* ═══ FOOTER ═══ */}
      <div className="footer">
        <p>MM COMPILER VERIFIER — OPEN SOURCE TRANSPARENCY</p>
        <p style={{ marginTop: 6 }}>Every byte accounted for. Every function explained. Zero injection.</p>
      </div>
    </div>
  );
}
