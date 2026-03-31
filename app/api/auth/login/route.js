import { NextResponse } from 'next/server';
import { lookupUser, lookupByEmail } from '../../../../lib/turso';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }

  // Compute uuid from email+password (same hash as register)
  const encoder = new TextEncoder();
  const data = encoder.encode(email + ':' + password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const uuid = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);

  try {
    // Check if user exists by computed uuid
    let user = await lookupUser(uuid);

    if (!user) {
      // Check by email (e.g. Pedro's soul-seed-1)
      user = await lookupByEmail(email);
    }

    if (user) {
      const foundUuid = user.uuid || uuid;
      console.log(`[login] authenticated: uuid=${foundUuid}`);
      const response = NextResponse.json({ uuid: foundUuid, authenticated: true });
      response.cookies.set('torus_uuid', foundUuid, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
      });
      return response;
    }

    return NextResponse.json({ error: 'user not found' }, { status: 401 });
  } catch (e) {
    console.error(`[login] FAILED: ${e.message}`);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
