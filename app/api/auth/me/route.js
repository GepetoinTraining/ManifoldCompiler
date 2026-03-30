import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const uuid = cookieStore.get('torus_uuid')?.value;

  if (!uuid) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({ authenticated: true, uuid });
}
