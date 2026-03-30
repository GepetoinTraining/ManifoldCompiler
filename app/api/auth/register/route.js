import { NextResponse } from 'next/server';

// Proxy to kernel for user creation
async function kernelRequest(path, body) {
  const ip = process.env.KERNEL_IP || '127.0.0.1';
  const port = process.env.KERNEL_PORT || '3141';
  const resp = await fetch(`http://${ip}:${port}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Torus-Key': process.env.TORUS_API_KEY || '' },
    body: JSON.stringify(body),
  });
  return resp.json();
}

export async function POST(request) {
  const { email, password, name, profession } = await request.json();

  if (!email || !password || !name) {
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
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
