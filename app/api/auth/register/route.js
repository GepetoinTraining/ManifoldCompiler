import { NextResponse } from 'next/server';
import { registerUser } from '../../../../lib/turso';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }
  const { email, password, name, profession } = body;

  if (!email || !password || !name) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }

  // Hash email+password for uuid
  const encoder = new TextEncoder();
  const data = encoder.encode(email + ':' + password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const uuid = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);

  try {
    await registerUser(uuid, name, email, profession);
    console.log(`[register] user created in Turso: uuid=${uuid} name=${name}`);

    const response = NextResponse.json({ uuid, name });
    response.cookies.set('torus_uuid', uuid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    });
    return response;
  } catch (e) {
    console.error(`[register] FAILED: ${e.message}`);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
