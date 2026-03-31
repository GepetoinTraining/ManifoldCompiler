import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    turso: !!process.env.TURSO_DATABASE_URL,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
  });
}
