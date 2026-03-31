import { NextResponse } from 'next/server';

// Proxy to kernel for user creation
async function kernelRequest(path, body) {
  const ip = process.env.KERNEL_IP || '127.0.0.1';
  const port = process.env.KERNEL_PORT || '3141';
  const url = `http://${ip}:${port}${path}`;
  console.log(`[register] kernel request: ${url}`);
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Torus-Key': process.env.TORUS_API_KEY || '' },
    body: JSON.stringify(body),
  });
  console.log(`[register] kernel response: ${resp.status} ${resp.statusText}`);
  if (!resp.ok) {
    const text = await resp.text();
    console.error(`[register] kernel error body: ${text}`);
    throw new Error(`Kernel ${resp.status}: ${text}`);
  }
  return resp.json();
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    console.error('[register] failed to parse request body:', e.message);
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const { email, password, name, profession } = body;
  console.log(`[register] incoming: email=${email}, name=${name}, profession=${profession || 'none'}`);

  if (!email || !password || !name) {
    console.log('[register] rejected: missing fields');
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }

  // Create user in kernel (we'll add this endpoint)
  // For now, hash email+password for uuid
  const encoder = new TextEncoder();
  const data = encoder.encode(email + ':' + password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const uuid = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);

  // Store user (proxy to kernel)
  try {
    const result = await kernelRequest('/api/register', { uuid, name, email, profession });

    // Set cookie with uuid
    const response = NextResponse.json({ uuid, name, ...result });
    response.cookies.set('torus_uuid', uuid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });
    return response;
  } catch (e) {
    console.error(`[register] FAILED: ${e.message}`, e.stack);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
