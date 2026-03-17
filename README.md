# MM Compiler

**A compiler that adds zero bytes.** Everything is earned through barcodes.

## What It Does

The MM Compiler scans QR codes and barcodes, routes them through a mathematical gate function (`canAccept`), and crystallizes their content into a page. The compiler itself adds nothing — no CSS, no content, no fonts. Everything arrives through physical barcode scans.

## Architecture

The entire application has **one piece of hardcoded logic**:

```javascript
function canAccept(prime, generated) {
  if (generated.has(prime)) return true;
  for (const existing of generated) {
    if (gcd(prime, existing) > 1) return true;
  }
  return false;
}
```

Everything else — styling, content, database tables, even the lexicon — must pass through this gate via barcode scans.

## The Ledger (`mm_loop`)

| Column | Type | Description |
|--------|------|-------------|
| value | number | The number itself |
| type | string | 'prime' \| 'composite' |
| origin | string | How it arrived ("scanned", "2×3") |
| cost | number | φ² ≈ 2.618 for primes, 0 for composites |
| tick | number | Generation order |
| consumed | boolean | Used by a barcode yet? |

## Tabs

| Tab | Purpose |
|-----|---------|
| ① Scan | Camera (QR/Barcode) or Raw Number input. Manual barcode string entry. Calculator. |
| ② Page | Earned content zone. Renders nodes + injects CSS tensors. Starts empty. |
| ③ Studio | Database visualizer. Shows mm_loop ledger, tensors, pending queue. |

## Barcode Protocol

Format: `type:prime:content`

| Type | Gate | Effect |
|------|------|--------|
| *(number)* | Always | Adds prime to ledger |
| `css` | Exact match | Injects `<style>` tag |
| `h1,h2,h3,p` | canAccept | Content node |
| `math,def,hr` | canAccept | Special content |
| `meta` | canAccept | Sets page title |
| `js` | canAccept | Stored (earned execution) |
| `tp,tpb,op,q` | canAccept | DB operations |
| `lex` | canAccept | Lexicon |

## Boot Sequence

1. **Scan primes** (2, 3, 5, 7, ...) → builds the ledger
2. **Scan CSS tensors** → the app becomes beautiful
3. **Scan content** → the paper materializes
4. **Scan JS** → database engine arrives
5. **Scan lexicon** → the app speaks

## Development

```bash
npm install
npm run dev    # http://localhost:3000
npm run build  # production build
```

## Deployment

Deploy to Vercel — zero config, zero environment variables needed. All state lives in `localStorage`.

---

*The compiler adds zero bytes. Zero bytes of content. Zero bytes of styling. It only knows how to accept or reject. Everything else is earned.*
