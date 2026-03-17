# MM Compiler Verifier

**Proves it adds nothing.**

A transparency tool that scans QR codes and barcodes, crystallizes their content into a readable page, and maintains an immutable audit trail proving that exactly **zero bytes** were injected, modified, or fabricated by this application.

---

## What Is This?

The MM Compiler Verifier is a web-based barcode scanner with a single purpose: **to prove that it doesn't cheat**.

Every byte displayed on the "Page" tab came from a physical barcode scan. Nothing was generated. Nothing was hardcoded. Nothing was fetched from a server. The audit trail tracks every scan event with byte counts, timestamps, and prime factorizations.

## How It Works

### Three Tabs, Three Guarantees

| Tab | Name | Purpose |
|-----|------|---------|
| ① | **Scan** | Camera reads QR/barcodes using the native BarcodeDetector API |
| ② | **Page** | Renders crystallized content — only what was scanned |
| ③ | **Audit** | Shows every scan event with byte counts and the proof that 0 bytes were added |

### Barcode Protocol

Barcodes must follow the format:

```
type:prime:content
```

| Field | Description | Example |
|-------|-------------|---------|
| `type` | HTML element type | `h1`, `p`, `math`, `def`, `css` |
| `prime` | Unique prime identifier | `7`, `13`, `97` |
| `content` | The actual content | `Hello World` |

**Example barcode content:** `h1:7:The Title of My Document`

### Data Flow

```
📷 Camera → BarcodeDetector API → parse() → handleScan() → state[] → Render
```

At **no point** in this pipeline is content generated, modified, or injected.

---

## The 6 Guarantees

1. **No Network Requests** — Zero `fetch()`, zero `XMLHttpRequest`, zero `WebSocket`. The app never contacts any server.
2. **No Dynamic Execution** — Zero `eval()`, zero `new Function()`. No code is generated at runtime.
3. **Pure Parser** — `parse()` is a string splitter. It finds colons and extracts substrings. That's it.
4. **Append-Only State** — `handleScan()` only appends to arrays. No mutation of existing data.
5. **Render = State** — Tab ② displays exactly `state.nodes[]`. No hardcoded text.
6. **Byte-Accurate Audit** — Tab ③ shows "Compiler bytes added: **0**". This is a literal `0`, not a variable.

---

## Tech Stack

| Dependency | Purpose |
|-----------|---------|
| **Next.js 14** | Page routing and build tooling |
| **React 18** | Component rendering and state management |
| **BarcodeDetector** | Native browser API for QR/barcode reading (no library) |
| **localStorage** | Local-only data persistence (no server) |

**Zero external scanning libraries. Zero analytics. Zero telemetry.**

---

## Deploy to Vercel

### Option 1: Push to GitHub

1. Push this repository to GitHub
2. Go to [vercel.com](https://vercel.com) and import the repo
3. Click **Deploy** — no configuration needed

### Option 2: CLI

```bash
npm install -g vercel
vercel
```

### Option 3: Direct

```bash
npx -y vercel
```

---

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Verify It Yourself

1. Open **DevTools** (F12)
2. Go to **Sources** tab → search the bundle for `fetch`, `XMLHttpRequest`, `eval`, `WebSocket`
3. Find **zero matches** in application code
4. Go to **Network** tab → scan a barcode → see **zero external requests**
5. Go to **Application → Local Storage** → find your data under the key `mm_compiler`
6. Visit **/about** for a full section-by-section code breakdown

---

## Project Structure

```
ManifoldCompiler/
├── app/
│   ├── layout.jsx            # Root layout with nav + SEO metadata
│   ├── page.jsx              # Main page (renders MMCompiler)
│   ├── globals.css           # Global dark theme styles
│   ├── components/
│   │   └── MMCompiler.jsx    # The verifier component (scan + render + audit)
│   └── about/
│       └── page.jsx          # Code transparency breakdown page
├── mm_compiler.jsx           # Original source (preserved)
├── package.json              # Dependencies: next, react, react-dom
├── next.config.mjs           # Minimal Next.js config (empty)
├── jsconfig.json             # Path aliases
└── README.md                 # This file
```

---

## License

Open source. Read the code. Verify the guarantees. Trust nothing but the source.
