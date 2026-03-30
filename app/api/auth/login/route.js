import { NextResponse } from 'next/server';

export async function POST(request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }

  // Compute uuid from email+password (same hash as register)
  const encoder = new TextEncoder();
  const data = encoder.encode(email + ':' + password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const uuid = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);

  // Verify user exists in kernel
  const ip = process.env.KERNEL_IP || '127.0.0.1';
  const port = process.env.KERNEL_PORT || '3141';

  try {
    // First: try to find by computed uuid
    const resp = await fetch(`http://${ip}:${port}/api/wake?uuid=${uuid}`);
    const result = await resp.json();

    if (result.O && result.O.tokens_estimate) {
      const response = NextResponse.json({ uuid, authenticated: true });
      response.cookies.set('torus_uuid', uuid, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
      });
      return response;
    }

    // Second: check if email maps to an existing user (e.g. Pedro's soul-seed-1)
    const emailResp = await fetch(`http://${ip}:${port}/api/auth/lookup?email=${encodeURIComponent(email)}`);
    const emailResult = await emailResp.json();

    if (emailResult.O && emailResult.O.uuid) {
      const existingUuid = emailResult.O.uuid;
      const response = NextResponse.json({ uuid: existingUuid, authenticated: true });
      response.cookies.set('torus_uuid', existingUuid, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
      });
      return response;
    }

    return NextResponse.json({ error: 'user not found' }, { status: 401 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
