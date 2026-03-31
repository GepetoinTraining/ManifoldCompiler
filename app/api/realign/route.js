import { NextResponse } from 'next/server';

// Shared key — must match ENTANGLE_KEY on ecos1
const SHARED_K = process.env.ENTANGLE_KEY || 'default_entangle_key';

// Simple receipt computation (must match Python's compute_receipt)
async function computeReceipt(tick, ip, K) {
  // Must match Python: json.dumps({"I": str(I), "O": str(O), "K": str(K)}, sort_keys=True)
  // Python uses ", " and ": " separators (with spaces)
  const obj = { I: String(tick), K: String(K), O: ip }; // alphabetical
  const payload = `{"I": "${obj.I}", "K": "${obj.K}", "O": "${obj.O}"}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const arr = Array.from(new Uint8Array(hash));
  return arr.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

// In-memory store (same module-level variable as health route)
// In production: use Vercel KV
let stored = { ip: null, port: 3141, tick: 0 };

export async function POST(request) {
  try {
    const body = await request.json();
    const { ip, R, tick, port } = body;

    if (!ip || !R || tick === undefined) {
      return NextResponse.json({ aligned: false, reason: 'missing fields' }, { status: 400 });
    }

    // Verify receipt
    const expected = await computeReceipt(tick, ip, SHARED_K);

    if (expected !== R) {
      return NextResponse.json({ aligned: false, reason: 'receipt mismatch' }, { status: 403 });
    }

    // Authentic. Update stored IP.
    stored = { ip, port: port || 3141, tick };

    // Also try to set env (won't persist on serverless, but helps for same-instance)
    process.env.KERNEL_IP = ip;
    process.env.KERNEL_PORT = String(port || 3141);

    return NextResponse.json({ aligned: true, ip, tick });
  } catch (e) {
    return NextResponse.json({ aligned: false, reason: e.message }, { status: 500 });
  }
}

// Export stored for other routes
export function getKernelTarget() {
  return stored;
}
