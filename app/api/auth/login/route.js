import { NextResponse } from 'next/server';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    console.error('[login] failed to parse request body:', e.message);
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const { email, password } = body;
  console.log(`[login] incoming: email=${email}`);

  if (!email || !password) {
    console.log('[login] rejected: missing fields');
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
    // Try kernel first
    console.log(`[login] wake check: http://${ip}:${port}/api/wake?uuid=${uuid}`);
    try {
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

      // Check if email maps to an existing user
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
    } catch (kernelErr) {
      // Kernel unreachable — accept the uuid from hash
      // The client-side Klein bottle will work offline
      console.log(`[login] kernel unavailable, accepting hash uuid: ${kernelErr.message}`);
      const response = NextResponse.json({ uuid, authenticated: true, offline: true });
      response.cookies.set('torus_uuid', uuid, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
      });
      return response;
    }

    return NextResponse.json({ error: 'user not found' }, { status: 401 });
  } catch (e) {
    console.error(`[login] FAILED: ${e.message}`, e.stack);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
