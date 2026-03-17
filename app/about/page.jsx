export const metadata = {
  title: "About — MM Compiler",
  description: "How the gate works. What barcodes do. Why the compiler adds zero bytes.",
};

export default function AboutPage() {
  return (
    <div className="about-page">
      <h1>MM Compiler</h1>
      <p>A compiler that adds <strong>zero bytes</strong>. Everything you see is earned through barcode scans.</p>

      <h2>The Gate</h2>
      <p>The <strong>only</strong> hardcoded logic in the entire application:</p>
      <pre>{`function canAccept(prime, generated) {
  // Direct: this number exists in the generated set
  if (generated.has(prime)) return true;

  // GCD: shares a factor with anything generated
  for (const existing of generated) {
    if (gcd(prime, existing) > 1) return true;
  }

  return false;
}

function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a;
}`}</pre>
      <p>Everything else — CSS, content, fonts, database tables, the lexicon — arrives through barcodes and must pass this gate.</p>

      <h2>The Ledger (mm_loop)</h2>
      <p>The heart of the system. A single table in localStorage:</p>
      <table>
        <thead>
          <tr><th>Column</th><th>Type</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>value</code></td><td>number</td><td>The number itself</td></tr>
          <tr><td><code>type</code></td><td>string</td><td>&apos;prime&apos; | &apos;composite&apos;</td></tr>
          <tr><td><code>origin</code></td><td>string</td><td>How it got here (e.g. &quot;scanned&quot;, &quot;2×3&quot;)</td></tr>
          <tr><td><code>cost</code></td><td>number</td><td>φ² ≈ 2.618 for primes, 0 for composites</td></tr>
          <tr><td><code>tick</code></td><td>number</td><td>Generation order (0-indexed)</td></tr>
          <tr><td><code>consumed</code></td><td>boolean</td><td>Has a barcode used this number yet?</td></tr>
        </tbody>
      </table>
      <p>When you scan a raw prime:</p>
      <ol>
        <li>The prime is added with <code>cost = φ²</code></li>
        <li>Every product (prime × existing values) is added as a composite with <code>cost = 0</code></li>
        <li>The pending queue is swept — any barcode whose prime now passes the gate gets replayed</li>
      </ol>
      <p>The <strong>potential</strong> is: <code>SELECT * FROM mm_loop WHERE consumed = false</code></p>

      <h2>Barcode Protocol</h2>
      <p>Format: <code>type:prime:content</code></p>
      <table>
        <thead>
          <tr><th>Type</th><th>Gate Rule</th><th>What It Does</th></tr>
        </thead>
        <tbody>
          <tr><td><em>(raw number)</em></td><td>Always accepted</td><td>Adds prime to ledger</td></tr>
          <tr><td><code>css</code></td><td>Exact prime in generated</td><td>Injects &lt;style&gt; tag</td></tr>
          <tr><td><code>h1, h2, h3, p</code></td><td>canAccept(prime)</td><td>Content node</td></tr>
          <tr><td><code>math</code></td><td>canAccept(prime)</td><td>Math expression</td></tr>
          <tr><td><code>def</code></td><td>canAccept(prime)</td><td>Definition</td></tr>
          <tr><td><code>hr</code></td><td>canAccept(prime)</td><td>Separator</td></tr>
          <tr><td><code>meta</code></td><td>canAccept(prime)</td><td>Page title</td></tr>
          <tr><td><code>js</code></td><td>canAccept(prime)</td><td>Code (earned execution)</td></tr>
          <tr><td><code>tp, tpb, op, q</code></td><td>canAccept(prime)</td><td>Database operations</td></tr>
          <tr><td><code>compose, join, pipe</code></td><td>canAccept(prime)</td><td>Composition</td></tr>
          <tr><td><code>lex</code></td><td>canAccept(prime)</td><td>Lexicon</td></tr>
        </tbody>
      </table>

      <h2>What the IDE Builds</h2>
      <ol>
        <li>The gate function (<code>canAccept</code> + <code>gcd</code>)</li>
        <li>The ledger table (<code>mm_loop</code>)</li>
        <li>The scan input (camera + manual + calculator)</li>
        <li>The DB visualizer (Studio tab)</li>
      </ol>
      <p><strong>That&apos;s it.</strong> Everything else arrives through barcodes.</p>

      <h2>What the IDE Does NOT Build</h2>
      <ul>
        <li>❌ No CSS (earned from <code>css:</code> barcodes)</li>
        <li>❌ No fonts (earned)</li>
        <li>❌ No content (earned from <code>h1:</code>, <code>p:</code>, etc.)</li>
        <li>❌ No database engine (earned from <code>js:</code> barcodes)</li>
        <li>❌ No lexicon (earned from <code>lex:</code> barcodes)</li>
      </ul>

      <h2>Boot Sequence</h2>
      <ol>
        <li><strong>Phase 1:</strong> Scan raw primes (2, 3, 5, 7, 11, 13, 17, 19) — build the ledger</li>
        <li><strong>Phase 2:</strong> Scan CSS tensors — the app becomes beautiful</li>
        <li><strong>Phase 3:</strong> Scan content — the paper materializes</li>
        <li><strong>Phase 4:</strong> Scan JS — database engine arrives</li>
        <li><strong>Phase 5:</strong> Scan lexicon — the app speaks English</li>
      </ol>

      <hr />
      <p><small>The compiler adds zero bytes of content. Zero bytes of styling. Zero lines of business logic. It only knows how to accept or reject. Everything else is earned.</small></p>
    </div>
  );
}
